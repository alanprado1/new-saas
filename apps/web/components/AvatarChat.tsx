"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type Theme, type VoiceEntry } from "@/components/ScenePlayer";

// ============================================================
// TYPES
// ============================================================

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AvatarChatProps {
  theme:   Theme;
  onClose: () => void;
}

interface AvatarApiResponse {
  text:        string;
  audioBase64: string | null;
  provider:    string;
  ttsProvider: "voicevox" | "gemini-tts" | "edge-tts" | "none";
}

// ============================================================
// AUDIO HELPERS
// ============================================================

// Decode a base64 WAV and play it through the Web Audio API.
// Returns a Promise that resolves when playback naturally ends.
// onSource: optional callback called with the AudioBufferSourceNode so the
//           caller can track and stop it on unmount (prevents ghost audio).
async function playBase64Wav(
  base64: string,
  ctx: AudioContext,
  onSource?: (src: AudioBufferSourceNode) => void
): Promise<void> {
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
  return new Promise((resolve, reject) => {
    const source   = ctx.createBufferSource();
    source.buffer  = audioBuffer;
    source.onended = () => resolve();
    source.connect(ctx.destination);
    source.start(0);
    // Expose source so caller can stop it on unmount
    onSource?.(source);
    ctx.addEventListener("statechange", function onStateChange() {
      if (ctx.state === "closed" || ctx.state === "suspended") {
        ctx.removeEventListener("statechange", onStateChange);
        reject(new Error(`AudioContext state changed to: ${ctx.state}`));
      }
    });
  });
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function LoadingDots({ accent }: { accent: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          display: "inline-block", width: "8px", height: "8px",
          borderRadius: "50%", background: accent,
          animation: `avatarDotPulse 1.2s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
  );
}

function AvatarCircle({ theme, isSpeaking }: { theme: Theme; isSpeaking: boolean }) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      {/* Pulsing ring while speaking */}
      <div style={{
        position: "absolute", inset: "-10px", borderRadius: "50%",
        border: `2px solid ${theme.accent}`,
        opacity: isSpeaking ? 0.55 : 0,
        transition: "opacity 0.3s ease",
        animation: isSpeaking ? "avatarRingPulse 1.5s ease-in-out infinite" : "none",
        pointerEvents: "none",
      }} />
      <div style={{
        width:  "clamp(120px, 18vw, 180px)",
        height: "clamp(120px, 18vw, 180px)",
        borderRadius: "50%",
        background: `radial-gradient(circle at 38% 38%, ${theme.accentMid}, ${theme.accentLow} 70%, rgba(0,0,0,0.6) 100%)`,
        border: `2px solid ${isSpeaking ? theme.accent : theme.accentMid}`,
        boxShadow: isSpeaking
          ? `0 0 60px ${theme.accentGlow}, 0 0 100px ${theme.accentLow}, inset 0 0 32px rgba(0,0,0,0.5)`
          : `0 0 48px ${theme.accentLow}, inset 0 0 32px rgba(0,0,0,0.5)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "border-color 0.3s ease, box-shadow 0.3s ease",
      }}>
        <svg width="45%" height="45%" viewBox="0 0 40 44" fill="none" style={{ opacity: 0.35 }}>
          <ellipse cx="20" cy="13" rx="9" ry="9" fill={theme.accent} />
          <path d="M2 42c0-9.94 8.06-18 18-18s18 8.06 18 18"
            stroke={theme.accent} strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    </div>
  );
}

// ── TtsPicker ─────────────────────────────────────────────────
// Gear icon → panel with two sections: VoiceVox + Gemini TTS.
// "provider" is stored as a string: "voicevox" | "gemini".
// voiceVoxId is the numeric VoiceVox speaker ID.
// geminiVoice is the Gemini TTS voice name string.
const GEMINI_VOICES = [
  { name: "Kore",     label: "Kore",     desc: "Firm" },
  { name: "Charon",   label: "Charon",   desc: "Informative" },
  { name: "Fenrir",   label: "Fenrir",   desc: "Excitable" },
  { name: "Aoede",    label: "Aoede",    desc: "Breezy" },
  { name: "Puck",     label: "Puck",     desc: "Upbeat" },
  { name: "Leda",     label: "Leda",     desc: "Youthful" },
  { name: "Orus",     label: "Orus",     desc: "Firm" },
  { name: "Zephyr",   label: "Zephyr",   desc: "Bright" },
];

