export const maxDuration = 60; // Gives the API up to 60 seconds to finish

import { NextRequest, NextResponse } from "next/server";
import { getVoiceVoxUrl, waitForVoiceVox } from "@/lib/voicevox";
import { createClient } from "@/utils/supabase/server";

// ============================================================
// 1. CONSTANTS & HELPERS
// ============================================================

const VOICEVOX_CLOUD = process.env.VOICEVOX_HF_URL ?? "https://alanweg2-my-voicevox-api.hf.space";

// Strips English translations in parentheses
function stripEnglishParens(text: string): string {
  return text.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, "").trim();
}

// Extracts ONLY Japanese phonetic characters (ignores English/Kanji inside parentheses)
function extractKana(text: string): string {
  return text.replace(/[^\u3040-\u309F\u30A0-\u30FF]/g, "").trim();
}

// Edge & VoiceVox: [漢字](かな) -> "かな" (100% phonetic accuracy)
function convertToPhoneticKana(text: string): string {
  return text.replace(/\[(.*?)\]\((.*?)\)/g, (_, __, reading) => extractKana(reading));
}

// Gemini: [漢字](かな) -> "漢字" (Gemini reads tags aloud if we don't strip them)
function stripFuriganaForGemini(text: string): string {
  return text.replace(/\[(.*?)\]\((.*?)\)/g, "$1");
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
  const base = await getVoiceVoxUrl();
  if (base === VOICEVOX_CLOUD) {
    await waitForVoiceVox(base, 60_000);
  }

  const queryRes = await fetch(
    `${base}/audio_query?` + new URLSearchParams({ text, speaker: String(speakerId) }),
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
  if (!text) throw new Error("Edge TTS: no Japanese text provided.");

  // DYNAMIC IMPORT: Fixes the Vercel jsdom / encoding-lite error
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const { audioStream } = tts.toStream(text);
    audioStream.on("data",  (chunk: Buffer) => chunks.push(chunk));
    audioStream.on("end",   ()              => resolve(Buffer.concat(chunks)));
    audioStream.on("error", (err: Error)    => reject(err));
  });
}

async function callGeminiTTS(text: string, voiceName = "Kore"): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  if (!text) throw new Error("Gemini TTS: no Japanese text provided.");

  const validVoices = ["Kore", "Aoede", "Charon", "Fenrir", "Leda", "Puck"];
  const selectedVoice = validVoices.includes(voiceName) ? voiceName : "Kore";

  const modelId = "gemini-3.1-flash-tts-preview";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
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
  const { wav } = wrapAudioBuffer(raw);
  return wav;
}

// ============================================================
// 3. MAIN API HANDLER
// ============================================================

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { text, provider, voice, reading } = body;

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    let audioBuffer: Buffer;

    if (provider === "voicevox") {
      const speakerId = typeof voice === "number" ? voice : (parseInt(voice, 10) || 1);
      const hasFurigana = text.includes("[") && text.includes("](");
      
      let processedText = text;
      if (hasFurigana) processedText = convertToPhoneticKana(text);
      else if (reading) processedText = extractKana(reading);
      else processedText = stripEnglishParens(text);

      audioBuffer = await callVoiceVox(processedText.trim(), speakerId);
    }
    else if (provider === "gemini") {
      const voiceName = typeof voice === "string" && voice ? voice : "Kore";
      // Gemini gets plain kanji
      const processedText = stripFuriganaForGemini(stripEnglishParens(text));
      
      try {
        audioBuffer = await callGeminiTTS(processedText.trim(), voiceName);
      } catch (err) {
        if (err instanceof GeminiRateLimitError) {
          console.warn(`[TTS API] ${err.message} Falling back to Edge TTS.`);
          const fallbackText = reading ? extractKana(reading) : convertToPhoneticKana(text);
          audioBuffer = await callEdgeTTS(fallbackText.trim(), "ja-JP-NanamiNeural");
        } else {
          throw err; 
        }
      }
    }
    else if (provider === "edge") {
      const voiceName = typeof voice === "string" && voice ? voice : "ja-JP-NanamiNeural";
      const hasFurigana = text.includes("[") && text.includes("](");

      let processedText: string;
      if (hasFurigana) {
        // Edge Accuracy Fix: force 100% phonetic kana
        processedText = convertToPhoneticKana(text);
      } else if (reading) {
        processedText = extractKana(reading);
      } else {
        processedText = stripEnglishParens(text);
      }

      audioBuffer = await callEdgeTTS(processedText.trim(), voiceName);
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