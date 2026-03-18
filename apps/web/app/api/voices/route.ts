import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// ============================================================
// GET /api/voices
// ============================================================

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
  label: string;
  sublabel: string;
}

// ── Fallback voice list ───────────────────────────────────────
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
  // ── Auth check ────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // 3. Both unreachable — return the hardcoded fallback.
  return NextResponse.json(FALLBACK_VOICES, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
    },
  });
}
