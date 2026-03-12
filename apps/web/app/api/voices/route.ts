import { NextResponse } from "next/server";

// ============================================================
// GET /api/voices
// ============================================================
//
// Proxies the local VoiceVox engine's GET /speakers endpoint and returns
// a flat, frontend-ready array of available voice entries.
//
// VoiceVox /speakers response shape (abbreviated):
//   [
//     {
//       "name": "四国めたん",
//       "speaker_uuid": "...",
//       "styles": [
//         { "id": 2,  "name": "ノーマル" },
//         { "id": 0,  "name": "あまあま" },
//         ...
//       ],
//       "version": "0.14.4"
//     },
//     ...
//   ]
//
// We flatten this into:
//   [
//     { id: 2,  label: "四国めたん", sublabel: "ノーマル" },
//     { id: 0,  label: "四国めたん", sublabel: "あまあま" },
//     ...
//   ]
//
// This route is intentionally unauthenticated — it returns no user data,
// only the list of installed voices from the developer's local VoiceVox.
// It is called once on ScenePlayer mount and the result is held in state.
//
// Error behaviour:
//   - If VoiceVox is unreachable (ECONNREFUSED / timeout), returns 503 with
//     a descriptive error so the client can log it gracefully.
//   - If VoiceVox returns unexpected JSON, returns 502.
//   - Either way ScenePlayer handles the error non-fatally (console.warn only)
//     so the lesson still plays — voice switching just won't list options.

const VOICEVOX_URL = process.env.VOICEVOX_URL ?? "http://127.0.0.1:50021";

// Shape of a single style entry inside a VoiceVox character object.
interface VoiceVoxStyle {
  id: number;
  name: string;
}

// Shape of a single character object returned by VoiceVox /speakers.
interface VoiceVoxSpeaker {
  name: string;
  styles: VoiceVoxStyle[];
}

// Shape of the flat voice entry we return to the frontend.
export interface VoiceEntry {
  id: number;
  label: string;    // character name  e.g. "四国めたん"
  sublabel: string; // style name      e.g. "ノーマル"
}

export async function GET(): Promise<NextResponse> {
  let raw: Response;

  try {
    raw = await fetch(`${VOICEVOX_URL}/speakers`, {
      method: "GET",
      headers: { Accept: "application/json" },
      // 8-second timeout — VoiceVox is local so anything longer means it's down.
      signal: AbortSignal.timeout(8_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isUnreachable =
      msg.includes("ECONNREFUSED") ||
      msg.includes("fetch failed") ||
      (err as { name?: string }).name === "TimeoutError";

    console.error("[/api/voices] VoiceVox unreachable:", msg);

    return NextResponse.json(
      {
        error: isUnreachable
          ? `VoiceVox is not running at ${VOICEVOX_URL}. Start VoiceVox and reload.`
          : `Failed to contact VoiceVox: ${msg}`,
      },
      { status: 503 }
    );
  }

  if (!raw.ok) {
    const body = await raw.text().catch(() => "(unreadable)");
    console.error(`[/api/voices] VoiceVox returned HTTP ${raw.status}:`, body);
    return NextResponse.json(
      { error: `VoiceVox /speakers returned HTTP ${raw.status}.` },
      { status: 502 }
    );
  }

  let speakers: VoiceVoxSpeaker[];
  try {
    speakers = await raw.json();
  } catch {
    console.error("[/api/voices] VoiceVox /speakers returned non-JSON body.");
    return NextResponse.json(
      { error: "VoiceVox returned an unexpected response format." },
      { status: 502 }
    );
  }

  if (!Array.isArray(speakers)) {
    console.error("[/api/voices] VoiceVox /speakers did not return an array.");
    return NextResponse.json(
      { error: "VoiceVox returned an unexpected response format." },
      { status: 502 }
    );
  }

  // Flatten: one entry per style, sorted by style ID for stable ordering.
  // We preserve insertion order (character order from VoiceVox) and sort
  // styles within each character by id so the list is deterministic.
  const voices: VoiceEntry[] = [];

  for (const speaker of speakers) {
    if (!speaker.name || !Array.isArray(speaker.styles)) continue;

    const sorted = [...speaker.styles].sort((a, b) => a.id - b.id);
    for (const style of sorted) {
      if (typeof style.id !== "number" || !style.name) continue;
      voices.push({
        id: style.id,
        label: speaker.name,
        sublabel: style.name,
      });
    }
  }

  return NextResponse.json(voices, {
    status: 200,
    headers: {
      // Cache for 60 seconds on the client — voices don't change while
      // VoiceVox is running. Stale-while-revalidate for smoother UX.
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
