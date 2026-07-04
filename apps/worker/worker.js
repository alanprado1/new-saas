// worker.js
// Audio Worker — runs locally or on any always-on server (NOT Vercel).
// Listens for Supabase Realtime events and generates TTS audio for each lesson line.
//
// KEY FIXES vs previous version:
// ─────────────────────────────────────────────────────────────
// 1. waitForVoiceVox timeout: 60 s → 180 s
//    HuggingFace Spaces can take 60–120 s to wake from a cold start.
//    The old 60 s timeout was too short and caused the worker to throw,
//    leaving the lesson in a permanent "generating_audio" state.
//
// 2. Per-request exponential back-off in generateWithRetry()
//    If a VoiceVox request fails (transient HF error, rate limit),
//    the worker retries up to 3 times with 2 s → 4 s → 8 s delays
//    before giving up on a single line.
//
// 3. Audio query timeout: 15 s (unchanged — fast step)
//    Synthesis timeout: 30 s → 60 s
//    The HF synthesis endpoint is slower under load; 30 s was too short
//    for longer sentences on a cold space.
//
// 4. Startup VoiceVox check
//    Worker checks HF space availability once at startup if local is absent,
//    so it's warm by the time the first job arrives.
//
// FIX A. In-flight deduplication guard (processingLessons Set)
//    Prevents two concurrent processLessonAudio() calls for the same lesson.
//    This can happen when the Realtime event fires AND the orphan poller picks
//    up the same lesson within its 60 s window, or when Supabase Realtime
//    delivers a duplicate event after a reconnect. Without this guard the two
//    jobs race each other: one sets status="ready" while the other sets
//    status="failed", leaving the lesson in a broken state.
//
// FIX B. Periodic orphan poller (startOrphanPoller)
//    Supabase Realtime does NOT guarantee delivery — events can be silently
//    dropped during a WebSocket reconnect or a brief network blip. The old
//    recoverOrphanedLessons() only ran at startup, so a lesson that entered
//    "generating_audio" while the worker was already running and missed the
//    event was permanently stuck. The poller queries every 60 s for lessons
//    that have been in "generating_audio" beyond the configured stale threshold
//    reprocesses them, exactly the same way the startup recovery did.
//
// FIX C. VoiceVox base URL resolved once per job, not per line
//    The original generateAudio() called isVoiceVoxReachable() on every single
//    line, adding up to 3 s of timeout overhead per line when local is down.
//    For a 10-line lesson using HF that's 30 s of dead time before any audio
//    is generated — and if the HF space is cold, waitForVoiceVox() was also
//    called per line (potentially 180 s each). The fix resolves the base URL
//    and warms the HF space exactly once at the start of processLessonAudio(),
//    then passes the resolved base into generateAudio() so it never checks again.
//
// Usage:
//   node worker.js
//
// Required .env:
//   SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...
//   TTS_PROVIDER=voicevox   # or "mock"
//   VOICEVOX_URL=http://127.0.0.1:50021
//   VOICEVOX_HF_URL=https://alanweg2-my-voicevox-api.hf.space
//   KOKORO_TTS_URL=https://your-kokoro-space.hf.space
//   KOKORO_TTS_URLS=https://space-a.hf.space,https://space-b.hf.space

import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// SECTION 1: ENVIRONMENT VALIDATION
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

for (const envPath of [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), ".env.local"),
  resolve(__dirname, ".env"),
  resolve(__dirname, ".env.local"),
  resolve(__dirname, "..", "web", ".env.local"),
  resolve(__dirname, "..", "..", ".env.local"),
]) {
  loadDotenv({ path: envPath, override: false, quiet: true });
}

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[worker] FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TTS_PROVIDER         = process.env.TTS_PROVIDER ?? "voicevox";
const VOICEVOX_LOCAL       = process.env.VOICEVOX_URL      ?? "http://127.0.0.1:50021";
const VOICEVOX_HF          = process.env.VOICEVOX_HF_URL   ?? "https://alanweg2-my-voicevox-api.hf.space";
const GEMINI_API_KEY       = process.env.GEMINI_API_KEY;
const KOKORO_TTS_URL       = process.env.KOKORO_TTS_URL ?? "https://alanweg2-kokoro-tts-api.hf.space";
const KOKORO_TTS_URLS      = endpointListFromEnv("KOKORO_TTS_URLS", KOKORO_TTS_URL);
const HF_TOKEN             = process.env.HF_TOKEN;
const GOOGLE_TTS_ENDPOINT  = "https://texttospeech.googleapis.com/v1/text:synthesize";
const GOOGLE_TTS_HARD_CAP  = positiveIntFromEnv("GOOGLE_TTS_MONTHLY_HARD_CAP", 980_000);
const GOOGLE_TTS_MODEL     = "chirp3-hd";
const GOOGLE_TTS_LANGUAGE  = "en-AU";
const GOOGLE_TTS_VOICE_POOL = [
  "en-AU-Chirp3-HD-Achernar",
  "en-AU-Chirp3-HD-Aoede",
  "en-AU-Chirp3-HD-Charon",
  "en-AU-Chirp3-HD-Fenrir",
  "en-AU-Chirp3-HD-Kore",
  "en-AU-Chirp3-HD-Orus",
];
const KOKORO_DEFAULT_VOICE = "af_heart";
const KOKORO_VOICE_POOL    = ["af_heart", "af_bella", "af_sarah", "af_sky", "am_adam", "am_michael"];
const EDGE_VOICE_POOL      = ["en-US-AriaNeural", "en-US-JennyNeural", "en-US-GuyNeural", "en-US-DavisNeural", "en-US-SaraNeural", "en-US-ChristopherNeural"];
const AUDIO_BUCKET         = "audio";
const FAILED_RECOVERY_WINDOW_DAYS = Number.parseInt(process.env.FAILED_RECOVERY_WINDOW_DAYS ?? "7", 10);
const FAILED_RECOVERY_COOLDOWN_MS = 5 * 60_000;
const KOKORO_TTS_CONCURRENCY = positiveIntFromEnv("KOKORO_TTS_CONCURRENCY", KOKORO_TTS_URLS.length);
const EDGE_TTS_CONCURRENCY = positiveIntFromEnv("EDGE_TTS_CONCURRENCY", 3);
const ORPHAN_STUCK_THRESHOLD_MS = Math.max(2 * 60_000, positiveIntFromEnv("ORPHAN_STUCK_THRESHOLD_MS", 900_000));
const ACTIVE_JOB_POLL_INTERVAL_MS = positiveIntFromEnv("ACTIVE_JOB_POLL_INTERVAL_MS", 10_000);
const ACTIVE_JOB_POLL_LIMIT = positiveIntFromEnv("ACTIVE_JOB_POLL_LIMIT", 5);
const WORKER_PORT = positiveIntFromEnv("PORT", 7860);

// ── FIX A: In-flight deduplication guard ────────────────────
// Tracks lesson IDs currently being processed. Prevents two concurrent
// processLessonAudio() calls for the same lesson (e.g. Realtime event +
// orphan poller firing at the same time, or a duplicate Realtime delivery
// after a reconnect). The Set is cleared in the finally block regardless
// of success or failure, so a genuinely failed lesson can be retried.
const processingLessons = new Set();
const LESSON_TABLES = {
  japanese: { lessons: "lessons", lines: "lesson_lines" },
  english: { lessons: "english_lessons", lines: "english_lesson_lines" },
};

function lessonTablesForDirection(learningDirection) {
  return learningDirection === "en-ja" ? LESSON_TABLES.english : LESSON_TABLES.japanese;
}

// ── VoiceVox health helpers ──────────────────────────────────

