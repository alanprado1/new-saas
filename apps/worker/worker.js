// worker.js
// Local PC Audio Worker — runs on the developer's machine, never on Vercel.
// Listens for Supabase Realtime events and generates TTS audio for each lesson line.
//
// Usage:
//   node worker.js
//
// Required .env file in the same directory:
//   SUPABASE_URL=https://qzxaiuussclxzlzvxuig.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
//   TTS_PROVIDER=voicevox        # or "mock" for dry-run testing
//   VOICEVOX_URL=http://127.0.0.1:50021  # VoiceVox default port

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// SECTION 1: ENVIRONMENT VALIDATION
// Fail loudly at startup — not silently mid-job.
// ============================================================

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[worker] FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const SUPABASE_URL          = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TTS_PROVIDER          = process.env.TTS_PROVIDER ?? "voicevox";
const VOICEVOX_URL          = process.env.VOICEVOX_URL ?? "http://127.0.0.1:50021";
const AUDIO_BUCKET       = "audio";

// ============================================================
// SECTION 2: SUPABASE CLIENT
// Uses the SERVICE KEY to bypass RLS for all read/write ops.
// This key must NEVER be exposed to the browser or committed to git.
// ============================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    // Disable session persistence — this is a server-side script.
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      // Increase heartbeat to reduce noise in terminal logs.
      heartbeatIntervalMs: 30_000,
    },
  },
});

// ============================================================
// SECTION 3: TTS PROVIDER — INTERFACE & IMPLEMENTATIONS
// ============================================================

/**
 * TTSProvider interface.
 * Any class that implements this can be swapped in as the audio backend.
 *
 * @typedef {Object} TTSProvider
 * @property {string} name          - Human-readable provider name for logging.
 * @property {(text: string, speaker: string, lineIndex: number) => Promise<Buffer>} generateAudio
 */

// --- 3a. LocalVoiceVoxProvider ---
// Implements the real two-step VoiceVox HTTP API (https://voicevox.hiroshiba.jp/).
//
// VoiceVox synthesis is a two-phase protocol:
//   Step 1 — POST /audio_query?text=...&speaker=<id>
//             Returns a JSON "audio query" object describing pitch, speed, etc.
//   Step 2 — POST /synthesis?speaker=<id>  (body = audio query JSON)
//             Returns raw WAV bytes (audio/wav).
//
// VoiceVox outputs WAV, not MP3. Supabase Storage accepts WAV fine;
// update contentType to "audio/wav" and storage paths to .wav accordingly.
// Howler.js supports WAV natively, so no transcoding is needed for the MVP.

class LocalVoiceVoxProvider {
  name = "LocalVoiceVox";

  // VoiceVox built-in speaker IDs (subset — see GET /speakers for full list).
  // Odd IDs = normal style, even IDs often = alternate style for same character.
  //   1  = 四国めたん (Shikoku Metan)   — female, bright
  //   3  = ずんだもん (Zundamon)         — female, energetic
  //   2  = 四国めたん あまあま            — softer variant
  //   8  = 春日部つむぎ (Kasukabe Tsumugi) — female, calm
  //  13  = 青山龍星 (Aoyama Ryusei)     — male, deep
  //  14  = 冥鳴ひまり (Meimei Himari)   — female, quiet
  speakerIdMap = {
    "Narrator":  3,   // Zundamon — energetic narrator voice
    "default":   1,   // Shikoku Metan — fallback for any unmapped character name
  };

  /**
   * Returns the VoiceVox speaker ID for a given character name.
   * Matching is case-insensitive so "hana" and "Hana" resolve the same way.
   * @param {string} speaker
   * @returns {number}
   */
  getSpeakerId(speaker) {
    const normalized = speaker.trim();
    // Exact match first, then case-insensitive, then default.
    return (
      this.speakerIdMap[normalized] ??
      this.speakerIdMap[Object.keys(this.speakerIdMap).find(
        (k) => k.toLowerCase() === normalized.toLowerCase()
      )] ??
      this.speakerIdMap["default"]
    );
  }

