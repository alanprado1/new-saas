import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { getVoiceVoxUrl, waitForVoiceVox } from "@/lib/voicevox";
import { createClient } from "@/utils/supabase/server";

const SYSTEM_PROMPT =
  "You are a highly energetic, cutesy, and playful Japanese anime character! " +
  "Your personality is funny, slightly dramatic, and incredibly cheerful, just like a popular anime protagonist. " +
  "Use casual, cute Japanese speech patterns (like ending sentences with '〜だよね！', '〜だよ！', or '〜かも！'). " +
  "Keep your answers brief (1-3 sentences max), highly expressive, and fun. " +
  "CONVERSATION RULE: You are a chat companion. ALWAYS end your response by asking a relevant follow-up question or prompting the user to keep the conversation going naturally. Never let the conversation die! " +
  "CRITICAL RULE: You MUST follow this exact format for EVERY response, no exceptions: " +
  "Japanese sentence first, then immediately the English translation in parentheses. " +
  "Example: 'ええっ、本当！？すごいすごい！次はどうするの？ (Eeeh, really!? That's amazing! What are we doing next?)' " +
  "Example: 'ふふん、私に任せてよね！君の一番好きなことは何？ (Hehe, just leave it to me! What is your favorite thing to do?)' " +
  "NEVER respond with Japanese only. NEVER respond with English only. " +
  "ALWAYS include both. The parenthesised English translation is mandatory on every single message.";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

// ── LLM helpers ───────────────────────────────────────────────

function toGeminiHistory(messages: IncomingMessage[]) {
  return messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

function toOpenAIMessages(messages: IncomingMessage[]) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];
}