async function isVoiceVoxReachable(base) {
  try {
    const res = await fetch(`${base}/version`, { signal: AbortSignal.timeout(3_000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * waitForVoiceVox
 * ──────────────────────────────────────────────────────────────
 * Polls the /version endpoint until the HF Space wakes up.
 * Timeout: 180 s to handle cold starts.
 * Polls every 4 s to reduce noise in HF logs.
 */
async function waitForVoiceVox(base, timeoutMs = 180_000) {
  const start = Date.now();
  log("init", `Waiting for VoiceVox cloud at ${base} (up to ${timeoutMs / 1000}s)...`);
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/version`, { signal: AbortSignal.timeout(6_000) });
      if (res.ok) {
        log("init", `VoiceVox cloud ready after ${((Date.now() - start) / 1000).toFixed(1)}s`);
        return;
      }
    } catch { /* still sleeping */ }
    await sleep(4_000);
  }
  throw new Error(`VoiceVox cloud timed out after ${timeoutMs / 1000}s at ${base}`);
}

/**
 * generateWithRetry
 * ──────────────────────────────────────────────────────────────
 * Wraps a single VoiceVox request with up to maxAttempts retries
 * using exponential back-off. Handles transient HF errors and rate limits
 * without failing the entire lesson.
 *
 * @param {() => Promise<Buffer>} fn   - The async function to retry
 * @param {number}                maxAttempts
 * @param {number}                baseDelayMs - Doubles on each retry
 * @returns {Promise<Buffer>}
 */
async function generateWithRetry(fn, maxAttempts = 3, baseDelayMs = 2_000) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        log("warn", `VoiceVox attempt ${attempt}/${maxAttempts} failed: ${err.message}. Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

function shouldFallbackToMockAudio(err) {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("timed out") ||
    message.includes("unreachable") ||
    message.includes("fetch failed") ||
    message.includes("terminated") ||
    message.includes("ECONNRESET") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND") ||
    message.includes("ETIMEDOUT") ||
    message.includes("/audio_query returned HTTP") ||
    message.includes("/synthesis returned HTTP") ||
    message.includes("VoiceVox returned empty audio")
  );
}

function buildLessonLineRows(lessonId, structuredContent) {
  const dialogue = Array.isArray(structuredContent?.dialogue)
    ? structuredContent.dialogue
    : [];

  return dialogue
    .filter((line) => line?.speaker && line?.kanji && line?.romaji && line?.english)
    .map((line, index) => ({
      lesson_id: lessonId,
      order_index: index,
      speaker: line.speaker,
      kanji: line.kanji,
      romaji: line.romaji,
      english: line.english,
      highlights: [],
      audio_url: null,
    }));
}

const DEFAULT_LEARNING_DIRECTION = "ja-en";
const LANGUAGE_DIRECTIONS = {
  "ja-en": {
    learningDirection: "ja-en",
    targetLanguage: "ja",
    supportLanguage: "en",
    generationProvider: "gemini",
    ttsProvider: "voicevox",
  },
  "en-ja": {
    learningDirection: "en-ja",
    targetLanguage: "en",
    supportLanguage: "ja",
    generationProvider: "cerebras",
    ttsProvider: "google",
  },
};

function resolveLearningDirection(value) {
  return value === "en-ja" ? "en-ja" : DEFAULT_LEARNING_DIRECTION;
}

function resolveLessonLanguageMeta(lessonMeta) {
  const structured = lessonMeta?.structured_content ?? {};
  const learningDirection = resolveLearningDirection(
    lessonMeta?.learning_direction ?? structured.learning_direction,
  );
  const config = LANGUAGE_DIRECTIONS[learningDirection];

  return {
    learningDirection,
    targetLanguage: lessonMeta?.target_language ?? structured.target_language ?? config.targetLanguage,
    supportLanguage: lessonMeta?.support_language ?? structured.support_language ?? config.supportLanguage,
    ttsProvider: lessonMeta?.tts_provider ?? structured.tts_provider ?? config.ttsProvider,
  };
}

function getLineTargetText(line, languageMeta) {
  return languageMeta.targetLanguage === "en"
    ? (line.english ?? line.kanji)
    : line.kanji;
}

function positiveIntFromEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function endpointListFromEnv(name, fallback) {
  const raw = process.env[name] ?? fallback;
  const endpoints = raw
    .split(/[,\n]/)
    .map(normalizeEndpointUrl)
    .filter(Boolean);

  return [...new Set(endpoints)];
}

function normalizeEndpointUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    url.pathname = url.pathname.replace(/\/(?:health|tts)\/?$/i, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return trimmed.replace(/\/(?:health|tts)\/?$/i, "").replace(/\/$/, "");
  }
}

function endpointLabel(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let firstError = null;

  async function worker() {
    while (nextIndex < items.length) {
      if (firstError) return;
      const currentIndex = nextIndex++;
      try {
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      } catch (err) {
        firstError = err;
      }
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (firstError) throw firstError;
  return results;
}

function concurrencyForProvider(provider) {
  if (provider.name === "KokoroTTS") return KOKORO_TTS_CONCURRENCY;
  if (provider.name === "EdgeTTS") return EDGE_TTS_CONCURRENCY;
  return 1;
}

function isMissingColumnError(error, columnName) {
  const message = error?.message ?? "";
  return (
    error?.code === "42703" ||
    message.includes(`'${columnName}'`) ||
    message.includes(`.${columnName}`) ||
    message.toLowerCase().includes(`column ${columnName}`)
  );
}

async function fetchStuckGeneratingLessons(tables, cutoff) {
  const updatedAtQuery = await supabase
    .from(tables.lessons)
    .select("id, scenario, updated_at")
    .eq("status", "generating_audio")
    .lt("updated_at", cutoff);

  if (!updatedAtQuery.error) {
    return {
      lessons: updatedAtQuery.data ?? [],
      error: null,
      staleColumn: "updated_at",
    };
  }

  if (!isMissingColumnError(updatedAtQuery.error, "updated_at")) {
    return { lessons: [], error: updatedAtQuery.error, staleColumn: "updated_at" };
  }

  log("warn", `Orphan poller: ${tables.lessons}.updated_at is missing - falling back to created_at. Run the Japanese audio recovery migration when possible.`);

  const createdAtQuery = await supabase
    .from(tables.lessons)
    .select("id, scenario, created_at")
    .eq("status", "generating_audio")
    .lt("created_at", cutoff);

  return {
    lessons: createdAtQuery.data ?? [],
    error: createdAtQuery.error,
    staleColumn: "created_at",
  };
}

async function fetchRecoverableFailedLessons(tables, cutoff, retryCutoff) {
  const updatedAtQuery = await supabase
    .from(tables.lessons)
    .select("id, scenario, created_at, updated_at, structured_content")
    .eq("status", "failed")
    .gte("created_at", cutoff)
    .lt("updated_at", retryCutoff)
    .not("structured_content", "is", null)
    .order("created_at", { ascending: true })
    .limit(10);

  if (!updatedAtQuery.error) {
    return { lessons: updatedAtQuery.data ?? [], error: null };
  }

  if (!isMissingColumnError(updatedAtQuery.error, "updated_at")) {
    return { lessons: [], error: updatedAtQuery.error };
  }

  log("warn", `Failed-lesson recovery: ${tables.lessons}.updated_at is missing - falling back to created_at cooldown.`);

  const createdAtQuery = await supabase
    .from(tables.lessons)
    .select("id, scenario, created_at, structured_content")
    .eq("status", "failed")
    .gte("created_at", cutoff)
    .lt("created_at", retryCutoff)
    .not("structured_content", "is", null)
    .order("created_at", { ascending: true })
    .limit(10);

  return { lessons: createdAtQuery.data ?? [], error: createdAtQuery.error };
}

async function fetchGeneratingAudioLessons(tables) {
  const { data, error } = await supabase
    .from(tables.lessons)
    .select("id, scenario, created_at")
    .eq("status", "generating_audio")
    .order("created_at", { ascending: true })
    .limit(ACTIVE_JOB_POLL_LIMIT);

  return { lessons: data ?? [], error };
}

// ============================================================
// SECTION 2: SUPABASE CLIENT
// ============================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { heartbeatIntervalMs: 30_000 } },
});

function currentUtcMonthStart() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

async function reserveGoogleTTSCharacters(characterCount) {
  const { data, error } = await supabase.rpc("reserve_google_tts_characters", {
    p_character_count: characterCount,
    p_hard_cap: GOOGLE_TTS_HARD_CAP,
    p_month_start: currentUtcMonthStart(),
  });

  if (error) {
    const migrationHint = (
      error.code === "PGRST202" ||
      error.message?.includes("reserve_google_tts_characters") ||
      error.message?.includes("google_tts_monthly_usage")
    )
      ? " Run supabase/migrations/20260704_ensure_google_tts_cap.sql in Supabase, then restart the worker."
      : "";
    throw new Error(`Google TTS cap check failed: ${error.message}.${migrationHint}`);
  }

  const result = Array.isArray(data) ? data[0] : data;
  return {
    allowed: result?.allowed === true,
    monthStart: result?.month_start ?? currentUtcMonthStart(),
    previousTotal: Number(result?.previous_total ?? 0),
    newTotal: Number(result?.new_total ?? 0),
    hardCap: Number(result?.hard_cap ?? GOOGLE_TTS_HARD_CAP),
  };
}

async function releaseGoogleTTSCharacters(characterCount, monthStart) {
  const { error } = await supabase.rpc("release_google_tts_characters", {
    p_character_count: characterCount,
    p_month_start: monthStart,
  });

  if (error) {
    log("warn", `Google TTS cap release failed: ${error.message}`);
  }
}

async function recordGoogleTTSUsageEvent({ characterCount, lessonId, lineId, voiceName }) {
  const { error } = await supabase.rpc("record_google_tts_usage_event", {
    p_character_count: characterCount,
    p_lesson_id: lessonId,
    p_line_id: lineId,
    p_voice_name: voiceName,
    p_model: GOOGLE_TTS_MODEL,
    p_month_start: currentUtcMonthStart(),
  });

  if (error) {
    log("warn", `Google TTS usage event insert failed: ${error.message}`);
  }
}

function buildStringVoiceMap(speakers, characterVoices = {}, voicePool = []) {
  const map = {};
  const used = new Set();

  for (const speaker of speakers) {
    const voice = characterVoices[speaker];
    if (typeof voice === "string" && voicePool.includes(voice) && !used.has(voice)) {
      map[speaker] = voice;
      used.add(voice);
    }
  }

  let poolIdx = 0;
  for (const speaker of speakers) {
    if (map[speaker] !== undefined) continue;

    while (poolIdx < voicePool.length && used.has(voicePool[poolIdx])) {
      poolIdx++;
    }

    const fallbackVoice = voicePool[poolIdx % voicePool.length];
    map[speaker] = fallbackVoice;
    used.add(fallbackVoice);
    poolIdx++;
  }

  return map;
}

// ============================================================
// SECTION 3: TTS PROVIDERS
// ============================================================

class LocalVoiceVoxProvider {
  name = "LocalVoiceVox";

  // Pool of popular VoiceVox speaker IDs used as a last-resort fallback when
  // structured_content.character_voices is missing or incomplete.
  // Assigned round-robin across unique speakers so no two characters share a voice.
  FALLBACK_VOICE_POOL = [3, 1, 8, 14, 2, 10, 11, 13];

  /**
   * buildSpeakerMap
   * ─────────────────────────────────────────────────────────────
   * Derives a speaker→speakerId map for a single lesson, in priority order:
   *
   *   1. character_voices from structured_content (LLM-assigned, server-validated).
   *      Distinct IDs are guaranteed by the server-side deduplication in
   *      api/generate/route.ts before the lesson is saved to the DB.
   *
   *   2. Fallback: assign IDs round-robin from FALLBACK_VOICE_POOL.
   *      Used for legacy lessons or when character_voices is absent.
   *      Guarantees: unique speaker → unique ID, deterministic across calls.
   *
   * @param {string[]} speakers         - Unique speaker names in dialogue order
   * @param {Record<string,number>} characterVoices - From structured_content
   * @returns {Record<string, number>}  - speaker name → VoiceVox speaker ID
   */
  buildSpeakerMap(speakers, characterVoices = {}) {
    const map     = {};
    const usedIds = new Set();

    // Pass 1: honour LLM-cast voices where present and still unique.
    for (const speaker of speakers) {
      const id = characterVoices[speaker];
      if (typeof id === "number" && !usedIds.has(id)) {
        map[speaker] = id;
        usedIds.add(id);
      }
    }

    // Pass 2: fill in any speakers the LLM missed (or gave duplicate IDs to)
    // using the fallback pool, skipping IDs already in use.
    let poolIdx = 0;
    for (const speaker of speakers) {
      if (map[speaker] !== undefined) continue;

      while (
        poolIdx < this.FALLBACK_VOICE_POOL.length &&
        usedIds.has(this.FALLBACK_VOICE_POOL[poolIdx])
      ) {
        poolIdx++;
      }
      const fallbackId = this.FALLBACK_VOICE_POOL[poolIdx % this.FALLBACK_VOICE_POOL.length];
      map[speaker] = fallbackId;
      usedIds.add(fallbackId);
      poolIdx++;
    }

    return map;
  }

  /**
   * generateAudio
   * ────────────────────────────────────────────────────────────
   * FIX C: `base` is now passed in from processLessonAudio() which resolves
   * it once per job. This removes the per-line isVoiceVoxReachable() call
   * and the per-line waitForVoiceVox() call that was causing massive
   * compounding delays when local VoiceVox was offline.
   *
   * overrideId takes absolute precedence (manual voice-change UI).
   * When null, the per-speaker map resolved in processLessonAudio() is used.
   *
   * @param {string} text
   * @param {string} speaker
   * @param {number} lineIndex
   * @param {number|null} overrideId
   * @param {string} base  - Resolved VoiceVox base URL (local or HF), pre-warmed
   */
  async generateAudio(text, speaker, lineIndex, overrideId = null, base) {
    // overrideId is always pre-resolved by processLessonAudio() before this call.
    // The fallback to 3 (ずんだもん) is a true last-resort that should never fire.
    const speakerId = (overrideId !== null && Number.isInteger(overrideId))
      ? overrideId
      : 3;

    log("tts", `Line ${lineIndex} — VoiceVox: speaker='${speaker}' id=${speakerId}${overrideId !== null ? " (override)" : ""} | "${text.substring(0, 30)}..."`);

    return generateWithRetry(async () => {
      // ── Step 1: audio query ──────────────────────────────────
      const queryRes = await fetch(
        `${base}/audio_query?` + new URLSearchParams({ text, speaker: String(speakerId) }),
        {
          method: "POST",
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(15_000),
        }
      );
      if (!queryRes.ok) {
        const body = await queryRes.text().catch(() => "(unreadable)");
        throw new Error(`/audio_query returned HTTP ${queryRes.status}: ${body}`);
      }
      const audioQuery = await queryRes.json();
      log("tts", `Line ${lineIndex} — Audio query OK. Synthesizing...`);

      // ── Step 2: synthesis (60 s timeout) ─────────────────────
      const synthRes = await fetch(
        `${base}/synthesis?` + new URLSearchParams({ speaker: String(speakerId) }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "audio/wav" },
          body: JSON.stringify(audioQuery),
          signal: AbortSignal.timeout(60_000),
        }
      );
      if (!synthRes.ok) {
        const body = await synthRes.text().catch(() => "(unreadable)");
        throw new Error(`/synthesis returned HTTP ${synthRes.status} for line ${lineIndex}: ${body}`);
      }

      const arrayBuffer = await synthRes.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        throw new Error(`VoiceVox returned empty audio for line ${lineIndex}.`);
      }

      log("tts", `Line ${lineIndex} — WAV: ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB`);
      return Buffer.from(arrayBuffer);
    }, 3, 2_000); // up to 3 attempts, 2 s base delay
  }
}

const GEMINI_PCM_SR = 24000;
const GEMINI_PCM_CH = 1;
const GEMINI_PCM_BPS = 16;

function buildWavHeader(pcmBytes) {
  const byteRate = GEMINI_PCM_SR * GEMINI_PCM_CH * (GEMINI_PCM_BPS / 8);
  const blockAlign = GEMINI_PCM_CH * (GEMINI_PCM_BPS / 8);
  const h = Buffer.alloc(44);

  h.write("RIFF", 0, "ascii");
  h.writeUInt32LE(36 + pcmBytes, 4);
  h.write("WAVE", 8, "ascii");
  h.write("fmt ", 12, "ascii");
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(GEMINI_PCM_CH, 22);
  h.writeUInt32LE(GEMINI_PCM_SR, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(GEMINI_PCM_BPS, 34);
  h.write("data", 36, "ascii");
  h.writeUInt32LE(pcmBytes, 40);

  return h;
}

function wrapAudioBuffer(buf) {
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return buf;
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return buf;
  if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) return buf;
  if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return buf;
  return Buffer.concat([buildWavHeader(buf.byteLength), buf]);
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function escapeSsml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildGoogleLineSsml(text) {
  const escaped = escapeSsml(text.trim());
  return [
    "<speak>",
    '<prosody rate="96%" pitch="+0st">',
    escaped.replace(/([.!?])\s+/g, "$1<break time=\"180ms\"/> "),
    "</prosody>",
    "</speak>",
  ].join("");
}

function hasGoogleTTSCredentials() {
  return googleTTSCredentialSource() !== "missing";
}

function googleTTSCredentialSource() {
  if (process.env.GOOGLE_TTS_API_KEY?.trim()) return "GOOGLE_TTS_API_KEY";
  if (process.env.GOOGLE_TTS_ACCESS_TOKEN?.trim()) return "GOOGLE_TTS_ACCESS_TOKEN";
  if (process.env.GOOGLE_CLOUD_TTS_CREDENTIALS_JSON?.trim()) return "GOOGLE_CLOUD_TTS_CREDENTIALS_JSON";
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim()) return "GOOGLE_APPLICATION_CREDENTIALS_JSON";
  if (process.env.GOOGLE_CREDENTIALS_JSON?.trim()) return "GOOGLE_CREDENTIALS_JSON";
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) return "GOOGLE_APPLICATION_CREDENTIALS";
  return "missing";
}

let googleAccessTokenCache = null;

async function loadGoogleServiceAccount() {
  const rawJson =
    process.env.GOOGLE_CLOUD_TTS_CREDENTIALS_JSON ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ??
    process.env.GOOGLE_CREDENTIALS_JSON;

  if (rawJson?.trim()) {
    const trimmed = rawJson.trim();
    const unwrapped = (
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    )
      ? trimmed.slice(1, -1)
      : trimmed;
    try {
      return JSON.parse(unwrapped);
    } catch (err) {
      throw new Error(`GOOGLE_CLOUD_TTS_CREDENTIALS_JSON is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath?.trim()) {
    try {
      return JSON.parse(await readFile(credentialsPath, "utf8"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`GOOGLE_APPLICATION_CREDENTIALS points to a file that could not be read: ${credentialsPath}. Remove GOOGLE_APPLICATION_CREDENTIALS or set GOOGLE_CLOUD_TTS_CREDENTIALS_JSON to the full service account JSON. Original error: ${message}`);
    }
  }

  throw new Error("Google TTS credentials are not configured.");
}

async function getGoogleAccessToken() {
  if (process.env.GOOGLE_TTS_ACCESS_TOKEN?.trim()) {
    return process.env.GOOGLE_TTS_ACCESS_TOKEN.trim();
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (googleAccessTokenCache && googleAccessTokenCache.expiresAtSeconds - 60 > nowSeconds) {
    return googleAccessTokenCache.token;
  }

  const serviceAccount = await loadGoogleServiceAccount();
  const clientEmail = serviceAccount.client_email;
  const privateKey = serviceAccount.private_key?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Google TTS service account must include client_email and private_key.");
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: nowSeconds + 3600,
    iat: nowSeconds,
  };
  const unsignedJwt = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claimSet))}`;
  const signature = createSign("RSA-SHA256").update(unsignedJwt).sign(privateKey, "base64url");
  const assertion = `${unsignedJwt}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!tokenRes.ok) {
    throw new Error(`Google OAuth ${tokenRes.status}: ${await tokenRes.text().catch(() => tokenRes.statusText)}`);
  }

  const tokenData = await tokenRes.json();
  if (!tokenData?.access_token) {
    throw new Error("Google OAuth returned no access_token.");
  }

  googleAccessTokenCache = {
    token: tokenData.access_token,
    expiresAtSeconds: nowSeconds + Number(tokenData.expires_in ?? 3600),
  };

  return googleAccessTokenCache.token;
}

class GoogleCloudTTSProvider {
  name = "GoogleCloudTTS";

  async generateAudio(text, speaker, lineIndex, voiceOverride = null, _base) {
    if (!text?.trim()) {
      throw new Error(`Google TTS: no text provided for line ${lineIndex}.`);
    }

    const voiceName = typeof voiceOverride === "string" && GOOGLE_TTS_VOICE_POOL.includes(voiceOverride)
      ? voiceOverride
      : GOOGLE_TTS_VOICE_POOL[Math.max(0, lineIndex - 1) % GOOGLE_TTS_VOICE_POOL.length];
    const apiKey = process.env.GOOGLE_TTS_API_KEY?.trim();
    const accessToken = apiKey ? null : await getGoogleAccessToken();

    log("tts", `Line ${lineIndex} - Google TTS ${GOOGLE_TTS_LANGUAGE} Chirp 3 HD: speaker='${speaker}' voice='${voiceName}' | "${text.substring(0, 40)}..."`);

    const endpoint = apiKey
      ? `${GOOGLE_TTS_ENDPOINT}?${new URLSearchParams({ key: apiKey })}`
      : GOOGLE_TTS_ENDPOINT;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { ssml: buildGoogleLineSsml(text) },
        voice: {
          languageCode: GOOGLE_TTS_LANGUAGE,
          name: voiceName,
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 0.98,
          pitch: 0,
          effectsProfileId: ["headphone-class-device"],
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      throw new Error(`Google TTS ${res.status}: ${await res.text().catch(() => res.statusText)}`);
    }

    const data = await res.json();
    if (!data?.audioContent) {
      throw new Error(`Google TTS: no audioContent returned for line ${lineIndex}.`);
    }

    return Buffer.from(data.audioContent, "base64");
  }
}

class GeminiTTSProvider {
  name = "GeminiTTS";

  async generateAudio(text, speaker, lineIndex, _overrideId = null, _base) {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set for Gemini TTS.");
    }
    if (!text?.trim()) {
      throw new Error(`Gemini TTS: no text provided for line ${lineIndex}.`);
    }

    const modelId = "gemini-3.1-flash-tts-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;

    log("tts", `Line ${lineIndex} - Gemini TTS: speaker='${speaker}' | "${text.substring(0, 40)}..."`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      throw new Error(`Gemini TTS ${res.status}: ${await res.text().catch(() => res.statusText)}`);
    }

    const data = await res.json();
    const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) {
      throw new Error(`Gemini TTS: no audio data returned for line ${lineIndex}.`);
    }

    return wrapAudioBuffer(Buffer.from(b64, "base64"));
  }
}

class KokoroTTSProvider {
  name = "KokoroTTS";

  constructor(urls = KOKORO_TTS_URLS) {
    this.urls = urls.length > 0 ? urls : [KOKORO_TTS_URL.replace(/\/$/, "")];
  }

  async generateAudio(text, speaker, lineIndex, voiceOverride = null, _base) {
    if (!text?.trim()) {
      throw new Error(`Kokoro TTS: no text provided for line ${lineIndex}.`);
    }
    const voiceName = typeof voiceOverride === "string" && KOKORO_VOICE_POOL.includes(voiceOverride)
      ? voiceOverride
      : KOKORO_DEFAULT_VOICE;
    const primaryIndex = Math.max(0, lineIndex - 1) % this.urls.length;
    const orderedUrls = [
      this.urls[primaryIndex],
      ...this.urls.filter((_, index) => index !== primaryIndex),
    ];
    const errors = [];

    for (const url of orderedUrls) {
      log("tts", `Line ${lineIndex} - Kokoro TTS @ ${endpointLabel(url)}: speaker='${speaker}' voice='${voiceName}' | "${text.substring(0, 40)}..."`);

      try {
        const res = await fetch(`${url}/tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {}),
          },
          body: JSON.stringify({
            text: text.trim(),
            voice: voiceName,
            speed: 1,
          }),
          signal: AbortSignal.timeout(90_000),
        });

        if (!res.ok) {
          throw new Error(`Kokoro TTS ${res.status}: ${await res.text().catch(() => res.statusText)}`);
        }

        return Buffer.from(await res.arrayBuffer());
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${endpointLabel(url)}: ${message}`);
        log("warn", `Line ${lineIndex} - Kokoro endpoint failed @ ${endpointLabel(url)}: ${message}`);
      }
    }

    throw new Error(`All Kokoro endpoints failed for line ${lineIndex}: ${errors.join(" | ")}`);
  }
}

class EdgeTTSProvider {
  name = "EdgeTTS";

  async generateAudio(text, speaker, lineIndex, voiceOverride = null, _base) {
    if (!text?.trim()) {
      throw new Error(`Edge TTS: no text provided for line ${lineIndex}.`);
    }

    const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
    const voiceName = typeof voiceOverride === "string" && EDGE_VOICE_POOL.includes(voiceOverride)
      ? voiceOverride
      : EDGE_VOICE_POOL[0];
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    log("tts", `Line ${lineIndex} - Edge TTS fallback: speaker='${speaker}' voice='${voiceName}' | "${text.substring(0, 40)}..."`);

    return new Promise((resolve, reject) => {
      const chunks = [];
      const { audioStream } = tts.toStream(text.trim());
      audioStream.on("data", (chunk) => chunks.push(chunk));
      audioStream.on("end", () => resolve(Buffer.concat(chunks)));
      audioStream.on("error", reject);
    });
  }
}

class MockProvider {
  name = "Mock";

  // base param accepted but unused — keeps the call signature uniform with
  // LocalVoiceVoxProvider so processLessonAudio() can call both the same way.
  async generateAudio(text, speaker, lineIndex, overrideId = null, _base) {
    log("tts", `Line ${lineIndex} — Mock TTS for '${speaker}'${overrideId !== null ? ` (override id=${overrideId})` : ""}: "${text.substring(0, 40)}..."`);
    await sleep(200 + Math.random() * 300);
    return Buffer.from("UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==", "base64");
  }
}

function createTTSProvider() {
  switch (TTS_PROVIDER.toLowerCase()) {
    case "voicevox":
      log("init", `TTS: VoiceVox (local: ${VOICEVOX_LOCAL} → cloud: ${VOICEVOX_HF})`);
      return new LocalVoiceVoxProvider();
    case "mock":
      log("init", "TTS: Mock (dry-run)");
      return new MockProvider();
    default:
      log("warn", `Unknown TTS_PROVIDER '${TTS_PROVIDER}'. Falling back to Mock.`);
      return new MockProvider();
  }
}

const ttsProvider = createTTSProvider();

function resolveLessonTTSProvider(languageMeta) {
  if (languageMeta.ttsProvider === "voicevox" || languageMeta.targetLanguage === "ja") {
    return ttsProvider;
  }

  if (languageMeta.ttsProvider === "kokoro") {
    return new KokoroTTSProvider();
  }

  if (languageMeta.ttsProvider === "google" || languageMeta.targetLanguage === "en") {
    return new GoogleCloudTTSProvider();
  }

  if (languageMeta.ttsProvider === "gemini") {
    return new GeminiTTSProvider();
  }

  log("warn", `Worker TTS provider '${languageMeta.ttsProvider}' is not implemented here yet. Using Mock audio for ${languageMeta.learningDirection}.`);
  return new MockProvider();
}

// ============================================================
// SECTION 4: CORE PROCESSING
// ============================================================

async function processLessonAudio(lessonId, tables = LESSON_TABLES.japanese) {
  // ── FIX A: Deduplication guard ───────────────────────────────
  // Bail immediately if this lesson is already being processed. This prevents
  // the Realtime event and the orphan poller from running the same job twice,
  // and also guards against duplicate Realtime deliveries after a reconnect.
  if (processingLessons.has(lessonId)) {
    log("warn", `Lesson ${lessonId} is already processing — skipping duplicate trigger.`);
    return;
  }
  processingLessons.add(lessonId);

  log("job", `▶ Starting audio generation for lesson: ${lessonId}`);

  try {
    const [{ data: lessonMeta, error: metaError }, { data: lines, error: fetchError }] =
      await Promise.all([
        supabase
          .from(tables.lessons)
          .select("voice_id, structured_content, learning_direction, target_language, support_language, tts_provider")
          .eq("id", lessonId)
          .single(),
        supabase
          .from(tables.lines)
          .select("id, order_index, speaker, kanji, english")
          .eq("lesson_id", lessonId)
          .order("order_index", { ascending: true }),
      ]);

    if (metaError) throw new Error(`Failed to fetch lesson metadata: ${metaError.message}`);
    if (fetchError) throw new Error(`Failed to fetch lesson lines: ${fetchError.message}`);
    if (!lines || lines.length === 0) throw new Error(`No lesson lines found for lesson ${lessonId}.`);

    const rawVoiceId      = lessonMeta?.voice_id;
    const overrideVoiceId = (rawVoiceId !== null && rawVoiceId !== undefined && Number.isInteger(rawVoiceId))
      ? rawVoiceId
      : null;

    const characterVoices  = lessonMeta?.structured_content?.character_voices ?? {};
    const hasCharacterCast = Object.keys(characterVoices).length > 0;
    const languageMeta = resolveLessonLanguageMeta(lessonMeta);
    const lessonTTSProvider = resolveLessonTTSProvider(languageMeta);
    const useVoiceVoxOverride = lessonTTSProvider instanceof LocalVoiceVoxProvider && overrideVoiceId !== null;

    if (useVoiceVoxOverride) {
      log("job", `Voice override: all lines → speaker id=${overrideVoiceId}`);
    }

    log("job", `Language direction: ${languageMeta.learningDirection} (${languageMeta.targetLanguage}->${languageMeta.supportLanguage}), tts=${languageMeta.ttsProvider}`);

    // Build the per-speaker voice map using the provider's deduplication logic.
    // This is always derived from unique speakers in the actual lines so it
    // handles both new lessons (character_voices populated) and legacy ones (fallback pool).
    const uniqueSpeakers = [...new Set(lines.map(l => l.speaker))];

    // Build per-speaker map (only used when overrideVoiceId is null)
    const speakerMap = useVoiceVoxOverride
      ? {}
      : (lessonTTSProvider instanceof LocalVoiceVoxProvider
          ? lessonTTSProvider.buildSpeakerMap(uniqueSpeakers, characterVoices)
          : lessonTTSProvider.name === "KokoroTTS"
            ? buildStringVoiceMap(uniqueSpeakers, characterVoices, KOKORO_VOICE_POOL)
            : lessonTTSProvider.name === "GoogleCloudTTS"
              ? buildStringVoiceMap(uniqueSpeakers, characterVoices, GOOGLE_TTS_VOICE_POOL)
            : lessonTTSProvider.name === "EdgeTTS"
              ? buildStringVoiceMap(uniqueSpeakers, characterVoices, EDGE_VOICE_POOL)
              : {});
    const edgeSpeakerMap = buildStringVoiceMap(uniqueSpeakers, {}, EDGE_VOICE_POOL);

    if (!useVoiceVoxOverride) {
      if (hasCharacterCast) {
        const castSummary = Object.entries(speakerMap).map(([n, id]) => `${n}→${id}`).join(", ");
        log("job", `Speaker voice map: ${castSummary}`);
      } else {
        log("job", "No character_voices in DB — using fallback pool for distinct speaker assignment.");
        const castSummary = Object.entries(speakerMap).map(([n, id]) => `${n}→${id}`).join(", ");
        log("job", `Fallback speaker map: ${castSummary}`);
      }
    }

    // ── FIX C: Resolve VoiceVox base URL once per job ────────────
    // Previously, generateAudio() called isVoiceVoxReachable() on every line
    // (up to 3 s per call) and waitForVoiceVox() on every line when local was
    // offline (up to 180 s per call). For a 10-line lesson on a cold HF space
    // this was catastrophic. Now we check once here, warm the HF space if needed,
    // and pass the resolved base URL into every generateAudio() call.
    let ttsBase;
    if (lessonTTSProvider instanceof LocalVoiceVoxProvider) {
      const localUp = await isVoiceVoxReachable(VOICEVOX_LOCAL);
      if (localUp) {
        ttsBase = VOICEVOX_LOCAL;
        log("job", "Using local VoiceVox for this job.");
      } else {
        log("job", "Local VoiceVox offline — waiting for HF Space...");
        await waitForVoiceVox(VOICEVOX_HF); // throws after 180 s, caught below
        ttsBase = VOICEVOX_HF;
        log("job", `HF Space ready. Using cloud VoiceVox for this job.`);
      }
    } else {
      // MockProvider — base is irrelevant but we set a value for consistency
      ttsBase = VOICEVOX_LOCAL;
    }

    const lineConcurrency = concurrencyForProvider(lessonTTSProvider);
    log("job", `Processing ${lines.length} lines with concurrency=${lineConcurrency}...`);

    await mapWithConcurrency(lines, lineConcurrency, async (line) => {
      const { id: lineId, order_index, speaker } = line;
      const targetText = getLineTargetText(line, languageMeta);
      const displayLine = order_index + 1;

      log("job", `Line ${displayLine}/${lines.length} [${speaker}]`);

      // Resolve the effective speaker voice for this line:
      //   - VoiceVox uses numeric speaker IDs and honors manual override.
      //   - English providers use string voice names from the per-speaker map.
      const effectiveSpeakerVoice =
        lessonTTSProvider instanceof LocalVoiceVoxProvider
          ? (useVoiceVoxOverride ? overrideVoiceId : (speakerMap[speaker] ?? 3))
          : (speakerMap[speaker] ?? null);

      // Generate audio (with retry built into generateWithRetry via generateAudio)
      let audioBuffer;
      let audioProvider = lessonTTSProvider;
      let audioVoice = effectiveSpeakerVoice;
      try {
        if (lessonTTSProvider.name === "GoogleCloudTTS") {
          const characterCount = targetText.length;
          let reservation;

          try {
            reservation = await reserveGoogleTTSCharacters(characterCount);
          } catch (capError) {
            const message = capError instanceof Error ? capError.message : String(capError);
            log("warn", `Google TTS cap check unavailable - Kokoro fallback for line ${displayLine}: ${message}`);
            audioProvider = new KokoroTTSProvider();
            audioVoice = buildStringVoiceMap(uniqueSpeakers, characterVoices, KOKORO_VOICE_POOL)[speaker] ?? null;
            audioBuffer = await audioProvider.generateAudio(targetText, speaker, displayLine, audioVoice, ttsBase);
          }

          if (!audioBuffer && reservation && !reservation.allowed) {
            log("warn", `Google TTS hard cap reached (${reservation.previousTotal}+${characterCount} > ${reservation.hardCap}) - Kokoro fallback for line ${displayLine}.`);
            audioProvider = new KokoroTTSProvider();
            audioVoice = buildStringVoiceMap(uniqueSpeakers, characterVoices, KOKORO_VOICE_POOL)[speaker] ?? null;
            audioBuffer = await audioProvider.generateAudio(targetText, speaker, displayLine, audioVoice, ttsBase);
          }

          if (!audioBuffer && reservation?.allowed) {
            try {
              audioBuffer = await lessonTTSProvider.generateAudio(targetText, speaker, displayLine, effectiveSpeakerVoice, ttsBase);
              await recordGoogleTTSUsageEvent({
                characterCount,
                lessonId,
                lineId,
                voiceName: typeof effectiveSpeakerVoice === "string" ? effectiveSpeakerVoice : null,
              });
              log("tts", `Google TTS monthly usage: ${reservation.previousTotal} -> ${reservation.newTotal}/${reservation.hardCap} chars.`);
            } catch (googleError) {
              await releaseGoogleTTSCharacters(characterCount, reservation.monthStart);
              const message = googleError instanceof Error ? googleError.message : String(googleError);
              log("warn", `Google TTS failed after cap reservation - Kokoro fallback for line ${displayLine}: ${message}`);
              audioProvider = new KokoroTTSProvider();
              audioVoice = buildStringVoiceMap(uniqueSpeakers, characterVoices, KOKORO_VOICE_POOL)[speaker] ?? null;
              audioBuffer = await audioProvider.generateAudio(targetText, speaker, displayLine, audioVoice, ttsBase);
            }
          }
        } else {
          audioBuffer = await lessonTTSProvider.generateAudio(targetText, speaker, displayLine, effectiveSpeakerVoice, ttsBase);
        }
      } catch (ttsError) {
        // VoiceVox fallback to Mock when the remote engine is unavailable,
        // overloaded, rejects a speaker ID, or returns malformed/empty audio.
        if (lessonTTSProvider.name === "LocalVoiceVox" && shouldFallbackToMockAudio(ttsError)) {
          const message = ttsError instanceof Error ? ttsError.message : String(ttsError);
          log("warn", `VoiceVox failed after retries — Mock fallback for line ${displayLine}: ${message}`);
          audioBuffer = await new MockProvider().generateAudio(targetText, speaker, displayLine, null, ttsBase);
        } else if (lessonTTSProvider.name === "GeminiTTS") {
          const message = ttsError instanceof Error ? ttsError.message : String(ttsError);
          log("warn", `Gemini TTS failed - Mock fallback for line ${displayLine}: ${message}`);
          audioBuffer = await new MockProvider().generateAudio(targetText, speaker, displayLine, null, ttsBase);
        } else if (lessonTTSProvider.name === "KokoroTTS") {
          const message = ttsError instanceof Error ? ttsError.message : String(ttsError);
          log("warn", `Kokoro TTS failed - Edge fallback for line ${displayLine}: ${message}`);
          audioProvider = new EdgeTTSProvider();
          audioVoice = edgeSpeakerMap[speaker] ?? null;
          audioBuffer = await audioProvider.generateAudio(targetText, speaker, displayLine, audioVoice, ttsBase);
        } else {
          throw ttsError;
        }
      }

      // Upload
      const storageExt = audioProvider.name === "GoogleCloudTTS" || audioProvider.name === "EdgeTTS" ? "mp3" : "wav";
      const contentType = storageExt === "mp3" ? "audio/mpeg" : "audio/wav";
      const storagePath = `${lessonId}/line_${order_index}.${storageExt}`;
      const { error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(storagePath, audioBuffer, { contentType, upsert: true });

      if (uploadError) {
        throw new Error(`Storage upload failed for line ${order_index}: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(storagePath);
      const audioUrl = urlData?.publicUrl;
      if (!audioUrl) throw new Error(`Could not get public URL for: ${storagePath}`);

      // Back-fill audio_url
      const { error: updateLineError } = await supabase
        .from(tables.lines)
        .update({ audio_url: audioUrl })
        .eq("id", lineId);

      if (updateLineError) {
        throw new Error(`Failed to update audio_url for line ${lineId}: ${updateLineError.message}`);
      }

      log("job", `✓ Line ${displayLine} done — ${audioUrl}`);
      return audioUrl;
    });

    // Mark lesson ready — triggers Realtime push to browser
    const { error: readyError } = await supabase
      .from(tables.lessons)
      .update({ status: "ready" })
      .eq("id", lessonId);

    if (readyError) throw new Error(`Failed to set status=ready: ${readyError.message}`);

    log("job", `✅ Lesson ${lessonId} READY. ${lines.length} lines complete.\n`);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log("error", `✗ Lesson ${lessonId} FAILED: ${errorMessage}`);

    const { error: failError } = await supabase
      .from(tables.lessons)
      .update({ status: "failed", error_message: errorMessage.substring(0, 500) })
      .eq("id", lessonId);

    if (failError) {
      log("error", `CRITICAL: Could not update lesson ${lessonId} to 'failed': ${failError.message}`);
    }
  } finally {
    // ── FIX A: Always release the deduplication lock ─────────────
    // The finally block guarantees this runs whether the job succeeded,
    // threw an error, or was even killed mid-flight by an unhandled rejection
    // propagating up. Without this, a failed lesson would stay locked forever
    // and never be retried by the poller.
    processingLessons.delete(lessonId);
  }
}

