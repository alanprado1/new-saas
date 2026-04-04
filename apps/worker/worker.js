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
//    that have been in "generating_audio" for more than 2 minutes and
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

// ── FIX A: In-flight deduplication guard ────────────────────
// Tracks lesson IDs currently being processed. Prevents two concurrent
// processLessonAudio() calls for the same lesson (e.g. Realtime event +
// orphan poller firing at the same time, or a duplicate Realtime delivery
// after a reconnect). The Set is cleared in the finally block regardless
// of success or failure, so a genuinely failed lesson can be retried.
const processingLessons = new Set();

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

class MockProvider {
  name = "Mock";

  // base param accepted but unused — keeps the call signature uniform with
  // LocalVoiceVoxProvider so processLessonAudio() can call both the same way.
  async generateAudio(text, speaker, lineIndex, overrideId = null, _base) {
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

    // Build the per-speaker voice map using the provider's deduplication logic.
    // This is always derived from unique speakers in the actual lines so it
    // handles both new lessons (character_voices populated) and legacy ones (fallback pool).
    const uniqueSpeakers = [...new Set(lines.map(l => l.speaker))];

    // Build per-speaker map (only used when overrideVoiceId is null)
    const speakerMap = overrideVoiceId !== null
      ? {}  // not needed — every line uses overrideVoiceId
      : (ttsProvider instanceof LocalVoiceVoxProvider
          ? ttsProvider.buildSpeakerMap(uniqueSpeakers, characterVoices)
          : {});

    if (overrideVoiceId === null) {
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
    if (ttsProvider instanceof LocalVoiceVoxProvider) {
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

    log("job", `Processing ${lines.length} lines...`);

    for (const line of lines) {
      const { id: lineId, order_index, speaker, kanji } = line;
      const storagePath = `${lessonId}/line_${order_index}.wav`;

      log("job", `Line ${order_index + 1}/${lines.length} [${speaker}]`);

      // Resolve the effective speaker ID for this line:
      //   - Manual voice override (all lines → same ID)  takes priority.
      //   - Per-speaker map (distinct IDs per character)  is used otherwise.
      const effectiveSpeakerId =
        overrideVoiceId !== null
          ? overrideVoiceId
          : (speakerMap[speaker] ?? 3); // fallback to ずんだもん if somehow missing

      // Generate audio (with retry built into generateWithRetry via generateAudio)
      let audioBuffer;
      try {
        audioBuffer = await ttsProvider.generateAudio(kanji, speaker, order_index, effectiveSpeakerId, ttsBase);
      } catch (ttsError) {
        // VoiceVox fallback to Mock when truly unreachable after all retries
        if (ttsProvider.name === "LocalVoiceVox" &&
           (ttsError.message.includes("timed out") || ttsError.message.includes("unreachable"))) {
          log("warn", `VoiceVox unreachable after retries — Mock fallback for line ${order_index}.`);
          audioBuffer = await new MockProvider().generateAudio(kanji, speaker, order_index, null, ttsBase);
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

  const channel = supabase
    .channel("audio-worker")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "lessons" },
      (payload) => {
        const lesson = payload.new;
        if (!lesson?.id || lesson?.status !== "generating_audio") return;

        log("realtime", `🔔 Job received — lesson_id: ${lesson.id} ("${lesson.scenario?.substring(0, 50)}")`);

        // FIX A applied inside processLessonAudio — duplicate triggers are safe.
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
 * "generating_audio" for more than 2 minutes. Any it finds are reprocessed
 * via processLessonAudio(), which is safe to call redundantly because FIX A
 * (processingLessons Set) prevents double-processing if the Realtime event
 * eventually also fires.
 *
 * The 2-minute threshold is intentionally conservative — it gives the worker
 * enough time to finish a normal job (even with a cold HF space) before the
 * poller considers it stuck.
 *
 * Note: this requires your lessons table to have an `updated_at` column that
 * Supabase auto-updates on every row write (standard behaviour when you enable
 * the moddatetime extension or set a trigger). If your table uses `created_at`
 * only, change the filter below to use `created_at` instead.
 */
function startOrphanPoller() {
  const POLL_INTERVAL_MS  = 60_000;  // check every 60 s
  const STUCK_THRESHOLD_MS = 2 * 60_000; // treat as stuck after 2 minutes

  log("init", `Orphan poller started — scanning every ${POLL_INTERVAL_MS / 1000}s for lessons stuck > ${STUCK_THRESHOLD_MS / 60_000}min.\n`);

  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();

      const { data: orphans, error } = await supabase
        .from("lessons")
        .select("id, scenario, updated_at")
        .eq("status", "generating_audio")
        .lt("updated_at", cutoff);

      if (error) {
        log("warn", `Orphan poller: DB query failed — ${error.message}`);
        return;
      }

      if (!orphans || orphans.length === 0) return; // nothing stuck

      log("warn", `Orphan poller: found ${orphans.length} stuck lesson(s). Recovering...`);

      for (const lesson of orphans) {
        // FIX A (processingLessons) will skip this if the lesson is actively
        // being processed. No lock contention, no double-processing.
        log("warn", `Orphan poller: recovering lesson ${lesson.id} — stuck since ${lesson.updated_at}`);
        processLessonAudio(lesson.id).catch((err) => {
          log("error", `Orphan poller: recovery failed for ${lesson.id}: ${err.message}`);
        });
      }
    } catch (err) {
      log("error", `Orphan poller: unexpected error — ${err.message}`);
    }
  }, POLL_INTERVAL_MS);
}

async function verifyConnection() {
  const { error } = await supabase.from("lessons").select("id").limit(1);
  if (error) throw new Error(`Supabase connection test failed: ${error.message}`);
  log("init", "Supabase connection verified ✓");
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
  console.log(" Japanese Learning SaaS — Audio Worker");
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  TTS:      ${ttsProvider.name}`);
  console.log(`  Local:    ${VOICEVOX_LOCAL}`);
  console.log(`  Cloud:    ${VOICEVOX_HF}`);
  console.log("=".repeat(60) + "\n");

  try {
    await verifyConnection();
    await warmVoiceVox();
    await recoverOrphanedLessons();
  } catch (startupError) {
    log("error", `Startup failed: ${startupError.message}`);
    process.exit(1);
  }

  const channel = startRealtimeListener();
  startOrphanPoller(); // FIX B — catches events Realtime misses mid-session

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