  /**
   * Calls VoiceVox in two steps and returns a WAV audio Buffer.
   *
   * @param {string} text            - Japanese text (kanji/kana) to synthesize.
   * @param {string} speaker         - Character name from the lesson_lines row.
   * @param {number} lineIndex       - Used for logging only.
   * @param {number|null} overrideId - When non-null, use this speaker ID directly
   *                                   instead of the character-name mapping.
   *                                   Set by the user via the voice-changer UI.
   * @returns {Promise<Buffer>}
   */
  async generateAudio(text, speaker, lineIndex, overrideId = null) {
    // User-selected voice takes absolute priority over the name map.
    const speakerId = (overrideId !== null && Number.isInteger(overrideId))
      ? overrideId
      : this.getSpeakerId(speaker);

    log("tts", `Line ${lineIndex} — VoiceVox: speaker='${speaker}' id=${speakerId}${overrideId !== null ? " (voice override)" : ""} | "${text.substring(0, 30)}..."`);

    // ── Step 1: Generate audio query ──────────────────────────
    let audioQuery;
    try {
      const queryRes = await fetch(
        `${VOICEVOX_URL}/audio_query?` + new URLSearchParams({ text, speaker: String(speakerId) }),
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

      audioQuery = await queryRes.json();
    } catch (err) {
      if (err.name === "TimeoutError" || err.message?.includes("fetch failed") || err.cause?.code === "ECONNREFUSED") {
        throw new Error(
          `VoiceVox server unreachable at ${VOICEVOX_URL}. ` +
          `Is VoiceVox running? Launch it and ensure port 50021 is open. (${err.message})`
        );
      }
      throw err;
    }

    log("tts", `Line ${lineIndex} — Audio query received. Running synthesis...`);

    // ── Step 2: Synthesize WAV from audio query ────────────────
    const synthRes = await fetch(
      `${VOICEVOX_URL}/synthesis?` + new URLSearchParams({ speaker: String(speakerId) }),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "audio/wav" },
        body: JSON.stringify(audioQuery),
        // Synthesis is CPU/GPU bound — allow up to 30s for long lines.
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!synthRes.ok) {
      const body = await synthRes.text().catch(() => "(unreadable)");
      throw new Error(`/synthesis returned HTTP ${synthRes.status} for line ${lineIndex}: ${body}`);
    }

    const arrayBuffer = await synthRes.arrayBuffer();

    if (arrayBuffer.byteLength === 0) {
      throw new Error(`VoiceVox synthesis returned an empty audio buffer for line ${lineIndex}.`);
    }

    log("tts", `Line ${lineIndex} — WAV received: ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB`);
    return Buffer.from(arrayBuffer);
  }
}

// --- 3b. MockProvider ---
// Returns a minimal valid MP3 buffer so the entire pipeline
// (upload → public URL → DB update → status ready) can be tested
// without any local TTS server running.
// The 3-byte sequence is a valid (silent) ID3v2 header stub.

class MockProvider {
  name = "Mock";

  async generateAudio(text, speaker, lineIndex, overrideId = null) {
    log("tts", `Line ${lineIndex} — Mock TTS for '${speaker}'${overrideId !== null ? ` (voice override id=${overrideId})` : ""}: "${text.substring(0, 40)}..."`);

    // Simulate a realistic TTS latency so you can observe pipeline timing.
    await sleep(200 + Math.random() * 300);

    // Minimal non-empty buffer — enough for Supabase Storage to accept the upload.
    return Buffer.from([0xff, 0xfb, 0x90]);
  }
}

// --- 3c. Provider Factory ---
// Selects the active provider based on TTS_PROVIDER env var.
// Falls back to Mock if Voicebox is selected but unreachable (handled at call site).

function createTTSProvider() {
  switch (TTS_PROVIDER.toLowerCase()) {
    case "voicevox":
      log("init", `TTS provider: LocalVoiceVox (${VOICEVOX_URL})`);
      return new LocalVoiceVoxProvider();
    case "mock":
      log("init", "TTS provider: Mock (dry-run mode — no audio server required)");
      return new MockProvider();
    default:
      log("warn", `Unknown TTS_PROVIDER '${TTS_PROVIDER}'. Falling back to Mock.`);
      return new MockProvider();
  }
}

const ttsProvider = createTTSProvider();

// ============================================================
// SECTION 4: CORE PROCESSING FUNCTION
// ============================================================

/**
 * Fetches all lesson lines for a lesson, generates TTS audio for each,
 * uploads to Supabase Storage, back-fills audio_url, and marks the
 * lesson as 'ready'. On any failure, marks the lesson as 'failed'.
 *
 * @param {string} lessonId - UUID of the lesson to process.
 */