// ============================================================
// SECTION 5: REALTIME LISTENER
// ============================================================

function startRealtimeListener() {
  log("init", "Subscribing to Supabase Realtime — waiting for lessons...\n");

  const handleLessonUpdate = (tables) => (payload) => {
    const lesson = payload.new;
    if (!lesson?.id || lesson?.status !== "generating_audio") return;

    log("realtime", `Job received from ${tables.lessons} - lesson_id: ${lesson.id} ("${lesson.scenario?.substring(0, 50)}")`);

    processLessonAudio(lesson.id, tables).catch((unhandled) => {
      log("error", `Unhandled rejection in processLessonAudio: ${unhandled.message}`);
    });
  };

  const channel = supabase
    .channel("audio-worker")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "lessons" },
      handleLessonUpdate(LESSON_TABLES.japanese)
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "english_lessons" },
      handleLessonUpdate(LESSON_TABLES.english)
    )
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        log("init", `✅ Realtime channel active. Worker is live.\n`);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        log("error", `Realtime channel error (${status}): ${err?.message ?? "unknown"}`);
      } else if (status === "CLOSED") {
        log("warn", "Realtime channel closed. Restarting in 5s...");
        setTimeout(startRealtimeListener, 5_000);
      }
    });

  return channel;
}

// ============================================================
// SECTION 6: STARTUP & GRACEFUL SHUTDOWN
// ============================================================

