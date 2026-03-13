import { NextResponse } from "next/server";

// ============================================================
// GET /api/voices
// ============================================================
//
// Returns a flat, frontend-ready array of VoiceEntry objects.
//
// Resolution order:
//   1. Ping local VoiceVox (127.0.0.1:50021) with 800 ms timeout.
//   2. If local is up, fetch /speakers from it (8 s timeout).
//   3. If local is down, try the Hugging Face cloud space (8 s timeout).
//   4. If both are unreachable OR return unexpected JSON, return
//      FALLBACK_VOICES (a hardcoded list of 5 popular characters).
//      This guarantees the dropdown is ALWAYS populated.
//
// This route is intentionally self-contained — it does NOT import from
// @/lib/voicevox so that a module-resolution or child_process error in
// that file can never take down this endpoint.
//
// The route always returns HTTP 200 with a valid JSON array.

// ── Types ────────────────────────────────────────────────────

interface VoiceVoxStyle {
  id: number;
  name: string;
}

interface VoiceVoxSpeaker {
  name: string;
  styles: VoiceVoxStyle[];
}

export interface VoiceEntry {
  id: number;
  label: string;    // VoiceVox character name, e.g. "四国めたん"
  sublabel: string; // style name,             e.g. "ノーマル"
}

// ── Fallback voice list ───────────────────────────────────────
// Shown when VoiceVox (local and cloud) is unreachable.
// Must stay in sync with CLIENT_FALLBACK_VOICES in ScenePlayer.tsx
// and FALLBACK_VOICE_POOL in worker.js so voice IDs are consistent
// across every part of the system.
const FALLBACK_VOICES: VoiceEntry[] = [
  { id: 3,  label: "ずんだもん",   sublabel: "ノーマル" },
  { id: 1,  label: "四国めたん",   sublabel: "ノーマル" },
  { id: 8,  label: "春日部つむぎ", sublabel: "ノーマル" },
  { id: 14, label: "冥鳴ひまり",   sublabel: "ノーマル" },
  { id: 2,  label: "四国めたん",   sublabel: "あまあま" },
];

// ── Environment ───────────────────────────────────────────────
const VOICEVOX_LOCAL = process.env.VOICEVOX_LOCAL_URL ?? "http://127.0.0.1:50021";
const VOICEVOX_CLOUD = process.env.VOICEVOX_HF_URL    ?? "https://alanweg2-my-voicevox-api.hf.space";

// ── Helpers ───────────────────────────────────────────────────

/** Returns true if VoiceVox responds to GET /version within timeoutMs. */
async function ping(base: string, timeoutMs: number): Promise<boolean> {
  try {
    const res = await fetch(`${base}/version`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch and flatten the /speakers list from a known-live VoiceVox base.
 * Returns null if the request fails or the response isn't a valid array.
 */
async function fetchSpeakers(base: string): Promise<VoiceEntry[] | null> {
  let raw: Response;
  try {
    raw = await fetch(`${base}/speakers`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (err) {
    console.warn(`[/api/voices] /speakers fetch from ${base} threw:`, err instanceof Error ? err.message : err);
    return null;
  }

  if (!raw.ok) {
    console.warn(`[/api/voices] ${base}/speakers returned HTTP ${raw.status}`);
    return null;
  }

  let speakers: VoiceVoxSpeaker[];
  try {
    speakers = await raw.json();
  } catch {
    console.warn(`[/api/voices] ${base}/speakers returned non-JSON body`);
    return null;
  }

  if (!Array.isArray(speakers)) {
    console.warn(`[/api/voices] ${base}/speakers did not return an array`);
    return null;
  }

  // Flatten: one VoiceEntry per style, sorted by style ID for stable ordering.
  const voices: VoiceEntry[] = [];
  for (const speaker of speakers) {
    if (!speaker.name || !Array.isArray(speaker.styles)) continue;
    const sorted = [...speaker.styles].sort((a, b) => a.id - b.id);
    for (const style of sorted) {
      if (typeof style.id !== "number" || !style.name) continue;
      voices.push({ id: style.id, label: speaker.name, sublabel: style.name });
    }
  }

  return voices.length > 0 ? voices : null;
}

// ── Route handler ─────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  // 1. Try local engine first — fast, no cold-start.
  const localUp = await ping(VOICEVOX_LOCAL, 800);

  if (localUp) {
    const voices = await fetchSpeakers(VOICEVOX_LOCAL);
    if (voices) {
      return NextResponse.json(voices, {
        status: 200,
        headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
      });
    }
    console.warn("[/api/voices] Local VoiceVox was reachable but /speakers failed — trying cloud.");
  } else {
    console.log("[/api/voices] Local VoiceVox not reachable — trying cloud.");
  }

  // 2. Try cloud (Hugging Face Space).
  // We do NOT call waitForVoiceVox() here — this is a fast UI endpoint and
  // we must not block for 60 s waiting for a cold-start. If the space is
  // sleeping, fetchSpeakers will time out after 8 s and we return the fallback.
  const cloudUp = await ping(VOICEVOX_CLOUD, 4_000);

  if (cloudUp) {
    const voices = await fetchSpeakers(VOICEVOX_CLOUD);
    if (voices) {
      return NextResponse.json(voices, {
        status: 200,
        headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
      });
    }
    console.warn("[/api/voices] Cloud VoiceVox was reachable but /speakers failed — returning fallback.");
  } else {
    console.log("[/api/voices] Cloud VoiceVox not reachable — returning fallback voices.");
  }

  // 3. Both unreachable — return the hardcoded fallback so the UI never hangs.
  return NextResponse.json(FALLBACK_VOICES, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
    },
  });
}