async function processLessonAudio(lessonId) {
  log("job", `▶ Starting audio generation for lesson: ${lessonId}`);

  try {
    // --- 4.1 Fetch lesson metadata (for voice_id) and all lesson lines -----
    //
    // voice_id on the lessons row is set when the user picks a specific voice
    // in the UI. When non-null it overrides the character-name → speaker-ID
    // mapping so every line is spoken by the user's chosen VoiceVox voice.
    // We fetch it once here and pass it to every generateAudio call below.
    const [{ data: lessonMeta, error: metaError }, { data: lines, error: fetchError }] =
      await Promise.all([
        supabase
          .from("lessons")
          .select("voice_id, structured_content")
          .eq("id", lessonId)
          .single(),
        supabase
          .from("lesson_lines")
          .select("id, order_index, speaker, kanji")
          .eq("lesson_id", lessonId)
          .order("order_index", { ascending: true }),
      ]);

    if (metaError) throw new Error(`Failed to fetch lesson metadata: ${metaError.message}`);
    if (fetchError) throw new Error(`Failed to fetch lesson lines: ${fetchError.message}`);
    if (!lines || lines.length === 0) throw new Error(`No lesson lines found for lesson ${lessonId}.`);

    // voice_id contract:
    //   NULL    → use AI per-character cast from structured_content.character_voices
    //             (default for all newly generated lessons)
    //   integer → user explicitly chose a single voice via the UI dropdown;
    //             flatten every line to this speaker ID, ignoring the cast
    //
    // Using === null (not ?? null) so that voice_id = 0 (a valid VoiceVox ID)
    // is correctly treated as an override rather than falling through to the cast.
    const rawVoiceId      = lessonMeta?.voice_id;
    const overrideVoiceId = (rawVoiceId !== null && rawVoiceId !== undefined && Number.isInteger(rawVoiceId))
      ? rawVoiceId
      : null;

    if (overrideVoiceId !== null) {
      log("job", `Voice override active: all lines will use speaker id=${overrideVoiceId} (user-selected, ignores per-character cast)`);
    }

    // Extract the AI-assigned per-character voice map from structured_content.
    // Populated by Gemini when available_voices was supplied at generation time.
    // e.g. { "Chef": 13, "Customer": 8, "Narrator": 3 }
    const characterVoices  = lessonMeta?.structured_content?.character_voices ?? {};
    const hasCharacterCast = Object.keys(characterVoices).length > 0;

    if (overrideVoiceId === null) {
      if (hasCharacterCast) {
        const castSummary = Object.entries(characterVoices)
          .map(([name, id]) => `${name}→${id}`)
          .join(", ");
        log("job", `Multi-actor cast: ${castSummary}`);
      } else {
        log("job", "No voice cast found — falling back to character name map.");
      }
    }

    log("job", `Found ${lines.length} lines to process.`);

    // --- 4.2 Process each line sequentially ---
    // Sequential (not parallel) to avoid overloading a local TTS GPU/CPU
    // and to keep Supabase Storage upload rate predictable.
    for (const line of lines) {
      const { id: lineId, order_index, speaker, kanji } = line;
      const storagePath = `${lessonId}/line_${order_index}.wav`;

      log("job", `Processing line ${order_index + 1}/${lines.length} [${speaker}]`);

      // --- 4.2a Resolve effective speaker ID — three-tier priority ──────────
      // 1. overrideVoiceId  — user flattened to a single voice via UI (non-null)
      // 2. characterVoices  — AI-assigned per-character voice from structured_content
      // 3. null             — falls through to getSpeakerId() name-map in generateAudio
      //
      // characterVoices[speaker] can legitimately be 0 (valid VoiceVox ID),
      // so we use != null (covers both null and undefined) not a falsy check.
      const effectiveSpeakerId =
        overrideVoiceId !== null               ? overrideVoiceId :
        characterVoices[speaker] != null       ? characterVoices[speaker] :
        null;

      // --- 4.2b Generate audio buffer via TTS provider ---
      let audioBuffer;
      try {
        audioBuffer = await ttsProvider.generateAudio(kanji, speaker, order_index, effectiveSpeakerId);
      } catch (ttsError) {
        // If Voicebox is unreachable and we're not in mock mode,
        // attempt a one-time fallback to the mock provider so the
        // pipeline doesn't fully halt during early development.
        if (ttsProvider.name === "LocalVoiceVox" && ttsError.message.includes("unreachable")) {
          log("warn", `VoiceVox unreachable — falling back to Mock for line ${order_index}.`);
          audioBuffer = await new MockProvider().generateAudio(kanji, speaker, order_index);
        } else {
          throw ttsError;
        }
      }

      // --- 4.2b Upload buffer to Supabase Storage ---
      const { error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(storagePath, audioBuffer, {
          contentType: "audio/wav",
          upsert: true, // Idempotent — safe to re-run if the worker crashed mid-job.
        });

      if (uploadError) {
        throw new Error(`Storage upload failed for line ${order_index}: ${uploadError.message}`);
      }

      // --- 4.2c Get the public URL ---
      // getPublicUrl is synchronous and always returns a URL if the bucket is public.
      const { data: urlData } = supabase.storage
        .from(AUDIO_BUCKET)
        .getPublicUrl(storagePath);

      const audioUrl = urlData?.publicUrl;
      if (!audioUrl) {
        throw new Error(`Could not retrieve public URL for path: ${storagePath}`);
      }

      // --- 4.2d Back-fill audio_url on the lesson_lines row ---
      const { error: updateLineError } = await supabase
        .from("lesson_lines")
        .update({ audio_url: audioUrl })
        .eq("id", lineId);

      if (updateLineError) {
        throw new Error(`Failed to update audio_url for line ${lineId}: ${updateLineError.message}`);
      }

      log("job", `✓ Line ${order_index + 1} complete — ${audioUrl}`);
    }

    // --- 4.3 Mark lesson as ready — triggers the Realtime push to the browser ---
    const { error: readyError } = await supabase
      .from("lessons")
      .update({ status: "ready" })
      .eq("id", lessonId);

    if (readyError) {
      throw new Error(`Failed to set lesson status to 'ready': ${readyError.message}`);
    }

    log("job", `✅ Lesson ${lessonId} is READY. All ${lines.length} lines processed.\n`);

  } catch (err) {
    // --- 4.4 Failure path: update lesson status and preserve the error message ---
    const errorMessage = err instanceof Error ? err.message : String(err);
    log("error", `✗ Lesson ${lessonId} FAILED: ${errorMessage}`);

    const { error: failError } = await supabase
      .from("lessons")
      .update({
        status: "failed",
        // Truncate to match the DB column capacity and avoid silent insert failures.
        error_message: errorMessage.substring(0, 500),
      })
      .eq("id", lessonId);

    if (failError) {
      // This is a secondary failure — the lesson is stuck in 'generating_audio'.
      // Log loudly so it shows up in terminal output for manual recovery.
      log("error", `CRITICAL: Could not update lesson ${lessonId} to 'failed': ${failError.message}`);
    }
  }
}

// ============================================================
// SECTION 5: REALTIME LISTENER
// ============================================================

/**
 * Subscribes to Postgres changes on the lessons table.
 * Fires processLessonAudio whenever a lesson transitions to 'generating_audio'.
 *
 * IMPORTANT — Why there is NO filter on the channel:
 * Supabase Realtime column filters (e.g. filter: "status=eq.generating_audio")
 * require the table to have REPLICA IDENTITY set to FULL. The default is
 * REPLICA IDENTITY DEFAULT, which only exposes the primary key in the
 * change payload — not the column values — so Supabase silently drops any
 * filtered event that can't be evaluated. This is the root cause of lessons
 * getting stuck until the worker restarts and the orphan-recovery query runs.
 *
 * Fix: Remove the filter from the channel. Listen to ALL lesson UPDATEs and
 * apply the status guard in the JavaScript callback instead. This works
 * correctly regardless of replica identity settings.
 *
 * Alternative fix (if you prefer the channel filter): run this SQL once in
 * Supabase SQL Editor:
 *   ALTER TABLE public.lessons REPLICA IDENTITY FULL;
 * Then you can restore the filter safely.
 */
function startRealtimeListener() {
  log("init", "Subscribing to Supabase Realtime — waiting for lessons...\n");

  const channel = supabase
    .channel("audio-worker")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "lessons",
        // No filter here — see explanation above. Guard is in the callback.
      },
      (payload) => {
        const lesson = payload.new;

        // Only act on the specific transition we care about.
        if (!lesson?.id || lesson?.status !== "generating_audio") {
          return;
        }

        log("realtime", `🔔 Received job — lesson_id: ${lesson.id} (scenario: "${lesson.scenario?.substring(0, 50)}")`);

        // Fire-and-forget: don't await here so the Realtime event loop isn't blocked.
        processLessonAudio(lesson.id).catch((unhandled) => {
          log("error", `Unhandled rejection in processLessonAudio: ${unhandled.message}`);
        });
      }
    )
    .subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        log("init", `✅ Realtime channel active. Worker is live and listening.\n`);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        log("error", `Realtime channel error (${status}): ${err?.message ?? "unknown"}`);
        log("error", "Worker will attempt to reconnect automatically via Supabase client...");
      } else if (status === "CLOSED") {
        log("warn", "Realtime channel closed. Attempting to restart in 5s...");
        setTimeout(startRealtimeListener, 5_000);
      }
    });

  // Surface the channel object for graceful shutdown.
  return channel;
}