async function recoverOrphanedLessons() {
  log("init", "Checking for orphaned lessons...");

  for (const tables of Object.values(LESSON_TABLES)) {
    const { data: orphans, error } = await supabase
      .from(tables.lessons)
      .select("id, scenario, created_at")
      .eq("status", "generating_audio")
      .order("created_at", { ascending: true });

    if (error) { log("warn", `Could not query ${tables.lessons} orphans: ${error.message}`); continue; }
    if (!orphans || orphans.length === 0) { log("init", `No orphaned lessons in ${tables.lessons}.`); continue; }

    log("init", `Found ${orphans.length} orphaned lesson(s) in ${tables.lessons}. Processing...`);
    for (const lesson of orphans) {
      log("init", `Recovering: ${lesson.id} - "${lesson.scenario?.substring(0, 50)}"`);
      await processLessonAudio(lesson.id, tables);
    }
  }
}

/**
 * startOrphanPoller — FIX B
 * ──────────────────────────────────────────────────────────────
 * Supabase Realtime does NOT guarantee delivery. If the worker was running
 * when a lesson entered "generating_audio" and the Realtime event was dropped
 * (WebSocket blip, reconnect race), the lesson stays stuck indefinitely.
 *
 * recoverOrphanedLessons() only runs at startup, so it can't help here.
 *
 * This poller runs every 60 s and looks for lessons that have been in
 * "generating_audio" for more than the configured stale threshold. Any it finds are reprocessed
 * via processLessonAudio(), which is safe to call redundantly because FIX A
 * (processingLessons Set) prevents double-processing if the Realtime event
 * eventually also fires.
 *
 * The default threshold is long enough for larger English lessons and cold TTS
 * starts before the poller considers a job stuck.
 *
 * Note: this requires your lessons table to have an `updated_at` column that
 * Supabase auto-updates on every row write (standard behaviour when you enable
 * the moddatetime extension or set a trigger). If your table uses `created_at`
 * only, change the filter below to use `created_at` instead.
 */
