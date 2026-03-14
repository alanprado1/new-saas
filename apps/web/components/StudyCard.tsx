"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirrors ScenePlayer.tsx exactly so they are interchangeable
// ─────────────────────────────────────────────────────────────────────────────

export interface Theme {
  name: string;
  label: string;
  accent: string;
  accentRgb: string;
  accentMid: string;
  accentLow: string;
  accentGlow: string;
  cardBorder: string;
  gradient: string;
}

export interface VoiceEntry {
  id: number;
  label: string;
  sublabel: string;
}

export interface StudyCardData {
  kanji: string;
  reading: string;
  meaning: string;
  example_jp: string;
  example_en: string;
  cardType?: "new" | "review";
  nextReviewDays?: number;
}

export interface StudyCardProps {
  card: StudyCardData;
  theme: Theme;
  onAgain: () => void;
  onKnow: () => void;
  progress?: { done: number; total: number };
  timer?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const EDGE_VOICES = [
  { name: "ja-JP-NanamiNeural", label: "Nanami",  desc: "Female · Friendly" },
  { name: "ja-JP-KeitaNeural",  label: "Keita",   desc: "Male · Natural"   },
  { name: "ja-JP-AoiNeural",    label: "Aoi",     desc: "Female · Bright"  },
  { name: "ja-JP-DaichiNeural", label: "Daichi",  desc: "Male · Casual"    },
  { name: "ja-JP-MayuNeural",   label: "Mayu",    desc: "Female · Soft"    },
  { name: "ja-JP-NaokiNeural",  label: "Naoki",   desc: "Male · Calm"      },
  { name: "ja-JP-ShioriNeural", label: "Shiori",  desc: "Female · Warm"    },
] as const;

const FONT_SIZES   = ["base", "lg", "xl"] as const;
const FONT_WEIGHTS = ["font-light", "font-normal", "font-semibold"] as const;
type FontSize   = (typeof FONT_SIZES)[number];
type FontWeight = (typeof FONT_WEIGHTS)[number];

const FONT_SIZE_MAP: Record<FontSize, string> = {
  base: "1.25rem",
  lg:   "1.55rem",
  xl:   "1.9rem",
};
const FONT_WEIGHT_MAP: Record<FontWeight, number> = {
  "font-light":    300,
  "font-normal":   400,
  "font-semibold": 600,
};
const FONT_WEIGHT_LABELS: Record<FontWeight, string> = {
  "font-light":    "Light",
  "font-normal":   "Normal",
  "font-semibold": "Bold",
};

// ─────────────────────────────────────────────────────────────────────────────
// Audio helper — identical copy from ScenePlayer.tsx
// ─────────────────────────────────────────────────────────────────────────────

async function playBase64Audio(base64: string, ctx: AudioContext): Promise<void> {
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
    ctx.addEventListener("statechange", function onSC() {
      if (ctx.state === "closed" || ctx.state === "suspended") {
        ctx.removeEventListener("statechange", onSC);
        reject(new Error(`AudioContext: ${ctx.state}`));
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SessionBar({
  done, total, accent, accentRgb,
}: { done: number; total: number; accent: string; accentRgb: string }) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: `linear-gradient(to right, ${accent}, rgba(${accentRgb},0.55))` }}
      />
    </div>
  );
}

function RevealButton({
  label, active, onClick, theme,
}: { label: string; active: boolean; onClick: () => void; theme: Theme }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-200"
      style={{
        background:    active ? theme.accentMid : "rgba(255,255,255,0.05)",
        border:        active ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.1)",
        color:         active ? theme.accent : "rgba(255,255,255,0.5)",
        fontFamily:    "'Noto Sans JP', sans-serif",
        letterSpacing: "0.04em",
        boxShadow:     active ? `0 0 16px rgba(${theme.accentRgb},0.12)` : "none",
      }}
    >
      {label}
    </button>
  );
}