// ============================================================
// SECTION 6: STARTUP & GRACEFUL SHUTDOWN
// ============================================================

/**
 * Checks whether there are any orphaned lessons stuck in 'generating_audio'
 * from a previous worker session that crashed. Processes them on startup
 * so they don't sit stuck forever.
 */
async function recoverOrphanedLessons() {
  log("init", "Checking for orphaned lessons from previous sessions...");

  const { data: orphans, error } = await supabase
    .from("lessons")
    .select("id, scenario, created_at")
    .eq("status", "generating_audio")
    .order("created_at", { ascending: true });

  if (error) {
    log("warn", `Could not query for orphaned lessons: ${error.message}`);
    return;
  }

  if (!orphans || orphans.length === 0) {
    log("init", "No orphaned lessons found. Clean startup.");
    return;
  }

  log("init", `Found ${orphans.length} orphaned lesson(s). Processing now...`);

  for (const lesson of orphans) {
    log("init", `Recovering: ${lesson.id} — "${lesson.scenario?.substring(0, 50)}"`);
    // Process sequentially to avoid hammering the TTS server on startup.
    await processLessonAudio(lesson.id);
  }
}

/**
 * Verifies the Supabase connection before starting the Realtime listener.
 * Avoids a confusing situation where the worker appears to start but is
 * silently disconnected.
 */