function startOrphanPoller() {
  const POLL_INTERVAL_MS  = 60_000;  // check every 60 s
  const STUCK_THRESHOLD_MS = ORPHAN_STUCK_THRESHOLD_MS;

  log("init", `Orphan poller started — scanning every ${POLL_INTERVAL_MS / 1000}s for lessons stuck > ${STUCK_THRESHOLD_MS / 60_000}min.\n`);

  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();

      for (const tables of Object.values(LESSON_TABLES)) {
        const { lessons: orphans, error, staleColumn } = await fetchStuckGeneratingLessons(tables, cutoff);

        if (error) {
          log("warn", `Orphan poller: ${tables.lessons} query failed - ${error.message}`);
          continue;
        }

        if (!orphans || orphans.length === 0) continue;

        log("warn", `Orphan poller: found ${orphans.length} stuck lesson(s) in ${tables.lessons}. Recovering...`);

        for (const lesson of orphans) {
          log("warn", `Orphan poller: recovering lesson ${lesson.id} - stuck since ${lesson[staleColumn]}`);
          processLessonAudio(lesson.id, tables).catch((err) => {
            log("error", `Orphan poller: recovery failed for ${lesson.id}: ${err.message}`);
          });
        }
      }
    } catch (err) {
      log("error", `Orphan poller: unexpected error — ${err.message}`);
    }
  }, POLL_INTERVAL_MS);
}

