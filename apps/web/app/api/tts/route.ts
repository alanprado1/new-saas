export const maxDuration = 60; // Gives the API up to 60 seconds to finish


import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { getVoiceVoxUrl, waitForVoiceVox } from "@/lib/voicevox";
import { createClient } from "@/utils/supabase/server";

// ============================================================
// 1. CONSTANTS & HELPERS
// ============================================================

const VOICEVOX_CLOUD = process.env.VOICEVOX_HF_URL ?? "https://alanweg2-my-voicevox-api.hf.space";

// Strips English translations in parentheses so the TTS engine only reads Japanese
function stripEnglishParens(text: string): string {
  return text.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, "").trim();
}

// WAV Header Builder for Gemini's raw PCM audio
const PCM_SR  = 24000;
const PCM_CH  = 1;
const PCM_BPS = 16;

function buildWavHeader(pcmBytes: number): Buffer {
  const byteRate   = PCM_SR * PCM_CH * (PCM_BPS / 8);
  const blockAlign = PCM_CH * (PCM_BPS / 8);
  const h = Buffer.alloc(44);

  h.write("RIFF",              0, "ascii");
  h.writeUInt32LE(36+pcmBytes, 4);
  h.write("WAVE",              8, "ascii");
  h.write("fmt ",             12, "ascii");
  h.writeUInt32LE(16,         16);
  h.writeUInt16LE(1,          20);
  h.writeUInt16LE(PCM_CH,     22);
  h.writeUInt32LE(PCM_SR,     24);
  h.writeUInt32LE(byteRate,   28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(PCM_BPS,    34);
  h.write("data",             36, "ascii");
  h.writeUInt32LE(pcmBytes,   40);

  return h;
}

function wrapAudioBuffer(buf: Buffer): { wav: Buffer; detectedFormat: string } {
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return { wav: buf, detectedFormat: "wav" };
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return { wav: buf, detectedFormat: "mp3-id3" };
  if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) return { wav: buf, detectedFormat: "mp3-sync" };
  if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return { wav: buf, detectedFormat: "ogg" };
  if (buf[0] === 0x46 && buf[1] === 0x4F && buf[2] === 0x52 && buf[3] === 0x4D) return { wav: buf, detectedFormat: "aiff" };
  return { wav: Buffer.concat([buildWavHeader(buf.byteLength), buf]), detectedFormat: "pcm→wav" };
}

// ============================================================
// 2. TTS PROVIDER FUNCTIONS
// ============================================================

// Sentinel error so the handler can distinguish 429 from real failures
class GeminiRateLimitError extends Error {
  constructor(retryAfterSeconds?: number) {
    super(
      retryAfterSeconds
        ? `Gemini TTS daily quota exceeded. Retry in ${Math.ceil(retryAfterSeconds / 3600)}h.`
        : "Gemini TTS daily quota exceeded.",
    );
    this.name = "GeminiRateLimitError";
  }
}

