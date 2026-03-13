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
// Usage:
//   node worker.js
//
// Required .env:
//   SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...
//   TTS_PROVIDER=voicevox   # or "mock"
//   VOICEVOX_URL=http://127.0.0.1:50021
//   VOICEVOX_HF_URL=https://alanweg2-my-voicevox-api.hf.space

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// SECTION 1: ENVIRONMENT VALIDATION
// ============================================================

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
const AUDIO_BUCKET         = "audio";

// ── VoiceVox health helpers ─────────────────────────────────

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
 * FIX: timeout increased from 60 s → 180 s to handle cold starts.
 * Polls every 4 s (was 3 s) to reduce noise in HF logs.
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
 * NEW: Wraps a single VoiceVox request with up to maxAttempts retries
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

// ============================================================
// SECTION 2: SUPABASE CLIENT
// ============================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { heartbeatIntervalMs: 30_000 } },
});

// ============================================================
// SECTION 3: TTS PROVIDERS
// ============================================================

class LocalVoiceVoxProvider {
  name = "LocalVoiceVox";

  speakerIdMap = {
    "Narrator": 3,
    "default":  1,
  };

  getSpeakerId(speaker) {
    const normalized = speaker.trim();
    return (
      this.speakerIdMap[normalized] ??
      this.speakerIdMap[Object.keys(this.speakerIdMap).find(
        (k) => k.toLowerCase() === normalized.toLowerCase()
      )] ??
      this.speakerIdMap["default"]
    );
  }

