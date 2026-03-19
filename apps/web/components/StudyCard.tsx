"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
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
  // SM-2 state — optional so existing mock cards work without changes
  repetition?:  number;
  interval?:    number;
  ease_factor?: number;
}

export interface StudyCardProps {
  card: StudyCardData;
  nextCard?: StudyCardData | null;
  theme: Theme;
  onRate: (rating: "again" | "hard" | "good" | "easy") => void;
  progress?: { done: number; total: number };
  timer?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hardcoded Furigana Parser
// ─────────────────────────────────────────────────────────────────────────────

// 1. Cleans the string for the TTS engine (removes brackets: "[彼女](かのじょ)" -> "彼女")
function cleanTextForTTS(text: string): string {
  if (!text) return "";
  return text.replace(/\[(.*?)\]\((.*?)\)/g, "$1");
}

// 2. Parses the HTML strictly using the hardcoded database format
function buildFuriganaHTML(text: string): string {
  if (!text) return "";
  return text.replace(/\[(.*?)\]\((.*?)\)/g, "<ruby>$1<rt>$2</rt></ruby>");
}

/** "みず (mizu)" → "みず" */
function extractHiragana(reading: string): string {
  return reading.split(" (")[0].split("（")[0].trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Font-size levels  0 = XS … 4 = XL
// ─────────────────────────────────────────────────────────────────────────────

const KANJI_FONT_SIZES   = ["3.5rem", "4.5rem", "5.5rem", "6.5rem", "7.5rem"] as const;
const EXAMPLE_FONT_SIZES = ["0.9rem", "1.3rem", "1.6rem", "1.9rem", "2.5rem"] as const;
const FONT_SIZE_LABELS   = ["XS", "S", "M", "L", "XL"] as const;

// Single font stack used everywhere Japanese text appears.
const JP_FONT  = "'Hiragino Sans', 'Noto Sans JP', sans-serif";
// Kanji headline uses Kikai first (desktop), falls back to the same gothic stack.
const JP_KANJI_FONT = `'Kikai Chokoku JIS', ${JP_FONT}`;

// ─────────────────────────────────────────────────────────────────────────────
// Voice / font-weight constants
// ─────────────────────────────────────────────────────────────────────────────

const EDGE_VOICES = [
  { name: "ja-JP-NanamiNeural", label: "Nanami", desc: "Female · Friendly" },
  { name: "ja-JP-KeitaNeural",  label: "Keita",  desc: "Male · Natural"   },
  { name: "ja-JP-AoiNeural",    label: "Aoi",    desc: "Female · Bright"  },
  { name: "ja-JP-DaichiNeural", label: "Daichi", desc: "Male · Casual"    },
  { name: "ja-JP-MayuNeural",   label: "Mayu",   desc: "Female · Soft"    },
  { name: "ja-JP-NaokiNeural",  label: "Naoki",  desc: "Male · Calm"      },
  { name: "ja-JP-ShioriNeural", label: "Shiori", desc: "Female · Warm"    },
] as const;

const FONT_WEIGHTS = ["font-light", "font-normal", "font-semibold"] as const;
type FontWeight = (typeof FONT_WEIGHTS)[number];
const FONT_WEIGHT_MAP: Record<FontWeight, number> = {
  "font-light": 300, "font-normal": 400, "font-semibold": 600,
};
const FONT_WEIGHT_LABELS: Record<FontWeight, string> = {
  "font-light": "Light", "font-normal": "Normal", "font-semibold": "Bold",
};

// ─────────────────────────────────────────────────────────────────────────────
// Prefs — read localStorage ONCE at module-evaluation time.
// ─────────────────────────────────────────────────────────────────────────────

const _ls = (key: string, fallback: string) =>
  typeof window !== "undefined" ? (localStorage.getItem(key) ?? fallback) : fallback;

const PREFS = {
  kanjiFontLevel:   Number(_ls("sc_kfl",    "2")),
  exampleFontLevel: Number(_ls("sc_efl",    "2")),
  fontWeight:       _ls("sc_fw",   "font-light") as FontWeight,
  ttsProvider:      _ls("pref_tp", "gemini")     as "gemini" | "edge" | "voicevox",
  geminiVoice:      _ls("pref_gv", "Kore"),
  edgeVoice:        _ls("pref_ev", "ja-JP-NanamiNeural"),
  voiceVoxId:       Number(_ls("pref_vvid", "1")),
};

function savePrefs(update: Partial<typeof PREFS>) {
  Object.assign(PREFS, update);
  const map: Record<string, string> = {
    kanjiFontLevel:   "sc_kfl",
    exampleFontLevel: "sc_efl",
    fontWeight:       "sc_fw",
    ttsProvider:      "pref_tp",
    geminiVoice:      "pref_gv",
    edgeVoice:        "pref_ev",
    voiceVoxId:       "pref_vvid",
  };
  for (const [k, v] of Object.entries(update)) {
    if (typeof window !== "undefined") localStorage.setItem(map[k], String(v));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio helper
// ─────────────────────────────────────────────────────────────────────────────

async function playBase64Audio(base64: string, ctx: AudioContext): Promise<void> {
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const buf = await ctx.decodeAudioData(bytes.buffer.slice(0));
  return new Promise((resolve, reject) => {
    const src   = ctx.createBufferSource();
    src.buffer  = buf;
    src.onended = () => resolve();
    src.connect(ctx.destination);
    src.start(0);
    ctx.addEventListener("statechange", function onSC() {
      if (ctx.state === "closed") {
        ctx.removeEventListener("statechange", onSC);
        reject(new Error("AudioContext closed"));
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SessionBar
// ─────────────────────────────────────────────────────────────────────────────

function SessionBar({ done, total, accent, accentRgb }: {
  done: number; total: number; accent: string; accentRgb: string;
}) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: `linear-gradient(to right, ${accent}, rgba(${accentRgb},0.55))` }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RevealButton
// ─────────────────────────────────────────────────────────────────────────────

function RevealButton({ label, active, onClick, theme }: {
  label: string; active: boolean; onClick: () => void; theme: Theme;
}) {
  return (
    <button onClick={onClick}
      className="flex-1 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-150"
      style={{
        background:    active ? theme.accentMid : "rgba(255,255,255,0.05)",
        border:        active ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.1)",
        color:         active ? theme.accent : "rgba(255,255,255,0.5)",
        fontFamily:    JP_FONT,
        letterSpacing: "0.04em",
        outline:       "none",
        cursor:        "pointer",
      }}>
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WaveIcon
// ─────────────────────────────────────────────────────────────────────────────

function WaveIcon({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill={color}>
      <rect x="1" y="2" width="2" height="6" rx="1">
        <animate attributeName="height" values="6;3;6" dur="0.7s" repeatCount="indefinite" />
        <animate attributeName="y" values="2;3.5;2" dur="0.7s" repeatCount="indefinite" />
      </rect>
      <rect x="4" y="1" width="2" height="8" rx="1" opacity="0.8">
        <animate attributeName="height" values="8;4;8" dur="0.7s" begin="0.15s" repeatCount="indefinite" />
        <animate attributeName="y" values="1;3;1" dur="0.7s" begin="0.15s" repeatCount="indefinite" />
      </rect>
      <rect x="7" y="2" width="2" height="6" rx="1" opacity="0.6">
        <animate attributeName="height" values="6;2;6" dur="0.7s" begin="0.3s" repeatCount="indefinite" />
        <animate attributeName="y" values="2;4;2" dur="0.7s" begin="0.3s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FontSlider
// ─────────────────────────────────────────────────────────────────────────────

function FontSlider({ label, value, onChange, theme }: {
  label: string; value: number; onChange: (v: number) => void; theme: Theme;
}) {
  return (
    <div style={{ padding: "4px 0 8px" }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", fontFamily: JP_FONT }}>{label}</span>
        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: theme.accent, fontFamily: JP_FONT, minWidth: "3.2em", textAlign: "right" }}>
          {label === "Kanji Size" ? KANJI_FONT_SIZES[value] : EXAMPLE_FONT_SIZES[value]}
        </span>
      </div>
      <div style={{ position: "relative", height: 28, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", inset: "0 0 0 0", display: "flex", alignItems: "center", pointerEvents: "none" }}>
          <div style={{ width: "100%", height: 4, borderRadius: 99, background: "rgba(255,255,255,0.1)", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 99, width: `${(value / 4) * 100}%`, background: theme.accent, transition: "width 0.1s ease" }} />
          </div>
        </div>
        <input type="range" min={0} max={4} step={1} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: "relative", zIndex: 2, width: "100%", opacity: 0, height: 28, cursor: "pointer", margin: 0, padding: 0 }}
        />
        <div style={{ position: "absolute", inset: "0 0 0 0", display: "flex", alignItems: "center", justifyItems: "space-between", pointerEvents: "none", justifyContent: "space-between" }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{
              width: i === value ? 13 : 8, height: i === value ? 13 : 8,
              borderRadius: "50%",
              background: i <= value ? theme.accent : "rgba(255,255,255,0.18)",
              boxShadow: i === value ? `0 0 8px rgba(${theme.accentRgb},0.55)` : "none",
              transition: "all 0.1s ease",
              flexShrink: 0,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SettingsRow
// ─────────────────────────────────────────────────────────────────────────────

function SettingsRow({ label, value, children, defaultOpen = false }: {
  label: string; value: string; children?: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5"
        style={{ background: "none", border: "none", cursor: "pointer", outline: "none" }}>
        <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "rgba(255,255,255,0.88)", fontFamily: JP_FONT }}>{label}</span>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.35)", fontFamily: JP_FONT }}>{value}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}>
            <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>
      {open && children && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SettingsPanel
// ─────────────────────────────────────────────────────────────────────────────

interface SettingsPanelProps {
  theme: Theme;
  onClose: () => void;
  ttsProvider:        "gemini" | "edge" | "voicevox";
  setTtsProvider:     (p: "gemini" | "edge" | "voicevox") => void;
  geminiVoice:        string;
  setGeminiVoice:     (v: string) => void;
  edgeVoice:          string;
  setEdgeVoice:       (v: string) => void;
  voiceVoxId:         number;
  setVoiceVoxId:      (id: number) => void;
  availableVoices:    VoiceEntry[];
  voicesLoading:      boolean;
  kanjiFontLevel:     number;
  setKanjiFontLevel:  (v: number) => void;
  exampleFontLevel:   number;
  setExampleFontLevel:(v: number) => void;
  fontWeight:         FontWeight;
  setFontWeight:      (w: FontWeight) => void;
}

function SettingsPanel({
  theme, onClose,
  ttsProvider, setTtsProvider,
  geminiVoice, setGeminiVoice,
  edgeVoice, setEdgeVoice,
  voiceVoxId, setVoiceVoxId,
  availableVoices, voicesLoading,
  kanjiFontLevel, setKanjiFontLevel,
  exampleFontLevel, setExampleFontLevel,
  fontWeight, setFontWeight,
}: SettingsPanelProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const Label = ({ text }: { text: string }) => (
    <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7a8d", padding: "12px 20px 6px", fontFamily: JP_FONT }}>
      {text}
    </p>
  );
  const Div = () => <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
      <div ref={sheetRef} className="w-full max-w-md mx-4 flex flex-col"
        style={{
          background: "rgba(10,10,22,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 24,
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          maxHeight: "80dvh",
          overflow: "hidden",
          animation: "sheetUp 0.12s cubic-bezier(0.22,1,0.36,1) both",
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: JP_FONT }}>Settings</h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)", border: "none", cursor: "pointer", outline: "none" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.14)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "none" }}>

          <Label text="General" />
          <div className="mx-4 rounded-2xl overflow-hidden mb-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between px-5 py-3.5">
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "rgba(255,255,255,0.88)", fontFamily: JP_FONT }}>Theme</span>
              <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.35)", fontFamily: JP_FONT }}>Dark</span>
            </div>
          </div>

          <Label text="Study" />
          <div className="mx-4 rounded-2xl overflow-hidden mb-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>

            <div className="flex items-center justify-between px-5 py-3.5">
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "rgba(255,255,255,0.88)", fontFamily: JP_FONT }}>Audio Speed</span>
              <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.35)", fontFamily: JP_FONT }}>1×</span>
            </div>

            <Div />

            <div className="px-5 py-3">
              <FontSlider label="Kanji Size"    value={kanjiFontLevel}   onChange={setKanjiFontLevel}   theme={theme} />
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0 8px" }} />
              <FontSlider label="Sentence Size" value={exampleFontLevel} onChange={setExampleFontLevel} theme={theme} />
            </div>

            <Div />

            <SettingsRow label="Font Style" value={FONT_WEIGHT_LABELS[fontWeight]}>
              <div className="flex gap-2 pt-1">
                {FONT_WEIGHTS.map(w => (
                  <button key={w} onClick={() => setFontWeight(w)}
                    className="flex-1 py-2 rounded-xl text-xs transition-all duration-150"
                    style={{
                      background: fontWeight === w ? theme.accentMid : "rgba(255,255,255,0.05)",
                      border:     fontWeight === w ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.09)",
                      color:      fontWeight === w ? theme.accent : "rgba(255,255,255,0.45)",
                      fontFamily: JP_FONT,
                      fontWeight: FONT_WEIGHT_MAP[w],
                      cursor: "pointer", outline: "none",
                    }}>
                    {FONT_WEIGHT_LABELS[w]}
                  </button>
                ))}
              </div>
            </SettingsRow>

            <Div />

            <SettingsRow label="Voice Engine"
              value={{ gemini: "Gemini", edge: "Edge TTS", voicevox: "VoiceVox" }[ttsProvider]}>
              <div className="flex gap-2 pt-1 mb-2">
                {(["gemini", "edge", "voicevox"] as const).map(p => (
                  <button key={p} onClick={() => setTtsProvider(p)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
                    style={{
                      background: ttsProvider === p ? theme.accentMid : "rgba(255,255,255,0.05)",
                      border:     ttsProvider === p ? `1px solid ${theme.cardBorder}` : "1px solid rgba(255,255,255,0.1)",
                      color:      ttsProvider === p ? theme.accent : "#6b7a8d",
                      fontFamily: JP_FONT,
                      cursor: "pointer", outline: "none",
                    }}>
                    {p === "gemini" ? "Gemini" : p === "edge" ? "Edge" : "VoiceVox"}
                  </button>
                ))}
              </div>

              {ttsProvider === "gemini" && (
                <div className="flex flex-col gap-0.5">
                  {["Kore","Charon","Aoede","Leda","Zephyr"].map(v => (
                    <button key={v} onClick={() => setGeminiVoice(v)}
                      className="text-left px-3 py-2 rounded-lg text-xs transition-all duration-150"
                      style={{
                        background: geminiVoice === v ? theme.accentMid : "transparent",
                        border:     geminiVoice === v ? `1px solid ${theme.cardBorder}` : "1px solid transparent",
                        color:      geminiVoice === v ? theme.accent : "#8a9ab8",
                        fontFamily: JP_FONT,
                        cursor: "pointer", outline: "none",
                      }}>{v}</button>
                  ))}
                </div>
              )}

              {ttsProvider === "edge" && (
                <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}>
                  {EDGE_VOICES.map(v => (
                    <button key={v.name} onClick={() => setEdgeVoice(v.name)}
                      className="text-left px-3 py-2 rounded-lg text-xs transition-all duration-150 flex justify-between items-center"
                      style={{
                        background: edgeVoice === v.name ? theme.accentMid : "transparent",
                        border:     edgeVoice === v.name ? `1px solid ${theme.cardBorder}` : "1px solid transparent",
                        color:      edgeVoice === v.name ? theme.accent : "#8a9ab8",
                        fontFamily: JP_FONT,
                        cursor: "pointer", outline: "none",
                      }}>
                      <span>{v.label}</span>
                      <span style={{ fontSize: "0.62rem", color: "#6b7a8d" }}>{v.desc.split(" · ")[1]}</span>
                    </button>
                  ))}
                </div>
              )}

              {ttsProvider === "voicevox" && (
                <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}>
                  {availableVoices.length === 0 ? (
                    <p style={{ fontSize: "0.7rem", color: "#6b7a8d", fontFamily: JP_FONT, padding: "4px 0" }}>
                      {voicesLoading ? "Loading…" : "VoiceVox not running locally"}
                    </p>
                  ) : availableVoices.map(v => (
                    <button key={v.id} onClick={() => setVoiceVoxId(v.id)}
                      className="text-left px-3 py-2 rounded-lg text-xs transition-all duration-150 flex justify-between items-center"
                      style={{
                        background: voiceVoxId === v.id ? theme.accentMid : "transparent",
                        border:     voiceVoxId === v.id ? `1px solid ${theme.cardBorder}` : "1px solid transparent",
                        color:      voiceVoxId === v.id ? theme.accent : "#8a9ab8",
                        fontFamily: JP_FONT,
                        cursor: "pointer", outline: "none",
                      }}>
                      <span>{v.label}</span>
                      <span style={{ fontSize: "0.62rem", color: "#6b7a8d" }}>{v.sublabel}</span>
                    </button>
                  ))}
                </div>
              )}
            </SettingsRow>

            <Div />

            <div className="flex items-center justify-between px-5 py-3.5">
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "rgba(255,255,255,0.88)", fontFamily: JP_FONT }}>Study Buttons</span>
              <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.35)", fontFamily: JP_FONT }}>Separated</span>
            </div>

          </div>
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
  nextCard = null,
  theme,
  onRate,
  progress = { done: 6, total: 20 },
  timer = "00:00",
}: StudyCardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const playingKeyRef = useRef<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const [showMeaning,  setShowMeaning]  = useState(false);
  const [showFurigana, setShowFurigana] = useState(false);

  useEffect(() => {
    setShowMeaning(false);
    setShowFurigana(false);
    setPlayingKey(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.kanji, card.example_jp]);

  const [showSettings, setShowSettings] = useState(false);

  const [kanjiFontLevel,   setKanjiFontLevelState]   = useState(PREFS.kanjiFontLevel);
  const [exampleFontLevel, setExampleFontLevelState] = useState(PREFS.exampleFontLevel);
  const [fontWeight,       setFontWeightState]       = useState<FontWeight>(PREFS.fontWeight);
  const [ttsProvider,      setTtsProviderState]      = useState(PREFS.ttsProvider);
  const [geminiVoice,      setGeminiVoiceState]      = useState(PREFS.geminiVoice);
  const [edgeVoice,        setEdgeVoiceState]        = useState(PREFS.edgeVoice);
  const [voiceVoxId,       setVoiceVoxIdState]       = useState(PREFS.voiceVoxId);

  const setKanjiFontLevel   = useCallback((v: number) => { setKanjiFontLevelState(v);   savePrefs({ kanjiFontLevel: v }); }, []);
  const setExampleFontLevel = useCallback((v: number) => { setExampleFontLevelState(v); savePrefs({ exampleFontLevel: v }); }, []);
  const setFontWeight       = useCallback((w: FontWeight) => { setFontWeightState(w);   savePrefs({ fontWeight: w }); }, []);
  const setTtsProvider      = useCallback((p: "gemini"|"edge"|"voicevox") => { setTtsProviderState(p); savePrefs({ ttsProvider: p }); }, []);
  const setGeminiVoice      = useCallback((v: string) => { setGeminiVoiceState(v);      savePrefs({ geminiVoice: v }); }, []);
  const setEdgeVoice        = useCallback((v: string) => { setEdgeVoiceState(v);        savePrefs({ edgeVoice: v }); }, []);
  const setVoiceVoxId       = useCallback((id: number) => { setVoiceVoxIdState(id);     savePrefs({ voiceVoxId: id }); }, []);

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

  const audioCtxRef = useRef<AudioContext | null>(null);
  const getAudioCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }, []);
  useEffect(() => () => { audioCtxRef.current?.close().catch(() => {}); }, []);

  const audioCache = useRef<Record<string, string>>({});
  const getActiveVoice = useCallback(() =>
    ttsProvider === "gemini" ? geminiVoice : ttsProvider === "edge" ? edgeVoice : voiceVoxId
  , [ttsProvider, geminiVoice, edgeVoice, voiceVoxId]);

  const preloadTextAudio = useCallback((text: string) => {
    const voice = getActiveVoice();
    const key   = `${text}|${ttsProvider}|${voice}`;
    
    if (audioCache.current[key]) return Promise.resolve();
    audioCache.current[key] = "__pending__";
    
    return fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, provider: ttsProvider, voice }) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (d.audioBase64) audioCache.current[key] = d.audioBase64; else delete audioCache.current[key]; })
      .catch(() => { delete audioCache.current[key]; });
  }, [ttsProvider, getActiveVoice]);

  const lastVoicePrefs = useRef(`${ttsProvider}|${geminiVoice}|${edgeVoice}|${voiceVoxId}`);

  useEffect(() => {
    let isCancelled = false; // Prevents queue pile-ups
    const currentVoicePrefs = `${ttsProvider}|${geminiVoice}|${edgeVoice}|${voiceVoxId}`;

    if (lastVoicePrefs.current !== currentVoicePrefs) {
      audioCache.current = {};
      lastVoicePrefs.current = currentVoicePrefs;
    }

    const loadAudioSequentially = async () => {
      // 1. Highest Priority: Top Half
      await preloadTextAudio(card.kanji);
      if (isCancelled) return;

      // 2. Medium Priority: Bottom Half
      await preloadTextAudio(cleanTextForTTS(card.example_jp));
      if (isCancelled) return;

      // 3. Lowest Priority: The next card (if it exists)
      if (nextCard) {
        await preloadTextAudio(nextCard.kanji);
        if (isCancelled) return;
        await preloadTextAudio(cleanTextForTTS(nextCard.example_jp));
      }
    };

    loadAudioSequentially();

    return () => { isCancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.kanji, card.example_jp, nextCard?.kanji, nextCard?.example_jp, ttsProvider, geminiVoice, edgeVoice, voiceVoxId]);

  const playTTS = useCallback(async (text: string, key: string) => {
    if (playingKeyRef.current) return;
    playingKeyRef.current = key;
    setPlayingKey(key);

    let audioCtx = getAudioCtx();
    try {
      if (audioCtx.state === "suspended") await audioCtx.resume();
    } catch {
      audioCtxRef.current = new AudioContext();
      audioCtx = audioCtxRef.current;
      try { await audioCtx.resume(); } catch { /* silent */ }
    }

    try {
      const voice  = getActiveVoice();
      const cKey   = `${text}|${ttsProvider}|${voice}`;
      const cached = audioCache.current[cKey];

      if (cached && cached !== "__pending__") {
        await playBase64Audio(cached, audioCtx);
      } else {
        const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, provider: ttsProvider, voice }) });
        if (!res.ok) throw new Error(`TTS ${res.status}`);
        const data = await res.json();
        if (data.audioBase64) {
          audioCache.current[cKey] = data.audioBase64;
          await playBase64Audio(data.audioBase64, audioCtx);
        } else {
          await new Promise<void>(resolve => {
            const u = new SpeechSynthesisUtterance(text); u.lang = "ja-JP"; u.onend = () => resolve();
            window.speechSynthesis.speak(u);
          });
        }
      }
    } catch {
      try { const u = new SpeechSynthesisUtterance(text); u.lang = "ja-JP"; window.speechSynthesis.speak(u); } catch { /* silent */ }
    } finally {
      playingKeyRef.current = null;
      setPlayingKey(null);
    }
  }, [ttsProvider, getActiveVoice, getAudioCtx]);

  const kanjiPlaying   = playingKey === "kanji";
  const examplePlaying = playingKey === "example";
  const anyPlaying     = playingKey !== null;
  const kanjiFontSize  = KANJI_FONT_SIZES[kanjiFontLevel];
  const exFontSize     = EXAMPLE_FONT_SIZES[exampleFontLevel];
  const hiragana       = extractHiragana(card.reading);

  const visibility = mounted ? "visible" : "hidden" as const;

  return (
    <>
      <div className="flex flex-col w-full flex-1 overflow-hidden"
        lang="ja"
        style={{ fontFamily: JP_FONT, visibility }}>

        {/* ── Progress bar ── */}
        <div className="flex items-center gap-3 px-5 py-2.5 shrink-0">
          <span className="text-[13px] font-semibold tabular-nums shrink-0"
            style={{ color: "rgba(255,255,255,0.5)", fontFamily: JP_FONT }}>
            {progress.done}/{progress.total}
          </span>
          <SessionBar done={progress.done} total={progress.total} accent={theme.accent} accentRgb={theme.accentRgb} />
          <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="text-[12px] font-semibold tabular-nums"
              style={{ color: "rgba(255,255,255,0.55)", fontFamily: JP_FONT }}>{timer}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8"/>
              <path d="M12 7v5l3 3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* ── Card container ── */}
        <div className="flex-1 px-4 pt-3 pb-2 flex flex-col min-h-0">
          <div className="flex-1 rounded-2xl flex flex-col min-h-0"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 4px 32px rgba(0,0,0,0.35)" }}>

            {/* Top bar */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{
                    background: card.cardType === "review" ? theme.accentMid : "rgba(120,180,255,0.18)",
                    color:      card.cardType === "review" ? theme.accent : "#7eb8f7",
                    border:     card.cardType === "review" ? `1px solid ${theme.cardBorder}` : "1px solid rgba(126,184,247,0.35)",
                    fontFamily: JP_FONT,
                  }}>
                  {card.cardType === "review" ? "Review" : "New"}
                </span>
                <button style={{ color: "rgba(255,255,255,0.2)", background: "none", border: "none", cursor: "pointer", padding: 0, outline: "none" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2l2.9 6.26L22 9.27l-5 5.14 1.18 7.23L12 18.4l-6.18 3.24L7 14.41 2 9.27l7.1-1.01L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <button
                aria-label="Settings"
                onClick={() => setShowSettings(v => !v)}
                className="p-1.5 rounded-lg transition-all duration-150"
                style={{
                  color:      showSettings ? theme.accent : "rgba(255,255,255,0.5)",
                  background: showSettings ? theme.accentMid : "transparent",
                  border:     showSettings ? `1px solid ${theme.cardBorder}` : "1px solid transparent",
                  outline:    "none", cursor: "pointer",
                }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="1.5"/>
                  <circle cx="12" cy="12" r="1.5"/>
                  <circle cx="19" cy="12" r="1.5"/>
                </svg>
              </button>
            </div>

            {/* ══════════════════════════════════════════════════════
                TOP HALF  (flex 4)
            ══════════════════════════════════════════════════════ */}
            <div style={{
              flex: "4 4 0", minHeight: 0, overflow: "hidden",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "8px 1px 10px",
            }}>
              <p style={{
                height: "1.8em", lineHeight: "1.8em", margin: 0,
                opacity: showFurigana ? 1 : 0,
                transition: "opacity 0.15s ease",
                fontSize: "1rem",
                color: `rgba(${theme.accentRgb},0.85)`,
                fontFamily: JP_FONT,
                letterSpacing: "0.15em",
                textAlign: "center",
                userSelect: "none",
              }}>
                {hiragana}
              </p>

              <button
                onClick={() => playTTS(card.kanji, "kanji")}
                disabled={anyPlaying && !kanjiPlaying}
                style={{
                  background: "transparent", border: "none", outline: "none",
                  WebkitTapHighlightColor: "transparent",
                  cursor:  anyPlaying && !kanjiPlaying ? "not-allowed" : "pointer",
                  padding: 0, margin: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                <span suppressHydrationWarning style={{
                  display:       "block",
                  fontFamily:    JP_KANJI_FONT,
                  fontSize:      kanjiFontSize,
                  color:         kanjiPlaying ? theme.accent : "rgba(255,255,255,0.92)",
                  fontWeight:    400,
                  letterSpacing: "-0.02em",
                  lineHeight:    1.1,
                  textShadow:    kanjiPlaying
                    ? `0 0 20px rgba(${theme.accentRgb},0.4), 0 0 40px rgba(${theme.accentRgb},0.2)`
                    : `0 0 24px rgba(${theme.accentRgb},0.09)`,
                  transition:    "color 0.1s ease, text-shadow 0.1s ease",
                  userSelect:    "none",
                  opacity:       anyPlaying && !kanjiPlaying ? 0.5 : 1,
                }}>
                  {card.kanji}
                </span>
              </button>

              <p style={{
                height: "1.4em", lineHeight: "1.4em", margin: "8px 0 0",
                opacity: showMeaning ? 1 : 0,
                transition: "opacity 0.15s ease",
                fontSize: "0.9rem", color: "#7a8fa8", fontStyle: "italic",
                textAlign: "center", fontFamily: JP_FONT,
                userSelect: "none",
              }}>
                {card.meaning}
              </p>
            </div>

            {/* ══════════════════════════════════════════════════════
                BOTTOM HALF  (flex 6)
            ══════════════════════════════════════════════════════ */}
            <div style={{
              flex: "6 6 0", minHeight: 0, overflow: "visible",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "16px 1px 18px",
            }}>

              <button
                className={showFurigana ? "furi-show" : "furi-hide"}
                onClick={() => playTTS(cleanTextForTTS(card.example_jp), "example")}
                disabled={anyPlaying && !examplePlaying}
                style={{
                  background: "transparent", border: "none", outline: "none",
                  WebkitTapHighlightColor: "transparent",
                  cursor:  anyPlaying && !examplePlaying ? "not-allowed" : "pointer",
                  opacity: anyPlaying && !examplePlaying ? 0.5 : 1,
                  padding: 0, width: "100%",
                  overflow: "visible",
                }}>

                <p
                  suppressHydrationWarning
                  dangerouslySetInnerHTML={{ __html: buildFuriganaHTML(card.example_jp) }}
                  style={{
                    fontFamily:    JP_KANJI_FONT,
                    fontSize:      exFontSize,
                    color:         examplePlaying ? theme.accent : "rgba(255,255,255,0.88)",
                    fontWeight:    FONT_WEIGHT_MAP[fontWeight],
                    lineHeight:    2.4,
                    letterSpacing: "0.04em",
                    textAlign:     "center",
                    textShadow:    examplePlaying ? `0 0 12px rgba(${theme.accentRgb},0.28)` : "none",
                    transition:    "color 0.1s ease, text-shadow 0.1s ease",
                    margin: 0, padding: 0, userSelect: "none",
                    overflow: "visible",
                  }}
                />
              </button>

              <p style={{
                height: "1.4em", lineHeight: "1.4em", margin: "6px 0 0",
                opacity: showMeaning ? 1 : 0,
                transition: "opacity 0.15s ease",
                fontSize: "0.9rem", color: "#7a8fa8", fontStyle: "italic",
                textAlign: "center", fontFamily: JP_FONT,
                userSelect: "none",
              }}>
                {card.example_en}
              </p>
            </div>

            {/* Toggle buttons */}
            <div className="flex items-center gap-2 px-4 pb-4 pt-1 shrink-0">
              <RevealButton label="Meaning"  active={showMeaning}  onClick={() => setShowMeaning(v => !v)}  theme={theme} />
              <RevealButton label="Furigana" active={showFurigana} onClick={() => setShowFurigana(v => !v)} theme={theme} />
            </div>
          </div>
        </div>

        {/* ── SRS buttons ── */}
        <div className="px-4 pb-2 pt-1 flex gap-3 shrink-0"
          style={{ background: "linear-gradient(to top, rgba(7,7,15,1) 70%, transparent 100%)", position: "sticky", bottom: 0, zIndex: 20 }}>
          {(([
            { label: "Again", rgb: "239,68,68",     fn: () => onRate("again") },
            { label: "Hard",  rgb: "251,146,60",    fn: () => onRate("hard")  },
            { label: "Good",  rgb: "34,197,94",     fn: () => onRate("good")  },
            { label: "Easy",  rgb: theme.accentRgb, fn: () => onRate("easy"), accent: true },
          ]) as { label: string; rgb: string; fn: () => void; accent?: boolean }[]).map(({ label, rgb, fn, accent }) => (
            <button key={label} onClick={fn}
              className="flex-1 py-4 rounded-2xl text-[14px] font-semibold"
              style={{
                background:    `rgba(${rgb},${accent ? 0.12 : 0.1})`,
                border:        `1px solid rgba(${rgb},${accent ? 0.3 : 0.25})`,
                color:         `rgba(${rgb},0.75)`,
                fontFamily:    JP_FONT,
                letterSpacing: "0.04em",
                outline:       "none",
                cursor:        "pointer",
                transition:    "background 0.15s, color 0.15s",
                boxShadow:     accent ? `0 0 20px rgba(${rgb},0.1)` : "none",
              }}
              onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background=`rgba(${rgb},${accent?0.22:0.18})`; b.style.color=`rgba(${rgb},1)`; }}
              onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background=`rgba(${rgb},${accent?0.12:0.1})`; b.style.color=`rgba(${rgb},0.75)`; }}
            >
              {label}
            </button>
          ))}
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;600&display=swap');
          @keyframes sheetUp { from { transform:translateY(20px); opacity:0.6; } to { transform:translateY(0); opacity:1; } }

          /* rt always takes up layout space — color changes on toggle */
          ruby { 
            ruby-align: center; 
            ruby-position: over; 
            -webkit-ruby-position: before; 
            pointer-events: none; 
            font-family: inherit; 
          }
          
          rt {
            font-size: 0.42em;
            line-height: 1;
            font-weight: 400;
            font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif;
            letter-spacing: 0;
            user-select: none;
            -webkit-user-select: none;
            transition: color 0.15s ease;
            text-shadow: none; /* Prevents ghost shadows when transparent */
          }

          /* The Ultimate iOS Fix: Toggle text color to transparent instead of opacity */
          .furi-hide rt { color: transparent; }
          .furi-show rt { color: rgba(${theme.accentRgb}, 0.85); }

          .desktop-back-btn { display:none; }
          @media (min-width:768px) { .desktop-back-btn { display:flex; } }
        `}</style>
      </div>

      {showSettings && (
        <SettingsPanel
          theme={theme}
          onClose={() => setShowSettings(false)}
          ttsProvider={ttsProvider}           setTtsProvider={setTtsProvider}
          geminiVoice={geminiVoice}           setGeminiVoice={setGeminiVoice}
          edgeVoice={edgeVoice}               setEdgeVoice={setEdgeVoice}
          voiceVoxId={voiceVoxId}             setVoiceVoxId={setVoiceVoxId}
          availableVoices={availableVoices}
          voicesLoading={voicesLoading}
          kanjiFontLevel={kanjiFontLevel}     setKanjiFontLevel={setKanjiFontLevel}
          exampleFontLevel={exampleFontLevel} setExampleFontLevel={setExampleFontLevel}
          fontWeight={fontWeight}             setFontWeight={setFontWeight}
        />
      )}
    </>
  );
}