async function callVoiceVox(text: string, speakerId: number): Promise<Buffer> {
  const japanese = stripEnglishParens(text);
  if (!japanese) throw new Error("VoiceVox: no Japanese text after strip.");

  const base = await getVoiceVoxUrl();

  if (base === VOICEVOX_CLOUD) {
    await waitForVoiceVox(base, 60_000);
  }

  const queryRes = await fetch(
    `${base}/audio_query?` + new URLSearchParams({ text: japanese, speaker: String(speakerId) }),
    { method: "POST", signal: AbortSignal.timeout(15_000) },
  );
  if (!queryRes.ok) throw new Error(`VoiceVox audio_query ${queryRes.status} from ${base}`);
  const queryData = await queryRes.json();

  const synthRes = await fetch(`${base}/synthesis?speaker=${speakerId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(queryData),
    signal: AbortSignal.timeout(60_000),
  });
  if (!synthRes.ok) throw new Error(`VoiceVox synthesis ${synthRes.status} from ${base}`);

  return Buffer.from(await synthRes.arrayBuffer());
}

async function callEdgeTTS(text: string, voiceName: string): Promise<Buffer> {
  const japanese = stripEnglishParens(text);
  if (!japanese) throw new Error("Edge TTS: no Japanese text after strip.");

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const { audioStream } = tts.toStream(japanese);
    audioStream.on("data",  (chunk: Buffer) => chunks.push(chunk));
    audioStream.on("end",   ()              => resolve(Buffer.concat(chunks)));
    audioStream.on("error", (err: Error)    => reject(err));
  });
}

async function callGeminiTTS(text: string, voiceName = "Kore"): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const japanese = stripEnglishParens(text);
  if (!japanese) throw new Error("Gemini TTS: no Japanese text after strip.");

  /**
   * 2026 Voice Library:
   * "Kore", "Aoede", "Charon", "Fenrir", "Leda", "Puck"
   * These support 70+ languages including Japanese.
   */
  const validVoices = ["Kore", "Aoede", "Charon", "Fenrir", "Leda", "Puck"];
  const selectedVoice = validVoices.includes(voiceName) ? voiceName : "Kore";

  // Use the latest 3.1 Flash TTS model
  const modelId = "gemini-3.1-flash-tts-preview";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ 
        parts: [{ 
          // You can now include [tags] in the text for 3.1 models
          // e.g., "[enthusiastic] こんにちは！"
          text: japanese 
        }] 
      }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { 
            prebuiltVoiceConfig: { voiceName: selectedVoice } 
          },
        },
      },
    }),
    signal: AbortSignal.timeout(35_000),
  });

  if (!res.ok) {
    if (res.status === 429) {
      const body = await res.text().catch(() => "");
      const match = body.match(/"retryDelay":\s*"(\d+)s"/);
      const retryAfterSeconds = match ? parseInt(match[1], 10) : undefined;
      throw new GeminiRateLimitError(retryAfterSeconds);
    }
    throw new Error(`Gemini TTS ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }

  const data = await res.json();
  const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  
  if (!b64) throw new Error("Gemini TTS: no inlineData.data in response.");

  const raw = Buffer.from(b64, "base64");
  
  // Gemini 3.1 returns standard audio containers; wrapping check remains for safety
  const { wav } = wrapAudioBuffer(raw);
  return wav;
}
// ============================================================
// 3. MAIN API HANDLER
// ============================================================

export async function POST(req: NextRequest) {
  // ── Auth check ────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { text, provider, voice } = body;

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    let audioBuffer: Buffer;

    if (provider === "voicevox") {
      const speakerId = typeof voice === "number" ? voice : (parseInt(voice, 10) || 1);
      audioBuffer = await callVoiceVox(text, speakerId);
    }
    else if (provider === "gemini") {
      const voiceName = typeof voice === "string" && voice ? voice : "Kore";
      try {
        audioBuffer = await callGeminiTTS(text, voiceName);
      } catch (err) {
        if (err instanceof GeminiRateLimitError) {
          // Quota exhausted — silently fall back to Edge TTS
          console.warn(`[TTS API] ${err.message} Falling back to Edge TTS.`);
          audioBuffer = await callEdgeTTS(text, "ja-JP-NanamiNeural");
        } else {
          throw err; // Re-throw real errors
        }
      }
    }
    else if (provider === "edge") {
      const voiceName = typeof voice === "string" && voice ? voice : "ja-JP-NanamiNeural";
      audioBuffer = await callEdgeTTS(text, voiceName);
    }
    else {
      return NextResponse.json({ error: `Unknown TTS provider: ${provider}` }, { status: 400 });
    }

    const audioBase64 = audioBuffer.toString("base64");
    return NextResponse.json({ audioBase64 });

  } catch (error) {
    console.error("[TTS API] Error generating audio:", error);
    return NextResponse.json(
      { error: "Failed to generate TTS audio" },
      { status: 500 },
    );
  }
}