async function verifyConnection() {
  const { error } = await supabase.from("lessons").select("id").limit(1);
  if (error) {
    throw new Error(`Supabase connection test failed: ${error.message}`);
  }
  log("init", "Supabase connection verified ✓");
}

async function main() {
  console.log("=".repeat(60));
  console.log(" Japanese Learning SaaS — Local Audio Worker");
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  TTS:      ${ttsProvider.name}`);
  console.log("=".repeat(60) + "\n");

  try {
    await verifyConnection();
    await recoverOrphanedLessons();
  } catch (startupError) {
    log("error", `Startup failed: ${startupError.message}`);
    process.exit(1);
  }

  const channel = startRealtimeListener();

  // --- Graceful Shutdown ---
  // Ensures the Realtime channel is cleanly unsubscribed on Ctrl+C
  // rather than leaving a dangling connection on Supabase's side.
  const shutdown = async (signal) => {
    console.log(`\n[worker] ${signal} received. Shutting down gracefully...`);
    await supabase.removeChannel(channel);
    await supabase.removeAllChannels();
    log("init", "Realtime channels closed. Goodbye.");
    process.exit(0);
  };

  process.on("SIGINT",  () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();

// ============================================================
// SECTION 7: UTILITIES
// ============================================================

/**
 * Structured logger with consistent timestamp + namespace formatting.
 * @param {"init"|"job"|"tts"|"realtime"|"warn"|"error"} ns
 * @param {...any} args
 */
function log(ns, ...args) {
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 23);
  const namespaceColors = {
    init:     "\x1b[36m",   // cyan
    job:      "\x1b[32m",   // green
    tts:      "\x1b[35m",   // magenta
    realtime: "\x1b[33m",   // yellow
    warn:     "\x1b[33m",   // yellow
    error:    "\x1b[31m",   // red
  };
  const reset  = "\x1b[0m";
  const color  = namespaceColors[ns] ?? "";
  const label  = `[${ns.padEnd(8)}]`;
  console.log(`${color}${timestamp} ${label}${reset}`, ...args);
}

/**
 * Promise-based sleep helper.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