  /**
   * generateAudio
   * ────────────────────────────────────────────────────────────
   * FIX: synthesis timeout increased 30 s → 60 s.
   * FIX: wrapped in generateWithRetry for transient HF failures.
   */
  async generateAudio(text, speaker, lineIndex, overrideId = null) {
    const speakerId = (overrideId !== null && Number.isInteger(overrideId))
      ? overrideId
      : this.getSpeakerId(speaker);

    log("tts", `Line ${lineIndex} — VoiceVox: speaker='${speaker}' id=${speakerId}${overrideId !== null ? " (override)" : ""} | "${text.substring(0, 30)}..."`);

    const localUp = await isVoiceVoxReachable(VOICEVOX_LOCAL);
    const base    = localUp ? VOICEVOX_LOCAL : VOICEVOX_HF;

    if (!localUp) {
      log("tts", `Line ${lineIndex} — Local offline, using cloud VoiceVox`);
      await waitForVoiceVox(VOICEVOX_HF);
    } else {
      log("tts", `Line ${lineIndex} — Using local VoiceVox`);
    }

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
          signal: AbortSignal.timeout(60_000),   // FIX: was 30_000
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

class MockProvider {
  name = "Mock";

  async generateAudio(text, speaker, lineIndex, overrideId = null) {
    log("tts", `Line ${lineIndex} — Mock TTS for '${speaker}'${overrideId !== null ? ` (override id=${overrideId})` : ""}: "${text.substring(0, 40)}..."`);
    await sleep(200 + Math.random() * 300);
    return Buffer.from([0xff, 0xfb, 0x90]);
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

// ============================================================
// SECTION 4: CORE PROCESSING
// ============================================================

async function processLessonAudio(lessonId) {
  log("job", `▶ Starting audio generation for lesson: ${lessonId}`);

  try {
    const [{ data: lessonMeta, error: metaError }, { data: lines, error: fetchError }] =
      await Promise.all([
        supabase.from("lessons").select("voice_id, structured_content").eq("id", lessonId).single(),
        supabase.from("lesson_lines").select("id, order_index, speaker, kanji").eq("lesson_id", lessonId).order("order_index", { ascending: true }),
      ]);

    if (metaError) throw new Error(`Failed to fetch lesson metadata: ${metaError.message}`);
    if (fetchError) throw new Error(`Failed to fetch lesson lines: ${fetchError.message}`);
    if (!lines || lines.length === 0) throw new Error(`No lesson lines found for lesson ${lessonId}.`);

    const rawVoiceId      = lessonMeta?.voice_id;
    const overrideVoiceId = (rawVoiceId !== null && rawVoiceId !== undefined && Number.isInteger(rawVoiceId))
      ? rawVoiceId
      : null;

    if (overrideVoiceId !== null) {
      log("job", `Voice override: all lines → speaker id=${overrideVoiceId}`);
    }

    const characterVoices  = lessonMeta?.structured_content?.character_voices ?? {};
    const hasCharacterCast = Object.keys(characterVoices).length > 0;

    if (overrideVoiceId === null) {
      if (hasCharacterCast) {
        const castSummary = Object.entries(characterVoices).map(([n, id]) => `${n}→${id}`).join(", ");
        log("job", `Multi-actor cast: ${castSummary}`);
      } else {
        log("job", "No voice cast — falling back to name map.");
      }
    }

    log("job", `Processing ${lines.length} lines...`);

    for (const line of lines) {
      const { id: lineId, order_index, speaker, kanji } = line;
      const storagePath = `${lessonId}/line_${order_index}.wav`;

      log("job", `Line ${order_index + 1}/${lines.length} [${speaker}]`);

      const effectiveSpeakerId =
        overrideVoiceId !== null         ? overrideVoiceId :
        characterVoices[speaker] != null ? characterVoices[speaker] :
        null;

      // Generate audio (with retry built into generateWithRetry)
      let audioBuffer;
      try {
        audioBuffer = await ttsProvider.generateAudio(kanji, speaker, order_index, effectiveSpeakerId);
      } catch (ttsError) {
        // VoiceVox fallback to Mock when truly unreachable
        if (ttsProvider.name === "LocalVoiceVox" &&
           (ttsError.message.includes("timed out") || ttsError.message.includes("unreachable"))) {
          log("warn", `VoiceVox unreachable after retries — Mock fallback for line ${order_index}.`);
          audioBuffer = await new MockProvider().generateAudio(kanji, speaker, order_index);
        } else {
          throw ttsError;
        }
      }

      // Upload
      const { error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(storagePath, audioBuffer, { contentType: "audio/wav", upsert: true });

      if (uploadError) {
        throw new Error(`Storage upload failed for line ${order_index}: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(storagePath);
      const audioUrl = urlData?.publicUrl;
      if (!audioUrl) throw new Error(`Could not get public URL for: ${storagePath}`);

      // Back-fill audio_url
      const { error: updateLineError } = await supabase
        .from("lesson_lines")
        .update({ audio_url: audioUrl })
        .eq("id", lineId);

      if (updateLineError) {
        throw new Error(`Failed to update audio_url for line ${lineId}: ${updateLineError.message}`);
      }

      log("job", `✓ Line ${order_index + 1} done — ${audioUrl}`);
    }

    // Mark lesson ready — triggers Realtime push to browser
    const { error: readyError } = await supabase
      .from("lessons")
      .update({ status: "ready" })
      .eq("id", lessonId);

    if (readyError) throw new Error(`Failed to set status=ready: ${readyError.message}`);

    log("job", `✅ Lesson ${lessonId} READY. ${lines.length} lines complete.\n`);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log("error", `✗ Lesson ${lessonId} FAILED: ${errorMessage}`);

    const { error: failError } = await supabase
      .from("lessons")
      .update({ status: "failed", error_message: errorMessage.substring(0, 500) })
      .eq("id", lessonId);

    if (failError) {
      log("error", `CRITICAL: Could not update lesson ${lessonId} to 'failed': ${failError.message}`);
    }
  }
}

// ============================================================
// SECTION 5: REALTIME LISTENER
// ============================================================

function startRealtimeListener() {
  log("init", "Subscribing to Supabase Realtime — waiting for lessons...\n");

  const channel = supabase
    .channel("audio-worker")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "lessons" },
      (payload) => {
        const lesson = payload.new;
        if (!lesson?.id || lesson?.status !== "generating_audio") return;

        log("realtime", `🔔 Job received — lesson_id: ${lesson.id} ("${lesson.scenario?.substring(0, 50)}")`);

        processLessonAudio(lesson.id).catch((unhandled) => {
          log("error", `Unhandled rejection in processLessonAudio: ${unhandled.message}`);
        });
      }
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

  const { data: orphans, error } = await supabase
    .from("lessons")
    .select("id, scenario, created_at")
    .eq("status", "generating_audio")
    .order("created_at", { ascending: true });

  if (error) { log("warn", `Could not query orphans: ${error.message}`); return; }
  if (!orphans || orphans.length === 0) { log("init", "No orphaned lessons. Clean startup."); return; }

  log("init", `Found ${orphans.length} orphaned lesson(s). Processing...`);
  for (const lesson of orphans) {
    log("init", `Recovering: ${lesson.id} — "${lesson.scenario?.substring(0, 50)}"`);
    await processLessonAudio(lesson.id);
  }
}

async function verifyConnection() {
  const { error } = await supabase.from("lessons").select("id").limit(1);
  if (error) throw new Error(`Supabase connection test failed: ${error.message}`);
  log("init", "Supabase connection verified ✓");
}

/**
 * warmVoiceVox — NEW
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
  console.log(" Japanese Learning SaaS — Audio Worker");
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  TTS:      ${ttsProvider.name}`);
  console.log(`  Local:    ${VOICEVOX_LOCAL}`);
  console.log(`  Cloud:    ${VOICEVOX_HF}`);
  console.log("=".repeat(60) + "\n");

  try {
    await verifyConnection();
    await warmVoiceVox();        // NEW — pre-warm HF Space at startup
    await recoverOrphanedLessons();
  } catch (startupError) {
    log("error", `Startup failed: ${startupError.message}`);
    process.exit(1);
  }

  const channel = startRealtimeListener();

  const shutdown = async (signal) => {
    console.log(`\n[worker] ${signal} received. Shutting down...`);
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