async function callGeminiText(messages: IncomingMessage[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: toGeminiHistory(messages),
        generationConfig: { maxOutputTokens: 512, temperature: 1.0 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini text ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini text: empty response.");
  return text.trim();
}

async function callGroqText(messages: IncomingMessage[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set.");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: toOpenAIMessages(messages),
      max_tokens: 512,
      temperature: 1.0,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  const data = await res.json();
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq: empty response.");
  return text.trim();
}

// ── VoiceVox ──────────────────────────────────────────────────

const VOICEVOX_CLOUD = process.env.VOICEVOX_HF_URL ?? "https://alanweg2-my-voicevox-api.hf.space";

function stripEnglishParens(text: string): string {
  return text.replace(/\s*\([^)]*[a-zA-Z][^)]*\)/g, "").trim();
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
    { method: "POST", signal: AbortSignal.timeout(15_000) }
  );
  if (!queryRes.ok) throw new Error(`VoiceVox audio_query ${queryRes.status}`);
  
  const queryData = await queryRes.json();

  queryData.intonationScale = 1.18; 
  queryData.pitchScale = 0.05;      
  queryData.speedScale = 1.0;      

  const synthRes = await fetch(`${base}/synthesis?speaker=${speakerId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(queryData),
    signal: AbortSignal.timeout(60_000),
  });
  if (!synthRes.ok) throw new Error(`VoiceVox synthesis ${synthRes.status}`);
  
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
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
    return { wav: buf, detectedFormat: "wav" };
  }
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    return { wav: buf, detectedFormat: "mp3-id3" };
  }
  if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) {
    return { wav: buf, detectedFormat: "mp3-sync" };
  }
  if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
    return { wav: buf, detectedFormat: "ogg" };
  }
  if (buf[0] === 0x46 && buf[1] === 0x4F && buf[2] === 0x52 && buf[3] === 0x4D) {
    return { wav: buf, detectedFormat: "aiff" };
  }
  return { wav: Buffer.concat([buildWavHeader(buf.byteLength), buf]), detectedFormat: "pcm→wav" };
}

async function callGeminiTTS(text: string, voiceName = "Kore"): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const japanese = stripEnglishParens(text);
  if (!japanese) throw new Error("Gemini TTS: no Japanese text after strip.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: japanese }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
          },
        },
      }),
      signal: AbortSignal.timeout(35000),
    }
  );
  if (!res.ok) throw new Error(`Gemini TTS ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  const data = await res.json();

  const mimeType: string = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType ?? "unknown";
  const b64: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error("Gemini TTS: no inlineData.data in response.");

  const raw = Buffer.from(b64, "base64");
  if (raw.byteLength === 0) throw new Error("Gemini TTS: empty audio buffer.");

  const hex8 = Array.from(raw.subarray(0, 8)).map(b => b.toString(16).padStart(2, "0")).join(" ");
  console.log(`[avatar] Gemini TTS raw: mimeType=${mimeType} bytes=${raw.byteLength} first8=${hex8}`);

  if (mimeType.includes("L16") || mimeType.includes("l16") || mimeType.includes("raw")) {
    const wav = Buffer.concat([buildWavHeader(raw.byteLength), raw]);
    console.log(`[avatar] Gemini TTS: mimeType declared PCM → wrapped as WAV ${wav.byteLength} bytes`);
    return wav;
  }

  const { wav, detectedFormat } = wrapAudioBuffer(raw);
  console.log(`[avatar] Gemini TTS: detectedFormat=${detectedFormat} → output=${wav.byteLength} bytes`);
  return wav;
}

// ── TTS router ────────────────────────────────────────────────

async function generateAudio(
  text: string,
  speakerId: number,
  clientTtsProvider: "voicevox" | "gemini" | "edge",
  geminiVoice: string,
  edgeVoice: string,
): Promise<{ audioBase64: string | null; ttsProvider: "voicevox" | "gemini-tts" | "edge-tts" | "none" }> {

  if (clientTtsProvider === "edge") {
    try {
      const buf = await callEdgeTTS(text, edgeVoice);
      return { audioBase64: buf.toString("base64"), ttsProvider: "edge-tts" };
    } catch (e) {
      console.warn("[avatar] Fallback triggered: Edge TTS failed → trying VoiceVox.", e instanceof Error ? e.message : e);
    }
    try {
      const wav = await callVoiceVox(text, speakerId);
      return { audioBase64: wav.toString("base64"), ttsProvider: "voicevox" };
    } catch (e) {
      console.warn("[avatar] Fallback triggered: VoiceVox also failed. No audio.", e instanceof Error ? e.message : e);
    }

  } else if (clientTtsProvider === "gemini") {
    try {
      const wav = await callGeminiTTS(text, geminiVoice);
      return { audioBase64: wav.toString("base64"), ttsProvider: "gemini-tts" };
    } catch (e) {
      console.warn("[avatar] Fallback triggered: Gemini TTS failed → trying VoiceVox.", e instanceof Error ? e.message : e);
    }
    try {
      const wav = await callVoiceVox(text, speakerId);
      return { audioBase64: wav.toString("base64"), ttsProvider: "voicevox" };
    } catch (e) {
      console.warn("[avatar] Fallback triggered: VoiceVox also failed. No audio.", e instanceof Error ? e.message : e);
    }

  } else {
    try {
      const wav = await callVoiceVox(text, speakerId);
      return { audioBase64: wav.toString("base64"), ttsProvider: "voicevox" };
    } catch (e) {
      console.warn("[avatar] Fallback triggered: VoiceVox failed → trying Edge TTS.", e instanceof Error ? e.message : e);
    }
    try {
      const buf = await callEdgeTTS(text, edgeVoice);
      return { audioBase64: buf.toString("base64"), ttsProvider: "edge-tts" };
    } catch (e) {
      console.warn("[avatar] Fallback triggered: Edge TTS also failed → trying Gemini TTS.", e instanceof Error ? e.message : e);
    }
    try {
      const wav = await callGeminiTTS(text, geminiVoice);
      return { audioBase64: wav.toString("base64"), ttsProvider: "gemini-tts" };
    } catch (e) {
      console.warn("[avatar] Fallback triggered: Gemini TTS also failed. No audio.", e instanceof Error ? e.message : e);
    }
  }

  return { audioBase64: null, ttsProvider: "none" };
}

// ── POST /api/avatar ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth check ────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let messages: IncomingMessage[];
  let voiceId: number;
  let clientTtsProvider: "voicevox" | "gemini" | "edge";
  let geminiVoice: string;
  let edgeVoice: string;
  try {
    const body = await req.json();
    messages          = body?.messages;
    voiceId           = typeof body?.voiceId === "number" ? body.voiceId : 1;
    clientTtsProvider = body?.ttsProvider === "gemini" ? "gemini"
                      : body?.ttsProvider === "edge"   ? "edge"
                      : "voicevox";
    geminiVoice       = typeof body?.geminiVoice === "string" && body.geminiVoice
                          ? body.geminiVoice : "Kore";
    edgeVoice         = typeof body?.edgeVoice === "string" && body.edgeVoice
                          ? body.edgeVoice : "ja-JP-NanamiNeural";
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array required." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // LLM — Groq first (ultra-low latency), fall back to Gemini
  let text: string;
  let provider: "gemini" | "groq";
  try {
    text = await callGroqText(messages); provider = "groq";
  } catch (e) {
    console.warn("[avatar] Groq text failed → Gemini fallback.", e instanceof Error ? e.message : e);
    try {
      text = await callGeminiText(messages); provider = "gemini";
    } catch (e2) {
      console.error("[avatar] Gemini also failed.", e2 instanceof Error ? e2.message : e2);
      return NextResponse.json({ error: "Both AI providers unavailable." }, { status: 502 });
    }
  }

  // TTS
  const { audioBase64, ttsProvider } = await generateAudio(text, voiceId, clientTtsProvider, geminiVoice, edgeVoice);

  return NextResponse.json({ text, audioBase64, provider, ttsProvider });
}