const EDGE_VOICES = [
  { name: "ja-JP-NanamiNeural", label: "Nanami",  desc: "Female · Friendly" },
  { name: "ja-JP-KeitaNeural",  label: "Keita",   desc: "Male · Natural" },
  { name: "ja-JP-AoiNeural",    label: "Aoi",     desc: "Female · Bright" },
  { name: "ja-JP-DaichiNeural", label: "Daichi",  desc: "Male · Casual" },
  { name: "ja-JP-MayuNeural",   label: "Mayu",    desc: "Female · Soft" },
  { name: "ja-JP-NaokiNeural",  label: "Naoki",   desc: "Male · Calm" },
  { name: "ja-JP-ShioriNeural", label: "Shiori",  desc: "Female · Warm" },
];

function TtsPicker({ theme, voiceVoxVoices, ttsProvider, setTtsProvider, voiceVoxId, setVoiceVoxId, geminiVoice, setGeminiVoice, edgeVoice, setEdgeVoice }: {
  theme: Theme;
  voiceVoxVoices: VoiceEntry[];
  ttsProvider: "voicevox" | "gemini" | "edge";
  setTtsProvider: (p: "voicevox" | "gemini" | "edge") => void;
  voiceVoxId: number;
  setVoiceVoxId: (id: number) => void;
  geminiVoice: string;
  setGeminiVoice: (v: string) => void;
  edgeVoice: string;
  setEdgeVoice: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selectedVvVoice  = voiceVoxVoices.find(v => v.id === voiceVoxId);
  const selectedGem      = GEMINI_VOICES.find(v => v.name === geminiVoice) ?? GEMINI_VOICES[0];
  const selectedEdge     = EDGE_VOICES.find(v => v.name === edgeVoice) ?? EDGE_VOICES[0];

  const rowStyle = (active: boolean): React.CSSProperties => ({
    width: "100%", display: "flex", alignItems: "center",
    justifyContent: "space-between", padding: "7px 12px",
    cursor: "pointer", textAlign: "left",
    background: active ? theme.accentMid : "transparent",
    border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
    transition: "background 0.1s ease",
  });

  const PROVIDERS: { id: "voicevox" | "gemini" | "edge"; label: string }[] = [
    { id: "edge",     label: "Edge TTS" },
    { id: "voicevox", label: "VoiceVox" },
    { id: "gemini",   label: "Gemini"   },
  ];

  return (
    <div ref={ref} style={{ position: "relative", userSelect: "none" }}>
      {/* Gear button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="TTS Settings"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "36px", height: "36px", borderRadius: "10px", cursor: "pointer",
          background: open ? theme.accentMid : "rgba(255,255,255,0.05)",
          border: open ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.1)",
          color: open ? theme.accent : "#4a5568",
          transition: "all 0.15s ease",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="3" />
          <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", right: 0,
          width: "270px",
          background: "rgba(10,10,22,0.98)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.8)", zIndex: 50,
          animation: "avatarFadeIn 0.12s ease both",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "10px 14px 6px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "#4a5568", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              TTS Provider
            </p>
          </div>

          {/* Three-way provider toggle */}
          <div style={{ display: "flex", padding: "8px 10px", gap: "5px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {PROVIDERS.map(p => (
              <button key={p.id} onClick={() => setTtsProvider(p.id)} style={{
                flex: 1, padding: "5px 0", borderRadius: "7px", cursor: "pointer",
                fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.03em",
                background: ttsProvider === p.id ? theme.accentMid : "rgba(255,255,255,0.04)",
                border: ttsProvider === p.id ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.07)",
                color: ttsProvider === p.id ? theme.accent : "#4a5568",
                transition: "all 0.15s ease",
              }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Edge TTS voices */}
          {ttsProvider === "edge" && (
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {EDGE_VOICES.map(v => (
                <button key={v.name}
                  onClick={() => { setEdgeVoice(v.name); setOpen(false); }}
                  style={rowStyle(v.name === edgeVoice)}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = v.name === edgeVoice ? theme.accentMid : "transparent"; }}
                >
                  <span style={{ fontSize: "0.8rem", color: v.name === edgeVoice ? theme.accent : "#e0e8f0", fontFamily: "'Noto Sans JP', sans-serif" }}>
                    {v.label}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "#4a5568" }}>{v.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* VoiceVox voices */}
          {ttsProvider === "voicevox" && (
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {voiceVoxVoices.length === 0 ? (
                <p style={{ padding: "12px 14px", margin: 0, fontSize: "0.75rem", color: "#4a5568" }}>
                  VoiceVox offline — switch to Edge TTS
                </p>
              ) : voiceVoxVoices.map(v => (
                <button key={v.id}
                  onClick={() => { setVoiceVoxId(v.id); setOpen(false); }}
                  style={rowStyle(v.id === voiceVoxId)}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = v.id === voiceVoxId ? theme.accentMid : "transparent"; }}
                >
                  <span style={{ fontSize: "0.8rem", color: v.id === voiceVoxId ? theme.accent : "#e0e8f0", fontFamily: "'Noto Sans JP', sans-serif" }}>
                    {v.label}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "#4a5568" }}>{v.sublabel}</span>
                </button>
              ))}
            </div>
          )}

          {/* Gemini TTS voices */}
          {ttsProvider === "gemini" && (
            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
              {GEMINI_VOICES.map(v => (
                <button key={v.name}
                  onClick={() => { setGeminiVoice(v.name); setOpen(false); }}
                  style={rowStyle(v.name === geminiVoice)}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = v.name === geminiVoice ? theme.accentMid : "transparent"; }}
                >
                  <span style={{ fontSize: "0.8rem", color: v.name === geminiVoice ? theme.accent : "#e0e8f0" }}>
                    {v.label}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "#4a5568" }}>{v.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* Footer showing current selection */}
          <div style={{ padding: "7px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ margin: 0, fontSize: "0.7rem", color: "#3a4458" }}>
              {ttsProvider === "edge"
                ? `Edge TTS · ${selectedEdge.label} (${selectedEdge.desc})`
                : ttsProvider === "voicevox"
                ? `VoiceVox · ${selectedVvVoice?.label ?? "—"}`
                : `Gemini TTS · ${selectedGem.label} (${selectedGem.desc})`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUBTITLE PARSER
// Splits 'Japanese text (English translation)' into two parts.
// ============================================================

function parseSubtitle(text: string): { japanese: string; english: string | null } {
  // Find the LAST '(' in the string — everything before it is Japanese,
  // everything after it is the (possibly truncated) English translation.
  // This is intentionally forgiving: if the LLM cuts off the closing ')'
  // (e.g. "(I don't know that! Which song do") we still get a clean split
  // instead of dumping the whole string into the Japanese line.
  const lastParen = text.lastIndexOf("(");
  if (lastParen !== -1) {
    const japanese = text.slice(0, lastParen).trim();
    // Strip any trailing closing-paren or period that the LLM may or may not
    // have included, then trim whitespace.
    const english  = text.slice(lastParen + 1).replace(/[).]+$/, "").trim();
    // Only accept the split if the Japanese side is non-empty and the English
    // side contains at least one Latin letter (guards against Japanese text
    // that happens to include a '(' for punctuation reasons).
    if (japanese && /[a-zA-Z]/.test(english)) {
      return { japanese, english };
    }
  }
  return { japanese: text.trim(), english: null };
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function AvatarChat({ theme, onClose }: AvatarChatProps) {

  // ── State ─────────────────────────────────────────────────
  const [messages,   setMessages]   = useState<Message[]>([{
    role: "assistant",
    content: "こんにちは！今日は何を練習しますか？ (Hello! What would you like to practise today?)",
  }]);
  const [input,      setInput]      = useState("");
  const [isLoading,  setIsLoading]  = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted,    setIsMuted]    = useState(false);

  // ── Persistent subtitle ──────────────────────────────────
  const [lastSubtitle, setLastSubtitle] = useState<string>(
    "\u3053\u3093\u306b\u3061\u306f\uff01\u4eca\u65e5\u306f\u4f55\u3092\u7df4\u7fd2\u3057\u307e\u3059\u304b\uff1f (Hello! What would you like to practise today?)"
  );

  // ── Mic / STT state ───────────────────────────────────────
  // isRecording    = mic is open, capturing audio
  // isTranscribing = audio sent to Groq, waiting for response (button locked)
  const [isRecording,    setIsRecording]    = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError,       setMicError]       = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // ── TTS selection ────────────────────────────────────────
  const [voices,       setVoices]       = useState<VoiceEntry[]>([]);
  const [ttsProvider, setTtsProvider] = useState<"gemini" | "edge" | "voicevox">(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("pref_ttsProvider") as any) || "edge";
    return "edge";
  });
  const [voiceVoxId, setVoiceVoxId] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pref_voiceVoxId");
      return stored ? parseInt(stored, 10) : 1;
    }
    return 1;
  });
  const [geminiVoice, setGeminiVoice] = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("pref_geminiVoice") || "Kore";
    return "Kore";
  });
  const [edgeVoice, setEdgeVoice] = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("pref_edgeVoice") || "ja-JP-NanamiNeural";
    return "ja-JP-NanamiNeural";
  });

  useEffect(() => { localStorage.setItem("pref_ttsProvider", ttsProvider); }, [ttsProvider]);
  useEffect(() => { localStorage.setItem("pref_geminiVoice", geminiVoice); }, [geminiVoice]);
  useEffect(() => { localStorage.setItem("pref_edgeVoice", edgeVoice); }, [edgeVoice]);
  useEffect(() => { localStorage.setItem("pref_voiceVoxId", voiceVoxId.toString()); }, [voiceVoxId]);

  // ── Refs ──────────────────────────────────────────────────
  const inputRef       = useRef<HTMLInputElement>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  // Track the currently-playing AudioBufferSourceNode so we can stop it
  // immediately on unmount — prevents ghost audio when navigating away.
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  // messagesRef: always mirrors latest messages — prevents stale closures
  const messagesRef    = useRef<Message[]>([]);
  // processUserMessageRef: mirrors the latest processUserMessage callback.
  // onstop inside startListening calls this ref instead of the function
  // directly, so it always gets the current version even if voiceId changed
  // after recording started. This is the fix for the stale-closure bug where
  // the mic appears to do nothing after clicking stop.
  const processUserMessageRef = useRef<(text: string) => Promise<void>>(async () => {});

  // ── Keep refs in sync ────────────────────────────────────
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // ── Fetch voices ──────────────────────────────────────────
  useEffect(() => {
    fetch("/api/voices")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: VoiceEntry[]) => { if (Array.isArray(data)) setVoices(data); })
      .catch(() => {});
  }, []);

  // ── Auto-focus ────────────────────────────────────────────
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if (!isLoading && !isRecording) inputRef.current?.focus(); }, [isLoading, isRecording]);

  // ── AudioContext (lazy, created on first user gesture) ────
  const getAudioCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  useEffect(() => {
    return () => {
      // 1. Stop any currently-playing audio source immediately
      try {
        if (activeSourceRef.current) {
          activeSourceRef.current.onended = null; // prevent resolve() after stop
          activeSourceRef.current.stop();
          activeSourceRef.current.disconnect();
          activeSourceRef.current = null;
        }
      } catch { /* source already stopped */ }
      // 2. Close the AudioContext — releases OS audio resources
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, []);

  // ── Derived ───────────────────────────────────────────────
  const isBusy = isLoading || isSpeaking; // isRecording no longer blocks text input

  // ── playAudio ─────────────────────────────────────────────
  const playAudio = useCallback(async (base64: string) => {
    if (isMuted) return;
    const ctx = getAudioCtx();
    setIsSpeaking(true);
    try {
      await playBase64Wav(base64, ctx, (src) => {
        activeSourceRef.current = src;
        src.onended = () => { activeSourceRef.current = null; };
      });
    } catch (e) {
      console.warn("[AvatarChat] Audio playback error:", e);
    } finally {
      setIsSpeaking(false);
    }
  }, [isMuted, getAudioCtx]);

  // ══════════════════════════════════════════════════════════
  // processUserMessage — single pipeline for text + voice
  // ══════════════════════════════════════════════════════════
  const processUserMessage = useCallback(async (userText: string) => {
    const newMessages = [...messagesRef.current, { role: "user" as const, content: userText }];
    setMessages(newMessages);
    setIsLoading(true);
    try {
      const res = await fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          voiceId:     ttsProvider === "voicevox" ? voiceVoxId : null,
          ttsProvider: ttsProvider,
          geminiVoice: ttsProvider === "gemini" ? geminiVoice : undefined,
          edgeVoice:   ttsProvider === "edge"   ? edgeVoice   : undefined,
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text().catch(() => "")}`);
      const data: AvatarApiResponse = await res.json();
      console.log("[AvatarChat] /api/avatar responded:", data.provider, data.ttsProvider, JSON.stringify(data.text));
      // Text-first: subtitle appears immediately, audio plays after
      setMessages(prev => [...prev, { role: "assistant", content: data.text }]);
      setLastSubtitle(data.text);
      setIsLoading(false);
      if (data.audioBase64) await playAudio(data.audioBase64);
    } catch (err) {
      console.error("[AvatarChat]", err);
      const errMsg = "すみません、エラーが発生しました。 (Sorry, something went wrong.)";
      setMessages(prev => [...prev, { role: "assistant", content: errMsg }]);
      setLastSubtitle(errMsg);
      setIsLoading(false);
    }
  }, [ttsProvider, voiceVoxId, geminiVoice, edgeVoice, playAudio]);

  // Keep the ref in sync so onstop closures always call the latest version
  useEffect(() => { processUserMessageRef.current = processUserMessage; }, [processUserMessage]);

  // ── Text input send ───────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || isSpeaking) return;
    setInput("");
    await processUserMessage(trimmed);
  }, [input, isLoading, isSpeaking, processUserMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  // ══════════════════════════════════════════════════════════
  // MIC — simple click-to-start / click-to-stop.
  // No session concept, no refs for active state.
  // Three clear phases: idle → recording → transcribing → idle.
  // ══════════════════════════════════════════════════════════

  // ── Whisper hallucination filter ─────────────────────────
  // IMPORTANT: Do NOT use \w or strip characters before checking length.
  // \w only matches ASCII — it strips ALL Japanese characters, making
  // every valid Japanese response appear empty (length 0 → phantom).
  // Instead: trim whitespace only, check raw length, then compare
  // the lowercased ASCII-only version against known English phantoms.
  function isPhantomTranscription(raw: string): boolean {
    const trimmed = raw.trim();
    // Reject truly empty or single-character noise
    if (trimmed.length < 2) return true;
    // Reject [bracketed] metadata tokens like [Music], [Silence], [Applause]
    if (/^\[.*\]$/.test(trimmed)) return true;
    // Only apply the English phantom list to responses that are
    // entirely ASCII (i.e. no Japanese/CJK characters present)
    const hasJapanese = /[　-鿿＀-￯]/.test(trimmed);
    if (hasJapanese) return false; // never reject Japanese speech
    const lower = trimmed.toLowerCase();
    const PHANTOMS = new Set([
      "thank you.", "thanks.", "bye.", "goodbye.", "okay.", "ok.",
      "thank you", "thanks", "bye", "goodbye", "okay", "ok",
      "yes", "no", "sure", "right", "alright", "hmm", "um",
      "uh", "ah", "oh", "well", "so", "yeah", "yep", "nope",
      "subtitles by", "translated by", "you you",
      "thank you so much.", "thank you very much.",
      "thank you so much", "thank you very much",
    ]);
    return PHANTOMS.has(lower);
  }

  // ── chooseMimeType ────────────────────────────────────────
  function chooseMimeType(): string {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    for (const t of candidates) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  }

  // ── startListening ────────────────────────────────────────
  // Phase 1 → 2: idle → recording.
  // Sets up the MediaRecorder with a 100ms timeslice so chunks
  // accumulate continuously — onstop always has data to work with.
  const startListening = useCallback(async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = chooseMimeType();

      // Local closure array — not a shared ref, so re-entrant calls can't stomp it
      const chunks: Blob[] = [];
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      // onstop fires AFTER the final ondataavailable (guaranteed by spec).
      // This is the ONLY place we build the Blob and call Groq.
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);

        const blob = new Blob(chunks, { type: mimeType || "audio/webm" });

        console.log("[AvatarChat] onstop fired. chunks:", chunks.length, "blob size:", blob.size, "bytes");

        if (blob.size < 500) {
          // Too small — silence or noise, not worth sending
          console.log("[AvatarChat] Blob too small — skipped");
          setIsTranscribing(false);
          return;
        }

        // Phase 2 → 3: recording → transcribing (button locks here)
        setIsTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("file", blob, "audio.webm");

          const res = await fetch("/api/avatar/transcribe", { method: "POST", body: fd });
          if (!res.ok) {
            const errBody = await res.text().catch(() => res.statusText);
            throw new Error(`Transcription ${res.status}: ${errBody}`);
          }

          const { text } = await res.json();
          const trimmed = (text as string).trim();

          console.log("[AvatarChat] Whisper returned:", JSON.stringify(trimmed));

          if (!trimmed) {
            console.log("[AvatarChat] Empty transcript — skipping");
          } else if (isPhantomTranscription(trimmed)) {
            console.log("[AvatarChat] Phantom transcript filtered:", trimmed);
          } else {
            console.log("[AvatarChat] Sending to AI:", trimmed);
            await processUserMessageRef.current(trimmed);
          }
        } catch (err) {
          console.error("[AvatarChat] STT error:", err);
          setMicError("Could not transcribe — please try again.");
        } finally {
          // Phase 3 → 1: always unlock button regardless of outcome
          setIsTranscribing(false);
        }
      };

      mr.onerror = (ev) => {
        console.error("[AvatarChat] MediaRecorder error:", ev);
        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        setIsTranscribing(false);
        setMicError("Recording error — please try again.");
      };

      // 100ms timeslice: ondataavailable fires continuously,
      // so onstop always has chunks regardless of browser quirks
      mr.start(100);
      mediaRecorderRef.current = mr;
      setIsRecording(true);

    } catch (err) {
      console.error("[AvatarChat] Mic access error:", err);
      setMicError("Microphone access denied. Please allow mic permissions.");
    }
  }, []); // no deps — uses refs for all external values

  // ── stopListening ─────────────────────────────────────────
  // Phase 2 → onstop: flush encoder buffer then stop.
  // Blob assembly and Groq call happen entirely inside onstop.
  const stopListening = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === "inactive") return;
    mr.stop();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") mr.stop();
    };
  }, []);

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{
      /* When rendered on its own page (/voicechat) the parent <main>
         takes care of background. position:fixed + inset:0 still works
         because the voicechat page has no other content to cover. */
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(4,4,14,0.98)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "space-between",
      overflow: "hidden",
      maxWidth: "100vw",            // ← prevent mobile horizontal overflow
      animation: "avatarFadeIn 0.22s ease both",
      fontFamily: "'Noto Sans JP', sans-serif",
    }}>

      {/* Background glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: `radial-gradient(ellipse 70% 50% at 50% 30%, rgba(${theme.accentRgb},0.055), transparent)`,
      }} />

      {/* ── TOP BAR ─────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 10, width: "100%",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1.1rem 1.4rem 0", flexShrink: 0,
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "7px 16px", borderRadius: "10px", cursor: "pointer",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          color: "#6b7a8d", fontSize: "0.8rem", fontWeight: 500,
          letterSpacing: "0.04em", transition: "all 0.15s ease",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.11)"; (e.currentTarget as HTMLElement).style.color = "#c0cad8"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "#6b7a8d"; }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l8 8M9 1L1 9" />
          </svg>
          Close
        </button>
      </div>

      {/* ── AVATAR + SUBTITLE ───────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 10, flex: 1,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: "clamp(1.5rem, 4vh, 2.8rem)",
        padding: "0 2rem", width: "100%", maxWidth: "720px", margin: "0 auto",
      }}>
        <AvatarCircle theme={theme} isSpeaking={isSpeaking} />

        {/* Subtitle — ALWAYS visible, never replaced by recording state */}
        <div style={{ minHeight: "80px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", width: "100%" }}>
          {isLoading ? (
            <LoadingDots accent={theme.accent} />
          ) : (() => {
            const { japanese, english } = parseSubtitle(lastSubtitle);
            return (
              <div key={lastSubtitle} style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: "0.4rem",
                animation: "avatarSubtitleIn 0.3s ease both",
                textAlign: "center", width: "100%",
              }}>
                {/* Japanese — large, bold, Story Mode shadow */}
                <p style={{
                  fontFamily: "'Noto Sans JP', sans-serif",
                  fontSize: "clamp(1.15rem, 2.8vw, 1.65rem)",
                  fontWeight: 700,
                  color: "#ffffff",
                  textShadow: "0 2px 12px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,1)",
                  lineHeight: 1.5,
                  letterSpacing: "0.01em",
                  margin: 0,
                }}>
                  {japanese}
                </p>
                {/* English — smaller, dimmer */}
                {english && (
                  <p style={{
                    fontFamily: "'Noto Sans JP', sans-serif",
                    fontSize: "clamp(0.82rem, 1.8vw, 1.05rem)",
                    fontWeight: 400,
                    color: "rgba(200, 210, 230, 0.82)",
                    textShadow: "0 1px 6px rgba(0,0,0,0.8)",
                    lineHeight: 1.5,
                    letterSpacing: "0.02em",
                    margin: 0,
                  }}>
                    {english}
                  </p>
                )}
              </div>
            );
          })()}
        </div>

        {/* Listening indicator — small pill below subtitle, only shown while recording */}
        {isRecording && (
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "5px 14px", borderRadius: "9999px",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${theme.cardBorder}`,
          }}>
            <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width: "3px", borderRadius: "2px",
                  background: theme.accent,
                  height: `${8 + Math.sin(i * 1.4) * 5}px`,
                  animation: `avatarBarPulse 0.7s ease-in-out ${i * 0.08}s infinite alternate`,
                }} />
              ))}
            </div>
            <span style={{ fontSize: "0.72rem", color: theme.accent, letterSpacing: "0.06em", fontWeight: 500 }}>
              Recording — click mic to stop &amp; send
            </span>
          </div>
        )}

        {/* Mic error */}
        {micError && (
          <p style={{ fontSize: "0.78rem", color: "#f87171", textAlign: "center", margin: 0 }}>
            {micError}
          </p>
        )}
      </div>

      {/* ── FLOATING ISLAND ─────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 10, width: "100%",
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: "10px", padding: "0 1.5rem 2rem", flexShrink: 0,
      }}>
        {/* Input row */}
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          width: "100%", maxWidth: "600px",
        }}>
          {/* Text island */}
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: "10px",
            background: "rgba(255,255,255,0.06)", backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: "9999px",
            padding: "10px 10px 10px 22px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.04)",
            transition: "border-color 0.18s ease, box-shadow 0.18s ease",
          }}
            onFocusCapture={e => {
              (e.currentTarget as HTMLElement).style.borderColor = theme.cardBorder;
              (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 0 3px ${theme.accentLow}`;
            }}
            onBlurCapture={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.04)";
              }
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="日本語で話しかけてみて… (Type or use the mic)"
              disabled={isBusy}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "#e8eaf0", fontSize: "0.92rem",
                fontFamily: "'Noto Sans JP', sans-serif",
                letterSpacing: "0.02em", lineHeight: 1.5,
                opacity: isBusy ? 0.45 : 1, transition: "opacity 0.2s ease",
              }}
            />
            {/* Send button */}
            <button onClick={handleSend} disabled={!input.trim() || isBusy} style={{
              flexShrink: 0, width: "38px", height: "38px", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: input.trim() && !isBusy ? "pointer" : "default",
              background: input.trim() && !isBusy ? theme.accentMid : "rgba(255,255,255,0.04)",
              border: input.trim() && !isBusy ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.07)",
              color: input.trim() && !isBusy ? theme.accent : "#2a3040",
              boxShadow: input.trim() && !isBusy ? `0 0 18px ${theme.accentLow}` : "none",
              transition: "all 0.15s ease",
            }}
              onMouseEnter={e => {
                if (!input.trim() || isBusy) return;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 28px ${theme.accentGlow}`;
                (e.currentTarget as HTMLElement).style.transform = "scale(1.06)";
              }}
              onMouseLeave={e => {
                if (!input.trim() || isBusy) return;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 18px ${theme.accentLow}`;
                (e.currentTarget as HTMLElement).style.transform = "scale(1)";
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 7h10M7 2l5 5-5 5" />
              </svg>
            </button>
          </div>

          {/* Mic button — disabled ONLY while transcribing, never while speaking */}
          <button
            onClick={isRecording ? stopListening : startListening}
            disabled={isTranscribing}
            title={isTranscribing ? "Transcribing…" : isRecording ? "Click to stop & send" : "Click to start recording"}
            style={{
              flexShrink: 0, width: "52px", height: "52px", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: isTranscribing ? "default" : "pointer",
              background: isRecording
                ? theme.accentMid
                : isTranscribing
                ? "rgba(255,255,255,0.06)"
                : "rgba(255,255,255,0.04)",
              border: isRecording
                ? `2px solid ${theme.accent}`
                : isTranscribing
                ? `1px solid ${theme.cardBorder}`
                : "1px solid rgba(255,255,255,0.1)",
              color: isRecording ? theme.accent : isTranscribing ? theme.accent : "#3a4458",
              boxShadow: isRecording ? `0 0 32px ${theme.accentGlow}` : "none",
              transition: "all 0.15s ease",
              animation: isRecording ? "avatarRingPulse 1.2s ease-in-out infinite" : "none",
              opacity: isTranscribing ? 0.45 : 1,
            }}
          >
            {isTranscribing ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="9" cy="9" r="7" strokeOpacity="0.25" />
                <path d="M9 2a7 7 0 017 7" style={{ animation: "avatarSpin 0.8s linear infinite" }} />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="7" y="1" width="6" height="11" rx="3" />
                <path d="M3 9a7 7 0 0014 0M10 16v3M7 19h6" />
              </svg>
            )}
          </button>

          {/* Gear → TTS settings */}
          <TtsPicker
            theme={theme}
            voiceVoxVoices={voices}
            ttsProvider={ttsProvider}
            setTtsProvider={setTtsProvider}
            voiceVoxId={voiceVoxId}
            setVoiceVoxId={setVoiceVoxId}
            geminiVoice={geminiVoice}
            setGeminiVoice={setGeminiVoice}
            edgeVoice={edgeVoice}
            setEdgeVoice={setEdgeVoice}
          />
        </div>

        {/* Mic status hint */}
        {!isRecording && !isTranscribing && !isLoading && !isSpeaking && (
          <p style={{ fontSize: "0.7rem", color: "#2a3040", margin: 0, letterSpacing: "0.04em" }}>
            Click the mic to start recording
          </p>
        )}
        {isTranscribing && (
          <p style={{ fontSize: "0.7rem", color: theme.accent, margin: 0, letterSpacing: "0.04em", opacity: 0.7 }}>
            Transcribing…
          </p>
        )}
      </div>

      {/* ── Keyframes ────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600&family=Noto+Serif+JP:wght@400;600&display=swap');

        @keyframes avatarFadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes avatarSubtitleIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes avatarDotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.25; transform: scale(0.7); }
        }
        @keyframes avatarRingPulse {
          0%, 100% { opacity: 0.6; transform: scale(1.06); }
          50%      { opacity: 0.2; transform: scale(1.12); }
        }
        @keyframes avatarBarPulse {
          from { transform: scaleY(0.6); }
          to   { transform: scaleY(1.4); }
        }
        @keyframes avatarSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        input::placeholder { color: #2a3040; }
      `}</style>
    </div>
  );
}