function startActiveJobPoller() {
  const POLL_INTERVAL_MS = ACTIVE_JOB_POLL_INTERVAL_MS;

  log("init", `Active job poller started - scanning every ${POLL_INTERVAL_MS / 1000}s for generating_audio lessons.\n`);

  const tick = async () => {
    try {
      for (const tables of Object.values(LESSON_TABLES)) {
        const { lessons, error } = await fetchGeneratingAudioLessons(tables);

        if (error) {
          log("warn", `Active job poller: ${tables.lessons} query failed - ${error.message}`);
          continue;
        }

        for (const lesson of lessons) {
          if (!lesson?.id || processingLessons.has(lesson.id)) continue;

          log("job", `Active job poller: processing ${tables.lessons} lesson ${lesson.id} - "${lesson.scenario?.substring(0, 50)}"`);
          processLessonAudio(lesson.id, tables).catch((err) => {
            log("error", `Active job poller: processing failed for ${lesson.id}: ${err.message}`);
          });
        }
      }
    } catch (err) {
      log("error", `Active job poller: unexpected error - ${err.message}`);
    }
  };

  tick();
  setInterval(tick, POLL_INTERVAL_MS);
}

async function recoverFailedLessons() {
  const cutoff = new Date(Date.now() - FAILED_RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const retryCutoff = new Date(Date.now() - FAILED_RECOVERY_COOLDOWN_MS).toISOString();

  for (const tables of Object.values(LESSON_TABLES)) {
    const { lessons: failedLessons, error } = await fetchRecoverableFailedLessons(tables, cutoff, retryCutoff);

    if (error) {
      log("warn", `Failed-lesson recovery: ${tables.lessons} query failed - ${error.message}`);
      continue;
    }

    if (!failedLessons || failedLessons.length === 0) continue;

    log("warn", `Failed-lesson recovery: found ${failedLessons.length} recoverable lesson(s) in ${tables.lessons}.`);

    for (const lesson of failedLessons) {
    if (!lesson?.id || processingLessons.has(lesson.id)) continue;

    try {
      const { count: lineCount, error: lineCountError } = await supabase
        .from(tables.lines)
        .select("id", { count: "exact", head: true })
        .eq("lesson_id", lesson.id);

      let linesExist = !lineCountError && typeof lineCount === "number" && lineCount > 0;

      if (!linesExist) {
        const lineRows = buildLessonLineRows(lesson.id, lesson.structured_content);
        if (lineRows.length === 0) {
          log("warn", `Failed-lesson recovery: ${lesson.id} has no rebuildable dialogue - skipping.`);
          continue;
        }

        const { error: insertError } = await supabase
          .from(tables.lines)
          .insert(lineRows);

        if (insertError) {
          log("warn", `Failed-lesson recovery: could not rebuild lines for ${lesson.id}: ${insertError.message}`);
          continue;
        }

        linesExist = true;
        log("warn", `Failed-lesson recovery: rebuilt ${lineRows.length} line(s) for ${lesson.id}.`);
      }

      if (!linesExist) continue;

      const { error: requeueError } = await supabase
        .from(tables.lessons)
        .update({ status: "generating_audio", error_message: null })
        .eq("id", lesson.id);

      if (requeueError) {
        log("warn", `Failed-lesson recovery: could not requeue ${lesson.id}: ${requeueError.message}`);
        continue;
      }

      log("warn", `Failed-lesson recovery: requeued ${lesson.id} - "${lesson.scenario?.substring(0, 50)}"`);

      processLessonAudio(lesson.id, tables).catch((err) => {
        log("error", `Failed-lesson recovery: processing failed for ${lesson.id}: ${err.message}`);
      });
    } catch (err) {
      log("error", `Failed-lesson recovery: unexpected error for ${lesson.id}: ${err.message}`);
    }
  }
  }
}

function startFailedLessonRecoveryPoller() {
  const POLL_INTERVAL_MS = 60_000;

  log("init", `Failed-lesson recovery poller started - scanning every ${POLL_INTERVAL_MS / 1000}s for failed lessons from the last ${FAILED_RECOVERY_WINDOW_DAYS} day(s).\n`);

  setInterval(async () => {
    try {
      await recoverFailedLessons();
    } catch (err) {
      log("error", `Failed-lesson recovery poller: unexpected error - ${err.message}`);
    }
  }, POLL_INTERVAL_MS);
}

async function verifyConnection() {
  for (const tables of Object.values(LESSON_TABLES)) {
    const { error } = await supabase.from(tables.lessons).select("id").limit(1);
    if (error) throw new Error(`Supabase connection test failed for ${tables.lessons}: ${error.message}`);
  }
  log("init", "Supabase connection verified ✓");
}

function startHealthServer() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/" || url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        ok: true,
        service: "audio-worker",
        processing: processingLessons.size,
      }));
      return;
    }

    if (url.pathname === "/wake") {
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, message: "wake accepted" }));

      recoverOrphanedLessons().catch((err) => {
        log("error", `Wake recovery failed: ${err.message}`);
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });

  server.listen(WORKER_PORT, "0.0.0.0", () => {
    log("init", `Health/wake server listening on port ${WORKER_PORT}`);
  });

  return server;
}

