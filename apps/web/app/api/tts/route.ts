export const maxDuration = 60; // Gives the API up to 60 seconds to finish

import { NextRequest, NextResponse } from "next/server";
import { getVoiceVoxUrl, waitForVoiceVox } from "@/lib/voicevox";
import { createClient } from "@/utils/supabase/server";
import { furiganaToSpeechText } from "@/lib/tts-text";
import {
  LANGUAGE_PROVIDER_REGISTRY,
  getLanguageDirectionConfig,
  resolveLearningDirection,
  type LanguageCode,
  type TTSProvider,
} from "@/lib/language";

// ============================================================
// 1. CONSTANTS & HELPERS
// ============================================================

const VOICEVOX_CLOUD = process.env.VOICEVOX_HF_URL ?? "https://alanweg2-my-voicevox-api.hf.space";
const KOKORO_TTS_URL = process.env.KOKORO_TTS_URL ?? "https://alanweg2-kokoro-tts-api.hf.space";
const KOKORO_DEFAULT_VOICE = "af_heart";

// Strips English translations in parentheses
function stripEnglishParens(text: string): string {
  return text.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, "").trim();
}

// Extracts ONLY Japanese phonetic characters (ignores English/Kanji inside parentheses)
function extractKana(text: string): string {
  return text.replace(/[^\u3040-\u309F\u30A0-\u30FF]/g, "").trim();
}

function hiraganaToKatakana(text: string): string {
  return text.replace(/[\u3041-\u3096]/g, char =>
    String.fromCharCode(char.charCodeAt(0) + 0x60),
  );
}

function readingToPronunciationText(reading: unknown): string {
  return typeof reading === "string" ? hiraganaToKatakana(extractKana(reading)) : "";
}

// [漢字](かな) -> "漢字" (TTS reads tags aloud if we don't strip them)
function stripFuriganaToSurface(text: string): string {
  return text.replace(/\[(.*?)\]\((.*?)\)/g, "$1");
}

// ============================================================
// 2. TTS PROVIDER FUNCTIONS
// ============================================================

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
  if (!text) throw new Error("Edge TTS: no text provided.");

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

async function callKokoroTTS(text: string, voiceName = KOKORO_DEFAULT_VOICE, speed = 1): Promise<Buffer> {
  if (!text) throw new Error("Kokoro TTS: no text provided.");

  const validVoices = ["af_heart", "af_bella", "af_sarah", "af_sky", "am_adam", "am_michael"];
  const selectedVoice = validVoices.includes(voiceName) ? voiceName : KOKORO_DEFAULT_VOICE;
  const token = process.env.HF_TOKEN;

  const res = await fetch(`${KOKORO_TTS_URL.replace(/\/$/, "")}/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      text,
      voice: selectedVoice,
      speed,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    throw new Error(`Kokoro TTS ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }

  return Buffer.from(await res.arrayBuffer());
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
    const { text, provider, voice, reading, learningDirection, targetLanguage } = body;

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const directionConfig = getLanguageDirectionConfig(resolveLearningDirection(learningDirection));
    const requestedTargetLanguage: LanguageCode = targetLanguage === "en" || targetLanguage === "ja"
      ? targetLanguage
      : directionConfig.targetLanguage;
    const bodyProvider: TTSProvider | undefined =
      provider === "voicevox" || provider === "edge" || provider === "kokoro"
        ? provider
        : undefined;
    const requestedProvider =
      requestedTargetLanguage === "en"
        ? "edge"
        : bodyProvider ?? LANGUAGE_PROVIDER_REGISTRY.tts[requestedTargetLanguage];

    let audioBuffer: Buffer;

    if (requestedProvider === "voicevox") {
      const speakerId = typeof voice === "number" ? voice : (parseInt(voice, 10) || 1);
      const hasFurigana = text.includes("[") && text.includes("](");
      
      let processedText = text;
      if (hasFurigana) processedText = furiganaToSpeechText(text, "surface");
      else if (reading) processedText = extractKana(reading);
      else processedText = stripEnglishParens(text);

      audioBuffer = await callVoiceVox(processedText.trim(), speakerId);
    }
    else if (requestedProvider === "edge") {
      const voiceName = typeof voice === "string" && voice
        ? voice
        : requestedTargetLanguage === "en" ? "en-US-AriaNeural" : "ja-JP-NanamiNeural";
      const cleanText = stripEnglishParens(text);
      const processedText = readingToPronunciationText(reading) || (
        requestedTargetLanguage === "ja"
          ? furiganaToSpeechText(cleanText)
          : stripFuriganaToSurface(cleanText)
      );

      audioBuffer = await callEdgeTTS(processedText.trim(), voiceName);
    }
    else if (requestedProvider === "kokoro") {
      const voiceName = typeof voice === "string" && voice ? voice : KOKORO_DEFAULT_VOICE;
      const processedText = stripFuriganaToSurface(stripEnglishParens(text));

      try {
        audioBuffer = await callKokoroTTS(processedText.trim(), voiceName);
      } catch (err) {
        console.warn("[TTS API] Kokoro TTS failed. Falling back to Edge TTS.", err instanceof Error ? err.message : err);
        audioBuffer = await callEdgeTTS(processedText.trim(), "en-US-AriaNeural");
      }
    }
    else {
      return NextResponse.json({ error: `Unknown TTS provider: ${requestedProvider}` }, { status: 400 });
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