// Animated waveform bars shown while a clip is playing
function WaveIcon({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill={color}>
      <rect x="1" y="2" width="2" height="6" rx="1" opacity="1">
        <animate attributeName="height" values="6;3;6"   dur="0.7s" repeatCount="indefinite" />
        <animate attributeName="y"      values="2;3.5;2" dur="0.7s" repeatCount="indefinite" />
      </rect>
      <rect x="4" y="1" width="2" height="8" rx="1" opacity="0.8">
        <animate attributeName="height" values="8;4;8" dur="0.7s" begin="0.15s" repeatCount="indefinite" />
        <animate attributeName="y"      values="1;3;1" dur="0.7s" begin="0.15s" repeatCount="indefinite" />
      </rect>
      <rect x="7" y="2" width="2" height="6" rx="1" opacity="0.6">
        <animate attributeName="height" values="6;2;6" dur="0.7s" begin="0.3s" repeatCount="indefinite" />
        <animate attributeName="y"      values="2;4;2" dur="0.7s" begin="0.3s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

// Small circular TTS trigger badge used inline next to text
function TTSBadge({
  onClick, isPlaying, isDisabled, theme,
}: {
  onClick: (e: React.MouseEvent) => void;
  isPlaying: boolean;
  isDisabled: boolean;
  theme: Theme;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      title="Play pronunciation"
      className="flex items-center justify-center rounded-full shrink-0 transition-all duration-150"
      style={{
        width:      26,
        height:     26,
        background: isPlaying ? `rgba(${theme.accentRgb},0.28)` : `rgba(${theme.accentRgb},0.1)`,
        border:     `1px solid ${isPlaying ? theme.accent : theme.cardBorder}`,
        color:      isPlaying ? theme.accent : "#6b7a8d",
        opacity:    isDisabled ? 0.3 : 1,
        cursor:     isDisabled ? "not-allowed" : "pointer",
      }}
    >
      {isPlaying ? (
        <WaveIcon color={theme.accent} />
      ) : (
        <svg width="8" height="9" viewBox="0 0 8 10" fill="currentColor">
          <path d="M1 1l6 4-6 4V1z" />
        </svg>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings bottom sheet
// ─────────────────────────────────────────────────────────────────────────────

interface SettingsPanelProps {
  theme: Theme;
  onClose: () => void;
  ttsProvider:     "gemini" | "edge" | "voicevox";
  setTtsProvider:  (p: "gemini" | "edge" | "voicevox") => void;
  geminiVoice:     string;
  setGeminiVoice:  (v: string) => void;
  edgeVoice:       string;
  setEdgeVoice:    (v: string) => void;
  voiceVoxId:      number;
  setVoiceVoxId:   (id: number) => void;
  availableVoices: VoiceEntry[];
  voicesLoading:   boolean;
  fontSize:        FontSize;
  setFontSize:     (s: FontSize) => void;
  fontWeight:      FontWeight;
  setFontWeight:   (w: FontWeight) => void;
}

function SettingsPanel({
  theme, onClose,
  ttsProvider,    setTtsProvider,
  geminiVoice,    setGeminiVoice,
  edgeVoice,      setEdgeVoice,
  voiceVoxId,     setVoiceVoxId,
  availableVoices, voicesLoading,
  fontSize,   setFontSize,
  fontWeight, setFontWeight,
}: SettingsPanelProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on backdrop tap
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  // Helper: section label (matches reference images — gray uppercase)
  const Label = ({ text }: { text: string }) => (
    <p style={{
      fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em",
      color: "#6b7a8d", padding: "12px 20px 6px",
      fontFamily: "'Noto Sans JP', sans-serif",
    }}>
      {text}
    </p>
  );

  // Helper: divider between rows inside a group card
  const Div = () => <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />;

  // Helper: a standard "label + current value + chevron" row (tap reveals sub-options)
  function Row({
    label, value, children, defaultOpen = false,
  }: {
    label: string; value: string; children?: React.ReactNode; defaultOpen?: boolean;
  }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
      <div>
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5"
        >
          <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "rgba(255,255,255,0.88)", fontFamily: "'Noto Sans JP', sans-serif" }}>{label}</span>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.35)", fontFamily: "'Noto Sans JP', sans-serif" }}>{value}</span>
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.18s ease" }}
            >
              <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
        {open && children && (
          <div className="px-4 pb-3">
            {children}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
    >
      <div
        ref={sheetRef}
        className="w-full max-w-md mx-auto flex flex-col"
        style={{
          background:   "rgba(10,10,22,0.98)",
          border:       "1px solid rgba(255,255,255,0.1)",
          borderBottom: "none",
          borderRadius: "24px 24px 0 0",
          boxShadow:    "0 -20px 60px rgba(0,0,0,0.75)",
          maxHeight:    "88dvh",
          overflow:     "hidden",
          animation:    "sheetUp 0.3s cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.14)" }} />
        </div>

        {/* Sheet header */}
        <div
          className="flex items-center justify-between px-5 pb-3 pt-1 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <h2 style={{
            fontSize: "1.05rem", fontWeight: 700, color: "rgba(255,255,255,0.9)",
            fontFamily: "'Noto Sans JP', sans-serif", letterSpacing: "-0.2px",
          }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-150"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.14)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "none" }}>

          {/* ── GENERAL ──────────────────────────────────────────────── */}
          <Label text="General" />
          <div className="mx-4 rounded-2xl overflow-hidden mb-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {/* Theme row — display-only */}
            <div className="flex items-center justify-between px-5 py-3.5">
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "rgba(255,255,255,0.88)", fontFamily: "'Noto Sans JP', sans-serif" }}>Theme</span>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.35)", fontFamily: "'Noto Sans JP', sans-serif" }}>Dark</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          </div>

          {/* ── STUDY ────────────────────────────────────────────────── */}
          <Label text="Study" />
          <div className="mx-4 rounded-2xl overflow-hidden mb-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>

            {/* Audio Speed — static for now */}
            <div className="flex items-center justify-between px-5 py-3.5">
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "rgba(255,255,255,0.88)", fontFamily: "'Noto Sans JP', sans-serif" }}>Audio Speed</span>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.35)", fontFamily: "'Noto Sans JP', sans-serif" }}>1x</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>

            <Div />

            {/* Font Size */}
            <Row
              label="Font Size"
              value={{ base: "Default", lg: "Large", xl: "X-Large" }[fontSize]}
            >
              <div className="flex gap-2 pt-1">
                {FONT_SIZES.map(s => (
                  <button
                    key={s}
                    onClick={() => setFontSize(s)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
                    style={{
                      background: fontSize === s ? theme.accentMid : "rgba(255,255,255,0.05)",
                      border:     fontSize === s ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.09)",
                      color:      fontSize === s ? theme.accent : "rgba(255,255,255,0.45)",
                      fontFamily: "'Noto Sans JP', sans-serif",
                    }}
                  >
                    {{ base: "Default", lg: "Large", xl: "X-Large" }[s]}
                  </button>
                ))}
              </div>
            </Row>

            <Div />

            {/* Japanese Font (weight) */}
            <Row
              label="Japanese Font"
              value={FONT_WEIGHT_LABELS[fontWeight]}
            >
              <div className="flex gap-2 pt-1">
                {FONT_WEIGHTS.map(w => (
                  <button
                    key={w}
                    onClick={() => setFontWeight(w)}
                    className="flex-1 py-2 rounded-xl text-xs transition-all duration-150"
                    style={{
                      background: fontWeight === w ? theme.accentMid : "rgba(255,255,255,0.05)",
                      border:     fontWeight === w ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.09)",
                      color:      fontWeight === w ? theme.accent : "rgba(255,255,255,0.45)",
                      fontFamily: "'Noto Sans JP', sans-serif",
                      fontWeight: FONT_WEIGHT_MAP[w],
                    }}
                  >
                    {FONT_WEIGHT_LABELS[w]}
                  </button>
                ))}
              </div>
            </Row>

            <Div />

            {/* Voice Engine */}
            <Row
              label="Voice Engine"
              value={{ gemini: "Gemini", edge: "Edge TTS", voicevox: "VoiceVox" }[ttsProvider]}
              defaultOpen={false}
            >
              {/* Provider toggles */}
              <div className="flex gap-2 pt-1 mb-2">
                {(["gemini", "edge", "voicevox"] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setTtsProvider(p)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
                    style={{
                      background: ttsProvider === p ? theme.accentMid : "rgba(255,255,255,0.05)",
                      border:     ttsProvider === p ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.1)",
                      color:      ttsProvider === p ? theme.accent : "#6b7a8d",
                      fontFamily: "'Noto Sans JP', sans-serif",
                    }}
                  >
                    {p === "gemini" ? "Gemini" : p === "edge" ? "Edge" : "VoiceVox"}
                  </button>
                ))}
              </div>

              {/* Gemini voices */}
              {ttsProvider === "gemini" && (
                <div className="flex flex-col gap-0.5">
                  {["Kore", "Charon", "Aoede", "Leda", "Zephyr"].map(v => (
                    <button
                      key={v}
                      onClick={() => setGeminiVoice(v)}
                      className="text-left px-3 py-2 rounded-lg text-xs transition-all duration-150"
                      style={{
                        background: geminiVoice === v ? theme.accentMid : "transparent",
                        border:     geminiVoice === v ? `1px solid ${theme.cardBorder}` : "1px solid transparent",
                        color:      geminiVoice === v ? theme.accent : "#8a9ab8",
                        fontFamily: "'Noto Sans JP', sans-serif",
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}

              {/* Edge voices */}
              {ttsProvider === "edge" && (
                <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto pr-1">
                  {EDGE_VOICES.map(v => (
                    <button
                      key={v.name}
                      onClick={() => setEdgeVoice(v.name)}
                      className="text-left px-3 py-2 rounded-lg text-xs transition-all duration-150 flex justify-between items-center"
                      style={{
                        background: edgeVoice === v.name ? theme.accentMid : "transparent",
                        border:     edgeVoice === v.name ? `1px solid ${theme.cardBorder}` : "1px solid transparent",
                        color:      edgeVoice === v.name ? theme.accent : "#8a9ab8",
                        fontFamily: "'Noto Sans JP', sans-serif",
                      }}
                    >
                      <span>{v.label}</span>
                      <span style={{ fontSize: "0.62rem", color: "#6b7a8d" }}>{v.desc.split(" · ")[1]}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* VoiceVox voices */}
              {ttsProvider === "voicevox" && (
                <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto pr-1">
                  {availableVoices.length === 0 ? (
                    <p style={{ fontSize: "0.7rem", color: "#6b7a8d", fontFamily: "'Noto Sans JP', sans-serif", padding: "4px 0" }}>
                      {voicesLoading ? "Loading…" : "VoiceVox not running locally"}
                    </p>
                  ) : availableVoices.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setVoiceVoxId(v.id)}
                      className="text-left px-3 py-2 rounded-lg text-xs transition-all duration-150 flex justify-between items-center"
                      style={{
                        background: voiceVoxId === v.id ? theme.accentMid : "transparent",
                        border:     voiceVoxId === v.id ? `1px solid ${theme.cardBorder}` : "1px solid transparent",
                        color:      voiceVoxId === v.id ? theme.accent : "#8a9ab8",
                        fontFamily: "'Noto Sans JP', sans-serif",
                      }}
                    >
                      <span>{v.label}</span>
                      <span style={{ fontSize: "0.62rem", color: "#6b7a8d" }}>{v.sublabel}</span>
                    </button>
                  ))}
                </div>
              )}
            </Row>

            <Div />

            {/* Study Button Settings — static for now */}
            <div className="flex items-center justify-between px-5 py-3.5">
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "rgba(255,255,255,0.88)", fontFamily: "'Noto Sans JP', sans-serif" }}>Study Button Settings</span>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.35)", fontFamily: "'Noto Sans JP', sans-serif" }}>Separated</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          </div>

          {/* iOS home indicator spacer */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function StudyCard({
  card,
  theme,
  onAgain,
  onKnow,
  progress = { done: 6, total: 20 },
  timer = "00:09",
}: StudyCardProps) {

  // ── Reveal states ───────────────────────────────────────────────────────────
  const [showMeaning,  setShowMeaning]  = useState(false);
  const [showHiragana, setShowHiragana] = useState(false);

  // ── Settings sheet ──────────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);

  // ── Display prefs (persisted) ───────────────────────────────────────────────
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    if (typeof window === "undefined") return "base";
    return (localStorage.getItem("sc_fontSize") as FontSize) || "base";
  });
  const [fontWeight, setFontWeightState] = useState<FontWeight>(() => {
    if (typeof window === "undefined") return "font-light";
    return (localStorage.getItem("sc_fontWeight") as FontWeight) || "font-light";
  });
  const setFontSize   = useCallback((s: FontSize)   => { setFontSizeState(s);   localStorage.setItem("sc_fontSize",   s);  }, []);
  const setFontWeight = useCallback((w: FontWeight) => { setFontWeightState(w); localStorage.setItem("sc_fontWeight", w);  }, []);

  // ── TTS prefs (persisted) ────────────────────────────────────────────────────
  const [ttsProvider, setTtsProviderState] = useState<"gemini" | "edge" | "voicevox">(() => {
    if (typeof window === "undefined") return "gemini";
    return (localStorage.getItem("pref_ttsProvider") as any) || "gemini";
  });
  const [geminiVoice, setGeminiVoiceState] = useState(() => {
    if (typeof window === "undefined") return "Kore";
    return localStorage.getItem("pref_geminiVoice") || "Kore";
  });
  const [edgeVoice, setEdgeVoiceState] = useState(() => {
    if (typeof window === "undefined") return "ja-JP-NanamiNeural";
    return localStorage.getItem("pref_edgeVoice") || "ja-JP-NanamiNeural";
  });
  const [voiceVoxId, setVoiceVoxIdState] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const s = localStorage.getItem("pref_voiceVoxId");
    return s ? parseInt(s, 10) : 1;
  });

  useEffect(() => { localStorage.setItem("pref_ttsProvider", ttsProvider); }, [ttsProvider]);
  useEffect(() => { localStorage.setItem("pref_geminiVoice", geminiVoice); }, [geminiVoice]);
  useEffect(() => { localStorage.setItem("pref_edgeVoice",   edgeVoice);   }, [edgeVoice]);
  useEffect(() => { localStorage.setItem("pref_voiceVoxId",  voiceVoxId.toString()); }, [voiceVoxId]);

  const setTtsProvider  = useCallback((p: "gemini" | "edge" | "voicevox") => setTtsProviderState(p),  []);
  const setGeminiVoice  = useCallback((v: string)  => setGeminiVoiceState(v),  []);
  const setEdgeVoice    = useCallback((v: string)  => setEdgeVoiceState(v),    []);
  const setVoiceVoxId   = useCallback((id: number) => setVoiceVoxIdState(id),  []);

  // ── VoiceVox voice list (lazy-loaded when voicevox is selected) ─────────────
  const [availableVoices, setAvailableVoices] = useState<VoiceEntry[]>([]);
  const [voicesLoading,   setVoicesLoading]   = useState(false);
  useEffect(() => {
    if (ttsProvider !== "voicevox") return;
    setVoicesLoading(true);
    fetch("/api/voices")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: VoiceEntry[]) => { if (Array.isArray(d)) setAvailableVoices(d); })
      .catch(() => {})
      .finally(() => setVoicesLoading(false));
  }, [ttsProvider]);

  // ── AudioContext ────────────────────────────────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const getAudioCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);
  useEffect(() => () => { audioCtxRef.current?.close().catch(() => {}); }, []);

  // ── TTS playback ─────────────────────────────────────────────────────────────
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const playTTS = useCallback(async (text: string, key: string) => {
    if (playingKey) return;           // block if another clip is mid-play
    setPlayingKey(key);
    try {
      const voice = ttsProvider === "gemini" ? geminiVoice
                  : ttsProvider === "edge"   ? edgeVoice
                  : voiceVoxId;
      const res = await fetch("/api/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, provider: ttsProvider, voice }),
      });
      if (!res.ok) throw new Error(`TTS API ${res.status}`);
      const data = await res.json();
      if (data.audioBase64) {
        await playBase64Audio(data.audioBase64, getAudioCtx());
      } else {
        // Browser-native fallback
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = "ja-JP";
        window.speechSynthesis.speak(utt);
        await new Promise<void>(r => { utt.onend = () => r(); });
      }
    } catch (err) {
      console.warn("[StudyCard] TTS error:", err);
      try {
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = "ja-JP";
        window.speechSynthesis.speak(utt);
      } catch { /* silent */ }
    } finally {
      setPlayingKey(null);
    }
  }, [playingKey, ttsProvider, geminiVoice, edgeVoice, voiceVoxId, getAudioCtx]);

  // ── Derived flags ────────────────────────────────────────────────────────────
  const reviewDays     = card.nextReviewDays ?? 21;
  const kanjiPlaying   = playingKey === "kanji";
  const examplePlaying = playingKey === "example";
  const anyPlaying     = playingKey !== null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Page shell ────────────────────────────────────────────────── */}
      <div
        className="flex flex-col w-full"
        style={{
          fontFamily:      "'Noto Sans JP', sans-serif",
          minHeight:       "100dvh",
          background:      "#07070f",
          backgroundImage: theme.gradient,
          animation:       "sc-fadeUp 0.35s ease both",
        }}
      >

        {/* ── Sticky header ──────────────────────────────────────────── */}
        <header
          className="flex items-center justify-between px-4 pt-14 pb-3 shrink-0"
          style={{
            background:     "rgba(7,7,15,0.88)",
            backdropFilter: "blur(14px)",
            borderBottom:   "1px solid rgba(255,255,255,0.05)",
            position:       "sticky",
            top:            0,
            zIndex:         30,
          }}
        >
          <button aria-label="Back" className="p-1 -ml-1 flex items-center justify-center" style={{ color: "rgba(255,255,255,0.75)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className="flex items-center gap-1">
            <span className="text-[15px] font-bold tracking-[-0.2px]" style={{ color: "rgba(255,255,255,0.92)", fontFamily: "'Noto Sans JP', sans-serif" }}>
              N5 Word Session
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* 3-dot button — toggles settings sheet */}
          <button
            aria-label="More options"
            onClick={() => setShowSettings(v => !v)}
            className="p-1.5 -mr-1 rounded-lg transition-all duration-150"
            style={{
              color:      showSettings ? theme.accent : "rgba(255,255,255,0.5)",
              background: showSettings ? theme.accentMid : "transparent",
              border:     showSettings ? `1px solid ${theme.cardBorder}` : "1px solid transparent",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5"  cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
        </header>

        {/* ── Progress row ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-2.5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <span className="text-[13px] font-semibold tabular-nums shrink-0" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Noto Sans JP', sans-serif" }}>
            {progress.done}/{progress.total}
          </span>
          <SessionBar done={progress.done} total={progress.total} accent={theme.accent} accentRgb={theme.accentRgb} />
          <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="text-[12px] font-semibold tabular-nums" style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Noto Sans JP', sans-serif" }}>{timer}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8"/>
              <path d="M12 7v5l3 3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* ── Card: flex-1 fills all remaining height above action buttons ── */}
        <div className="flex-1 px-4 pt-3 pb-2 flex flex-col min-h-0">
          <div
            className="flex-1 rounded-2xl flex flex-col min-h-0"
            style={{
              background:     "rgba(255,255,255,0.03)",
              border:         "1px solid rgba(255,255,255,0.07)",
              backdropFilter: "blur(8px)",
              boxShadow:      "0 4px 32px rgba(0,0,0,0.35)",
            }}
          >
            {/* Card top bar */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-[12px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{
                    background: card.cardType === "review" ? theme.accentMid : "rgba(120,180,255,0.18)",
                    color:      card.cardType === "review" ? theme.accent     : "#7eb8f7",
                    border:     card.cardType === "review" ? `1px solid ${theme.cardBorder}` : "1px solid rgba(126,184,247,0.35)",
                    fontFamily: "'Noto Sans JP', sans-serif",
                  }}
                >
                  {card.cardType === "review" ? "Review" : "New"}
                </span>
                <button style={{ color: "rgba(255,255,255,0.2)" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2l2.9 6.26L22 9.27l-5 5.14 1.18 7.23L12 18.4l-6.18 3.24L7 14.41 2 9.27l7.1-1.01L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-1">
                {[
                  <svg key="edit" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>,
                  <svg key="hide" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M5.5 5.5l13 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>,
                ].map((icon, i) => (
                  <button key={i} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-150" style={{ color: "rgba(255,255,255,0.3)" }}
                    onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background="rgba(255,255,255,0.07)"; b.style.color="rgba(255,255,255,0.7)"; }}
                    onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background="transparent"; b.style.color="rgba(255,255,255,0.3)"; }}
                  >{icon}</button>
                ))}
                <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors duration-150"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", color:"rgba(255,255,255,0.4)", fontFamily:"'Noto Sans JP', sans-serif" }}
                  onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background="rgba(255,255,255,0.1)"; b.style.color="rgba(255,255,255,0.75)"; }}
                  onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background="rgba(255,255,255,0.05)"; b.style.color="rgba(255,255,255,0.4)"; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M9 9h6M9 13h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  Details
                </button>
              </div>
            </div>

            {/* ── Kanji — flex-1 centers it vertically in available space ── */}
            <div className="flex flex-col items-center justify-center px-6 py-4 min-h-0" style={{ flex: 3 }}>

              {/* Tappable kanji with subtle press scale + glow */}
              <button
                onClick={() => playTTS(card.kanji, "kanji")}
                disabled={anyPlaying && !kanjiPlaying}
                className="flex flex-col items-center gap-2 active:scale-95 transition-transform duration-100"
                style={{
                  background: "transparent",
                  border:     "none",
                  cursor:     anyPlaying && !kanjiPlaying ? "not-allowed" : "pointer",
                  opacity:    anyPlaying && !kanjiPlaying ? 0.5 : 1,
                }}
              >
                <p
                  style={{
                    fontFamily:    "'Kikai Chokoku JIS', 'Noto Sans JP', 'Noto Serif JP', serif",
                    fontSize:      "clamp(5rem, 20vw, 7.5rem)",
                    color:         "rgba(255,255,255,0.92)",
                    fontWeight:    400,
                    letterSpacing: "-0.02em",
                    lineHeight:    1,
                    textShadow:    kanjiPlaying
                      ? `0 0 40px rgba(${theme.accentRgb},0.8), 0 0 80px rgba(${theme.accentRgb},0.4)`
                      : `0 0 48px rgba(${theme.accentRgb},0.18)`,
                    animation:  "sc-popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
                    transition: "text-shadow 0.25s ease",
                  }}
                >
                  {card.kanji}
                </p>

                {/* Speaker label chip below the kanji */}
                
              </button>

              {/* Meaning reveal */}
              <div style={{ maxHeight: showMeaning ? "64px" : "0px", opacity: showMeaning ? 1 : 0, overflow: "hidden", transition: "max-height 0.25s ease, opacity 0.2s ease", marginTop: showMeaning ? "12px" : "0" }}>
                <p className="text-center" style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: "1.15rem", fontWeight: 600, color: "rgba(255,255,255,0.88)", letterSpacing: "0.02em" }}>
                  {card.meaning}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: "1px", background: "rgba(255,255,255,0.05)", margin: "0 16px" }} />

            {/* ── Example sentence — perfectly centered ─────────────── */}
            <div className="px-5 py-5 flex flex-col items-center justify-center text-center gap-1.5 min-h-0" style={{ flex: 7 }}>

              {/* Tappable example row */}
              <div className="flex items-center justify-center w-full">
                <button
                  onClick={() => playTTS(card.example_jp, "example")}
                  disabled={anyPlaying && !examplePlaying}
                  className="active:scale-[0.97] transition-transform duration-100"
                  style={{
                    background: "transparent",
                    border:     "none",
                    cursor:     anyPlaying && !examplePlaying ? "not-allowed" : "pointer",
                    opacity:    anyPlaying && !examplePlaying ? 0.5 : 1,
                  }}
                >
                  <p
                    style={{
                      fontFamily:    "'Kikai Chokoku JIS', 'Noto Sans JP', 'Noto Serif JP', serif",
                      fontSize:      FONT_SIZE_MAP[fontSize],
                      color:         examplePlaying ? theme.accent : "rgba(255,255,255,0.88)",
                      fontWeight:    FONT_WEIGHT_MAP[fontWeight],
                      lineHeight:    1.65,
                      letterSpacing: "0.04em",
                      textAlign:     "center",
                      textShadow:    examplePlaying ? `0 0 24px rgba(${theme.accentRgb},0.55)` : "none",
                      transition:    "color 0.2s ease, text-shadow 0.2s ease, font-size 0.2s ease",
                    }}
                  >
                    {card.example_jp}
                  </p>
                </button>
                {/* Inline TTS badge */}
                
              </div>

              {/* Hiragana + English translation reveal (both centered) */}
              <div style={{ maxHeight: showHiragana ? "110px" : "0px", opacity: showHiragana ? 1 : 0, overflow: "hidden", transition: "max-height 0.28s ease, opacity 0.22s ease", width: "100%" }}>
                <p style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: "0.88rem", color: `rgba(${theme.accentRgb},0.72)`, letterSpacing: "0.03em", marginTop: "6px", textAlign: "center" }}>
                  {card.reading}
                </p>
                <p style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: "0.9rem", color: "#7a8fa8", fontStyle: "italic", marginTop: "3px", textAlign: "center" }}>
                  {card.example_en}
                </p>
              </div>
            </div>

            {/* ── Toggle buttons ────────────────────────────────────── */}
            <div className="flex items-center gap-2 px-4 pb-4 pt-1 shrink-0">
              <button
                className="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-150"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.35)" }}
                onClick={() => { setShowMeaning(false); setShowHiragana(false); }}
                title="Reset reveals"
                onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background="rgba(255,255,255,0.1)"; b.style.color="rgba(255,255,255,0.7)"; }}
                onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background="rgba(255,255,255,0.05)"; b.style.color="rgba(255,255,255,0.35)"; }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M1 4v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3.51 15a9 9 0 102.3-9.36L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <RevealButton label="Meaning"  active={showMeaning}  onClick={() => setShowMeaning(v => !v)}  theme={theme} />
              <RevealButton label="Hiragana" active={showHiragana} onClick={() => setShowHiragana(v => !v)} theme={theme} />
            </div>
          </div>
        </div>

        {/* ── SRS action buttons ──────────────────────────────────────── */}
        <div
          className="px-4 pb-8 pt-3 flex gap-3 shrink-0"
          style={{ background: "linear-gradient(to top, rgba(7,7,15,1) 70%, transparent 100%)", position: "sticky", bottom: 0, zIndex: 20 }}
        >
          <button
            onClick={onAgain}
            className="flex-1 py-4 rounded-2xl text-[15px] font-semibold transition-all duration-200"
            style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.65)", fontFamily:"'Noto Sans JP', sans-serif", letterSpacing:"0.04em" }}
            onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background="rgba(255,255,255,0.12)"; b.style.color="rgba(255,255,255,0.9)"; }}
            onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background="rgba(255,255,255,0.06)"; b.style.color="rgba(255,255,255,0.65)"; }}
          >
            Again
          </button>
          <button
            onClick={onKnow}
            className="flex-[1.4] py-3 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200"
            style={{ background:`rgba(${theme.accentRgb},0.14)`, border:`1.5px solid ${theme.cardBorder}`, color:theme.accent, fontFamily:"'Noto Sans JP', sans-serif", boxShadow:`0 0 28px rgba(${theme.accentRgb},0.18), inset 0 1px 0 rgba(${theme.accentRgb},0.12)` }}
            onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background=`rgba(${theme.accentRgb},0.25)`; b.style.boxShadow=`0 0 40px rgba(${theme.accentRgb},0.32)`; b.style.transform="scale(1.02)"; }}
            onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background=`rgba(${theme.accentRgb},0.14)`; b.style.boxShadow=`0 0 28px rgba(${theme.accentRgb},0.18)`; b.style.transform="scale(1)"; }}
          >
            <span className="text-[16px] font-bold" style={{ letterSpacing:"0.04em" }}>Know</span>
            <span className="text-[11px] font-medium" style={{ color:`rgba(${theme.accentRgb},0.65)`, letterSpacing:"0.03em" }}>Review in {reviewDays}d</span>
          </button>
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;600&family=Noto+Serif+JP:wght@300;400&display=swap');
          @keyframes sc-fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
          @keyframes sc-popIn  { from { opacity:0; transform:scale(0.88); } to { opacity:1; transform:scale(1); } }
          @keyframes sheetUp   { from { transform:translateY(40px); opacity:0.4; } to { transform:translateY(0); opacity:1; } }
        `}</style>
      </div>

      {/* Settings sheet rendered in a portal-like sibling (above page) */}
      {showSettings && (
        <SettingsPanel
          theme={theme}
          onClose={() => setShowSettings(false)}
          ttsProvider={ttsProvider}       setTtsProvider={setTtsProvider}
          geminiVoice={geminiVoice}       setGeminiVoice={setGeminiVoice}
          edgeVoice={edgeVoice}           setEdgeVoice={setEdgeVoice}
          voiceVoxId={voiceVoxId}         setVoiceVoxId={setVoiceVoxId}
          availableVoices={availableVoices}
          voicesLoading={voicesLoading}
          fontSize={fontSize}             setFontSize={setFontSize}
          fontWeight={fontWeight}         setFontWeight={setFontWeight}
        />
      )}
    </>
  );
}