/**
 * warmVoiceVox
 * ──────────────────────────────────────────────────────────────
 * If local VoiceVox is not running, pings the HF Space at startup
 * so it starts waking up before the first lesson job arrives.
 * This reduces the perceived wait for the first generation.
 */
async function warmVoiceVox() {
  if (TTS_PROVIDER.toLowerCase() !== "voicevox") return;

  const localUp = await isVoiceVoxReachable(VOICEVOX_LOCAL);
  if (localUp) {
    log("init", "Local VoiceVox is running ✓");
    return;
  }

  log("init", "Local VoiceVox offline — pre-warming HF Space in background...");
  // Fire-and-forget. Don't block startup; errors logged but not fatal.
  waitForVoiceVox(VOICEVOX_HF, 60_000)
    .then(() => log("init", "HF Space pre-warmed ✓"))
    .catch(e => log("warn", `HF Space pre-warm failed: ${e.message} (will retry on first job)`));
}

async function main() {
  console.log("=".repeat(60));
  console.log(" Language Learning SaaS — Audio Worker");
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  TTS:      ${ttsProvider.name}`);
  console.log(`  Local:    ${VOICEVOX_LOCAL}`);
  console.log(`  Cloud:    ${VOICEVOX_HF}`);
  console.log(`  Kokoro:   ${KOKORO_TTS_URLS.length} endpoint(s), concurrency=${KOKORO_TTS_CONCURRENCY}`);
  console.log(`  Google:   ${hasGoogleTTSCredentials() ? `credentials configured via ${googleTTSCredentialSource()}` : "credentials missing - English will fall back to Kokoro"}`);
  console.log("=".repeat(60) + "\n");

  try {
    await verifyConnection();
    await warmVoiceVox();
    await recoverOrphanedLessons();
    await recoverFailedLessons();
  } catch (startupError) {
    log("error", `Startup failed: ${startupError.message}`);
    process.exit(1);
  }

  const healthServer = startHealthServer();
  const channel = startRealtimeListener();
  startActiveJobPoller();
  startOrphanPoller(); // FIX B — catches events Realtime misses mid-session
  startFailedLessonRecoveryPoller();

  const shutdown = async (signal) => {
    console.log(`\n[worker] ${signal} received. Shutting down...`);
    healthServer.close();
    await supabase.removeChannel(channel);
    await supabase.removeAllChannels();
    log("init", "Channels closed. Goodbye.");
    process.exit(0);
  };

  process.on("SIGINT",  () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();

// ============================================================
// SECTION 7: UTILITIES
// ============================================================

function log(ns, ...args) {
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 23);
  const colors = {
    init:     "\x1b[36m",
    job:      "\x1b[32m",
    tts:      "\x1b[35m",
    realtime: "\x1b[33m",
    warn:     "\x1b[33m",
    error:    "\x1b[31m",
  };
  const reset = "\x1b[0m";
  const color = colors[ns] ?? "";
  const label = `[${ns.padEnd(8)}]`;
  console.log(`${color}${timestamp} ${label}${reset}`, ...args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
