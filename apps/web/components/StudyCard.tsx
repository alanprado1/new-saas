"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import DOMPurify from "isomorphic-dompurify";
import type { LanguageCode, LearningDirection } from "@/lib/language";

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

type StudyTTSProvider = "edge" | "voicevox";
type EffectiveStudyTTSProvider = StudyTTSProvider | "kokoro";
const KOKORO_DEFAULT_VOICE = "af_heart";

export interface StudyCardData {
  kanji: string;
  reading: string;
  meaning: string;
  example_jp: string;
  example_en: string;
  learningDirection?: LearningDirection;
  targetLanguage?: LanguageCode;
  supportLanguage?: LanguageCode;
  targetText?: string;
  targetReading?: string;
  supportText?: string;
  exampleTarget?: string;
  exampleSupport?: string;
  cardType?: "new" | "review";
  nextReviewDays?: number;
  repetition?:  number;
  interval?:    number;
  ease_factor?: number;
}

export interface StudyCardProps {
  card: StudyCardData;
  nextCard?: StudyCardData | null;
  /** Unused: colours come from CSS variables so the dock's theme control re-themes live. Kept for existing callers. */
  theme?: Theme;
  onRate: (rating: "again" | "hard" | "good" | "easy") => void;
  progress?: { done: number; total: number };
  timer?: string;
  isSaving?: boolean;
  saveError?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hardcoded Furigana Parser
// ─────────────────────────────────────────────────────────────────────────────

function buildFuriganaHTML(text: string): string {
  const sentence = text.trimEnd();
  const endsWithPeriod = sentence.endsWith("。");
  const html = (endsWithPeriod ? sentence.slice(0, -1) : sentence).replace(
    /\[(.*?)\]\((.*?)\)/g,
    "<ruby>$1<rt>$2</rt></ruby>"
  );
  const safeHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["ruby", "rt"],
  });
  return endsWithPeriod ? `${safeHtml}<span class="sentence-period">。</span>` : safeHtml;
}

function extractHiragana(reading: string): string {
  return reading.split(" (")[0].split("（")[0].trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Font-size levels  0 = XS … 4 = XL
// ─────────────────────────────────────────────────────────────────────────────

const KANJI_FONT_SIZES   = ["3.5rem", "4.5rem", "5.5rem", "6.5rem", "7.5rem"] as const;
const EXAMPLE_FONT_SIZES = ["1.6rem", "1.9rem", "2.5rem", "3.0rem", "3.5rem"] as const;
const FONT_SIZE_LABELS   = ["XS", "S", "M", "L", "XL"] as const;

// Interface text uses --f-ui / --f-jp; the word and example sentence use --f-study.
const JP_FONT  = "var(--f-ui, system-ui), var(--f-jp, 'Hiragino Sans'), sans-serif";
const STUDY_FONT = "var(--f-study, 'Klee One'), var(--f-jp, 'Hiragino Sans'), serif";

// ─────────────────────────────────────────────────────────────────────────────
// Voice / font-weight constants
// ─────────────────────────────────────────────────────────────────────────────

const EDGE_VOICES = [
  { name: "ja-JP-NanamiNeural", label: "Nanami", desc: "Female · Friendly" },
  { name: "ja-JP-KeitaNeural",  label: "Keita",  desc: "Male · Natural"   },
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
  ttsProvider:      _ls("pref_tp", "edge")       as StudyTTSProvider,
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

async function playBase64Audio(base64: string, ctx: AudioContext, signal?: AbortSignal, onStart?: (audibleSeconds: number) => void): Promise<void> {
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const audioBuf = await ctx.decodeAudioData(bytes.buffer.slice(0));

  return new Promise((resolve, reject) => {
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(gainNode);

    const startTime = ctx.currentTime + 0.015;
    // TTS files can contain long silent tails. End the source (and its busy
    // state) at the last audible sample, with a short pad for natural endings.
    let lastAudibleSample = -1;
    for (let channel = 0; channel < audioBuf.numberOfChannels; channel++) {
      const samples = audioBuf.getChannelData(channel);
      for (let i = samples.length - 1; i > lastAudibleSample; i--) {
        if (Math.abs(samples[i]) > 0.0001) {
          lastAudibleSample = i;
          break;
        }
      }
    }
    const playDuration = lastAudibleSample < 0 ? Math.min(audioBuf.duration, 0.05)
      : Math.min(audioBuf.duration, (lastAudibleSample + 1) / audioBuf.sampleRate + 0.06);

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(1, startTime + 0.01);

    const fadeOutStart = startTime + playDuration - 0.03;
    if (fadeOutStart > startTime) {
      gainNode.gain.setValueAtTime(1, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, startTime + playDuration);
    }

    const cleanup = () => {
      ctx.removeEventListener("statechange", onSC);
      signal?.removeEventListener("abort", onAbort);
      src.disconnect();
      gainNode.disconnect();
    };
    const onAbort = () => {
      src.onended = null;
      try { src.stop(); } catch { }
      cleanup();
      resolve();
    };
    function onSC() {
      if (ctx.state === "closed") {
        cleanup();
        reject(new Error("AudioContext closed"));
      }
    }
    src.onended = () => { cleanup(); resolve(); };
    ctx.addEventListener("statechange", onSC);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) { onAbort(); return; }
    onStart?.(playDuration);
    src.start(startTime);
    src.stop(startTime + playDuration);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SessionBar
// ─────────────────────────────────────────────────────────────────────────────

function SessionBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: "var(--s3)" }}>
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: "var(--acc)" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RevealButton
// ─────────────────────────────────────────────────────────────────────────────

function RevealButton({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className="w-32 max-w-[45%] h-[38px] rounded-full text-[14px] font-bold transition-colors duration-150"
      style={{
        background:    active ? "var(--acc-soft)" : "transparent",
        border:        `1px solid ${active ? "var(--acc-line)" : "var(--ln)"}`,
        color:         active ? "var(--acc)" : "var(--mut)",
        fontFamily:    JP_FONT,
        cursor:        "pointer",
      }}>
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FontSlider
// ─────────────────────────────────────────────────────────────────────────────

function FontSlider({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ padding: "4px 0 8px" }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: "0.82rem", color: "var(--mut)", fontFamily: JP_FONT }}>{label}</span>
        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--acc)", fontFamily: JP_FONT, minWidth: "3.2em", textAlign: "right" }}>
          {label === "Kanji Size" ? KANJI_FONT_SIZES[value] : EXAMPLE_FONT_SIZES[value]}
        </span>
      </div>
      <div style={{ position: "relative", height: 28, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", inset: "0 0 0 0", display: "flex", alignItems: "center", pointerEvents: "none" }}>
          <div style={{ width: "100%", height: 4, borderRadius: 99, background: "var(--s3)", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 99, width: `${(value / 4) * 100}%`, background: "var(--acc)", transition: "width 0.1s ease" }} />
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
              background: i <= value ? "var(--acc)" : "var(--faint)",
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
        style={{ background: "none", border: "none", cursor: "pointer" }}>
        <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", fontFamily: JP_FONT }}>{label}</span>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: "0.85rem", color: "var(--mut)", fontFamily: JP_FONT }}>{value}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}>
            <path d="M9 18l6-6-6-6" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
  onClose: () => void;
  ttsProvider:        StudyTTSProvider;
  setTtsProvider:     (p: StudyTTSProvider) => void;
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

function SettingsLabel({ text }: { text: string }) {
  return (
    <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--mut)", padding: "12px 20px 6px", fontFamily: JP_FONT }}>
      {text}
    </p>
  );
}

function SettingsDivider() {
  return <div style={{ height: 1, background: "var(--ln)" }} />;
}

/** Selected / unselected option styling shared by the settings choice buttons. */
function choiceStyle(selected: boolean): React.CSSProperties {
  return {
    background: selected ? "var(--acc-soft)" : "transparent",
    border:     `1px solid ${selected ? "var(--acc-line)" : "var(--ln)"}`,
    color:      selected ? "var(--acc)" : "var(--mut)",
    fontFamily: JP_FONT,
    cursor: "pointer",
  };
}

function SettingsPanel({
  onClose,
  ttsProvider, setTtsProvider,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}>
      <div ref={sheetRef} className="w-full max-w-md mx-4 flex flex-col"
        style={{
          background: "var(--s2)",
          border: "1px solid var(--ln)",
          borderRadius: 20,
          boxShadow: "0 18px 40px -12px rgba(0,0,0,0.55)",
          maxHeight: "80dvh",
          overflow: "hidden",
          animation: "sheetUp 0.12s cubic-bezier(0.22,1,0.36,1) both",
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-4 shrink-0"
          style={{ borderBottom: "1px solid var(--ln)" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)", fontFamily: JP_FONT }}>Settings</h2>
          <button onClick={onClose} aria-label="Close settings"
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: "var(--s3)", color: "var(--mut)", border: "none", cursor: "pointer" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "none" }}>

          <SettingsLabel text="General" />
          <div className="mx-4 rounded-2xl overflow-hidden mb-1" style={{ background: "var(--s1)", border: "1px solid var(--ln)" }}>
            <div className="flex items-center justify-between px-5 py-3.5">
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", fontFamily: JP_FONT }}>Theme</span>
              <span style={{ fontSize: "0.85rem", color: "var(--mut)", fontFamily: JP_FONT }}>Dark</span>
            </div>
          </div>

          <SettingsLabel text="Study" />
          <div className="mx-4 rounded-2xl overflow-hidden mb-5" style={{ background: "var(--s1)", border: "1px solid var(--ln)" }}>

            <div className="flex items-center justify-between px-5 py-3.5">
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", fontFamily: JP_FONT }}>Audio Speed</span>
              <span style={{ fontSize: "0.85rem", color: "var(--mut)", fontFamily: JP_FONT }}>1×</span>
            </div>

            <SettingsDivider />

            <div className="px-5 py-3">
              <FontSlider label="Kanji Size"    value={kanjiFontLevel}   onChange={setKanjiFontLevel} />
              <div style={{ height: 1, background: "var(--ln)", margin: "4px 0 8px" }} />
              <FontSlider label="Sentence Size" value={exampleFontLevel} onChange={setExampleFontLevel} />
            </div>

            <SettingsDivider />

            <SettingsRow label="Font Style" value={FONT_WEIGHT_LABELS[fontWeight]}>
              <div className="flex gap-2 pt-1">
                {FONT_WEIGHTS.map(w => (
                  <button key={w} onClick={() => setFontWeight(w)}
                    className="flex-1 py-2 rounded-xl text-xs transition-colors duration-150"
                    style={{ ...choiceStyle(fontWeight === w), fontWeight: FONT_WEIGHT_MAP[w] }}>
                    {FONT_WEIGHT_LABELS[w]}
                  </button>
                ))}
              </div>
            </SettingsRow>

            <SettingsDivider />

            <SettingsRow label="Voice Engine"
              value={{ edge: "Edge TTS", voicevox: "VoiceVox" }[ttsProvider]}>
              <div className="flex gap-2 pt-1 mb-2">
                {(["edge", "voicevox"] as const).map(p => (
                  <button key={p} onClick={() => setTtsProvider(p)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150"
                    style={choiceStyle(ttsProvider === p)}>
                    {p === "edge" ? "Edge" : "VoiceVox"}
                  </button>
                ))}
              </div>

              {ttsProvider === "edge" && (
                <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--ln) transparent" }}>
                  {EDGE_VOICES.map(v => (
                    <button key={v.name} onClick={() => setEdgeVoice(v.name)}
                      className="text-left px-3 py-2 rounded-lg text-xs transition-colors duration-150 flex justify-between items-center"
                      style={{ ...choiceStyle(edgeVoice === v.name), border: `1px solid ${edgeVoice === v.name ? "var(--acc-line)" : "transparent"}` }}>
                      <span>{v.label}</span>
                      <span style={{ fontSize: "0.62rem", color: "var(--faint)" }}>{v.desc.split(" · ")[1]}</span>
                    </button>
                  ))}
                </div>
              )}

              {ttsProvider === "voicevox" && (
                <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--ln) transparent" }}>
                  {availableVoices.length === 0 ? (
                    <p style={{ fontSize: "0.7rem", color: "var(--mut)", fontFamily: JP_FONT, padding: "4px 0" }}>
                      {voicesLoading ? "Loading…" : "VoiceVox not running locally"}
                    </p>
                  ) : availableVoices.map(v => (
                    <button key={v.id} onClick={() => setVoiceVoxId(v.id)}
                      className="text-left px-3 py-2 rounded-lg text-xs transition-colors duration-150 flex justify-between items-center"
                      style={{ ...choiceStyle(voiceVoxId === v.id), border: `1px solid ${voiceVoxId === v.id ? "var(--acc-line)" : "transparent"}` }}>
                      <span>{v.label}</span>
                      <span style={{ fontSize: "0.62rem", color: "var(--faint)" }}>{v.sublabel}</span>
                    </button>
                  ))}
                </div>
              )}
            </SettingsRow>

            <SettingsDivider />

            <div className="flex items-center justify-between px-5 py-3.5">
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", fontFamily: JP_FONT }}>Study Buttons</span>
              <span style={{ fontSize: "0.85rem", color: "var(--mut)", fontFamily: JP_FONT }}>Separated</span>
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
  onRate,
  progress = { done: 6, total: 20 },
  timer = "00:00",
  isSaving = false,
  saveError = "",
}: StudyCardProps) {
  const [mounted, setMounted] = useState(false);

  const playingKeyRef = useRef<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const playbackRef = useRef<AbortController | null>(null);
  // Example-sentence underline: null = off, "full" = full width while playing, number = seconds of audio to follow.
  const [exampleUnderline, setExampleUnderline] = useState<"full" | number | null>(null);

  const [showMeaning,  setShowMeaning]  = useState(false);
  const [showFurigana, setShowFurigana] = useState(false);
  const targetLanguage = card.targetLanguage ?? "ja";
  const targetText = card.targetText ?? card.kanji;
  const targetReading = card.targetReading ?? card.reading;
  const supportText = card.supportText ?? card.meaning;
  const exampleTarget = (card.exampleTarget ?? card.example_jp).trimEnd();
  const exampleSupport = (card.exampleSupport ?? card.example_en).trimEnd();
  const nextTargetText = nextCard?.targetText ?? nextCard?.kanji;
  const nextTargetReading = nextCard?.targetReading ?? nextCard?.reading;
  const nextExampleTarget = (nextCard?.exampleTarget ?? nextCard?.example_jp)?.trimEnd();
  const speechLang = targetLanguage === "ja" ? "ja-JP" : "en-US";
  const isEnglishSentenceCard = targetLanguage === "en";

  useEffect(() => {
    setShowMeaning(false);
    setShowFurigana(false);
    playbackRef.current?.abort();
    playingKeyRef.current = null;
    setPlayingKey(null);
    setExampleUnderline(null);
    return () => { playbackRef.current?.abort(); };
  }, [targetText, exampleTarget]);

  // Keep the rating choices visible when a failed save restores the prior card.
  useEffect(() => {
    if (saveError) setShowMeaning(true);
  }, [saveError]);

  const [showSettings, setShowSettings] = useState(false);

  const [kanjiFontLevel,   setKanjiFontLevelState]   = useState(2);
  const [exampleFontLevel, setExampleFontLevelState] = useState(2);
  const [fontWeight,       setFontWeightState]       = useState<FontWeight>("font-light");
  const [ttsProvider,      setTtsProviderState]      = useState<StudyTTSProvider>("edge");
  const [edgeVoice,        setEdgeVoiceState]        = useState("ja-JP-NanamiNeural");
  const [voiceVoxId,       setVoiceVoxIdState]       = useState(1);

  useEffect(() => {
    setKanjiFontLevelState(PREFS.kanjiFontLevel);
    setExampleFontLevelState(PREFS.exampleFontLevel);
    setFontWeightState(PREFS.fontWeight);
    setTtsProviderState(PREFS.ttsProvider === "voicevox" ? "voicevox" : "edge");
    setEdgeVoiceState(PREFS.edgeVoice);
    setVoiceVoxIdState(PREFS.voiceVoxId);
    setMounted(true);
  }, []);

  const setKanjiFontLevel   = useCallback((v: number) => { setKanjiFontLevelState(v);   savePrefs({ kanjiFontLevel: v }); }, []);
  const setExampleFontLevel = useCallback((v: number) => { setExampleFontLevelState(v); savePrefs({ exampleFontLevel: v }); }, []);
  const setFontWeight       = useCallback((w: FontWeight) => { setFontWeightState(w);   savePrefs({ fontWeight: w }); }, []);
  const setTtsProvider      = useCallback((p: StudyTTSProvider) => { setTtsProviderState(p); savePrefs({ ttsProvider: p }); }, []);
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

  const audioCtxRef    = useRef<AudioContext | null>(null);
  const audioUnlocked  = useRef(false);

  const getAudioCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
      audioUnlocked.current = false;
    }
    return audioCtxRef.current;
  }, []);

  useEffect(() => () => { audioCtxRef.current?.close().catch(() => {}); }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && audioCtxRef.current?.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const ensureUnlocked = useCallback(async (ctx: AudioContext): Promise<void> => {
    if (audioUnlocked.current) return;
    try {
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      await new Promise<void>(resolve => { src.onended = () => resolve(); setTimeout(resolve, 100); });
      audioUnlocked.current = true;
    } catch { }
  }, []);

  const audioCache = useRef<Record<string, string>>({});
  const effectiveTtsProvider: EffectiveStudyTTSProvider = targetLanguage === "en" ? "kokoro" : ttsProvider;
  const getActiveVoice = useCallback(() =>
    effectiveTtsProvider === "edge"    ? edgeVoice   :
    effectiveTtsProvider === "kokoro"  ? KOKORO_DEFAULT_VOICE : voiceVoxId
  , [effectiveTtsProvider, edgeVoice, voiceVoxId]);

  const getAudioCacheKey = useCallback((text: string, readingStr?: string) => {
    const voice = getActiveVoice();
    return `${text}|${readingStr ?? ""}|${effectiveTtsProvider}|${voice}`;
  }, [effectiveTtsProvider, getActiveVoice]);

  const evictCardAudio = useCallback((c: StudyCardData) => {
    const cardTargetText = c.targetText ?? c.kanji;
    const cardTargetReading = c.targetReading ?? c.reading;
    const cardExampleTarget = (c.exampleTarget ?? c.example_jp).trimEnd();
    const keys = [
      getAudioCacheKey(cardTargetText, cardTargetReading),
      getAudioCacheKey(cardExampleTarget),
    ];
    for (const k of keys) {
      if (audioCache.current[k] && audioCache.current[k] !== "__pending__") {
        delete audioCache.current[k];
      }
    }
  }, [getAudioCacheKey]);

  const handleRate = useCallback((rating: "again" | "hard" | "good" | "easy") => {
    evictCardAudio(card);
    onRate(rating);
  }, [card, evictCardAudio, onRate]);

  // Added readingStr to properly cache and send the DB reading for single kanji
  const preloadTextAudio = useCallback((text: string, readingStr?: string) => {
    const voice = getActiveVoice();
    const key   = getAudioCacheKey(text, readingStr);
    
    if (audioCache.current[key]) return Promise.resolve();
    audioCache.current[key] = "__pending__";
    
    return fetch("/api/tts", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({
        text,
        provider: effectiveTtsProvider,
        voice,
        reading: readingStr,
        learningDirection: card.learningDirection,
        targetLanguage,
      }) // Send reading
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (d.audioBase64) audioCache.current[key] = d.audioBase64; else delete audioCache.current[key]; })
      .catch(() => { delete audioCache.current[key]; });
  }, [effectiveTtsProvider, getActiveVoice, getAudioCacheKey, card.learningDirection, targetLanguage]);

  const lastVoicePrefs = useRef(`${effectiveTtsProvider}|${edgeVoice}|${voiceVoxId}`);

  useEffect(() => {
    let isCancelled = false;
    const currentVoicePrefs = `${effectiveTtsProvider}|${edgeVoice}|${voiceVoxId}`;

    if (lastVoicePrefs.current !== currentVoicePrefs) {
      audioCache.current = {};
      lastVoicePrefs.current = currentVoicePrefs;
    }

    const loadAudioSequentially = async () => {
      // Pass the reading for the top kanji
      await preloadTextAudio(targetText, targetReading);
      if (isCancelled) return;

      // Stop stripping furigana from the example_jp
      await preloadTextAudio(exampleTarget);
      if (isCancelled) return;

      if (nextTargetText) {
        await preloadTextAudio(nextTargetText, nextTargetReading);
        if (isCancelled) return;
        if (nextExampleTarget) await preloadTextAudio(nextExampleTarget);
      }
    };

    loadAudioSequentially();

    return () => { isCancelled = true; };
  }, [targetText, exampleTarget, targetReading, nextTargetText, nextExampleTarget, nextTargetReading, effectiveTtsProvider, edgeVoice, voiceVoxId, preloadTextAudio]);

  // Added readingStr parameter
  const playTTS = useCallback(async (text: string, key: string, readingStr?: string) => {
    if (playingKeyRef.current) return;
    const playback = new AbortController();
    playbackRef.current = playback;
    playingKeyRef.current = key;
    setPlayingKey(key);
    const isExample = key === "example";
    const onAudioStart = isExample ? (seconds: number) => setExampleUnderline(seconds) : undefined;

    const audioCtx = getAudioCtx();

    try {
      if (audioCtx.state === "suspended") await audioCtx.resume();
    } catch {
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = new AudioContext();
      audioUnlocked.current = false;
      try { await audioCtxRef.current.resume(); } catch { }
    }

    await ensureUnlocked(audioCtxRef.current!);

    let providerAudioAvailable = false;
    try {
      const voice  = getActiveVoice();
      const cKey   = getAudioCacheKey(text, readingStr);
      const cached = audioCache.current[cKey];

      if (cached && cached !== "__pending__") {
        providerAudioAvailable = true;
        await playBase64Audio(cached, audioCtxRef.current!, playback.signal, onAudioStart);
      } else {
        const res = await fetch("/api/tts", {
          method: "POST",
          signal: playback.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            provider: effectiveTtsProvider,
            voice,
            reading: readingStr,
            learningDirection: card.learningDirection,
            targetLanguage,
          }), // Pass reading
        });
        if (!res.ok) throw new Error(`TTS ${res.status}`);
        const data = await res.json();
        if (data.audioBase64) {
          audioCache.current[cKey] = data.audioBase64;
          providerAudioAvailable = true;
          await playBase64Audio(data.audioBase64, audioCtxRef.current!, playback.signal, onAudioStart);
        } else {
          if (isExample) setExampleUnderline("full");
          await new Promise<void>(resolve => {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = speechLang;
            const finish = () => { playback.signal.removeEventListener("abort", cancel); resolve(); };
            const cancel = () => { window.speechSynthesis.cancel(); finish(); };
            u.onend = finish;
            u.onerror = finish;
            playback.signal.addEventListener("abort", cancel, { once: true });
            if (playback.signal.aborted) { finish(); return; }
            window.speechSynthesis.speak(u);
          });
        }
      }
    } catch {
      if (!providerAudioAvailable && !playback.signal.aborted) {
        try {
          if (isExample) setExampleUnderline("full");
          await new Promise<void>(resolve => {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = speechLang;
            const finish = () => { playback.signal.removeEventListener("abort", cancel); resolve(); };
            const cancel = () => { window.speechSynthesis.cancel(); finish(); };
            u.onend = finish;
            u.onerror = finish;
            playback.signal.addEventListener("abort", cancel, { once: true });
            if (playback.signal.aborted) { finish(); return; }
            window.speechSynthesis.speak(u);
          });
        } catch { }
      }
    } finally {
      if (playbackRef.current === playback) {
        playingKeyRef.current = null;
        setPlayingKey(null);
        setExampleUnderline(null);
      }
    }
  }, [effectiveTtsProvider, getActiveVoice, getAudioCacheKey, getAudioCtx, ensureUnlocked, speechLang, card.learningDirection, targetLanguage]);

  const kanjiPlaying   = playingKey === "kanji";
  const examplePlaying = playingKey === "example";
  const anyPlaying     = playingKey !== null;
  const kanjiFontSize  = KANJI_FONT_SIZES[kanjiFontLevel];
  const exFontSize     = EXAMPLE_FONT_SIZES[exampleFontLevel];
  const hiragana       = targetLanguage === "ja" ? extractHiragana(targetReading) : "";

  const visibility = mounted ? "visible" : "hidden" as const;

  const ratingChoices = [
    { label: "Again", rating: "again" },
    { label: "Hard",  rating: "hard"  },
    { label: "Good",  rating: "good"  },
    { label: "Easy",  rating: "easy"  },
  ] as const;
  const underlineActive = examplePlaying && exampleUnderline !== null;

  return (
    <>
      <div className="sc-root flex flex-col w-full flex-1 overflow-hidden"
        lang={targetLanguage}
        style={{ fontFamily: JP_FONT, visibility, color: "var(--ink)" }}>

        {/* ── Progress bar ── */}
        <div className="flex items-center gap-3 px-5 pt-0 pb-2.5 md:py-2.5 shrink-0">
          <span className="text-[14px] font-bold tabular-nums shrink-0"
            style={{ color: "var(--mut)", fontFamily: JP_FONT }}>
            {progress.done}/{progress.total}
          </span>
          <SessionBar done={progress.done} total={progress.total} />
          <div className="inline-flex items-center gap-1.5 shrink-0 h-7 px-2.5 rounded-lg"
            style={{ border: "1px solid var(--ln)", color: "var(--mut)" }}>
            <span className="text-[13px] font-semibold tabular-nums"
              style={{ fontFamily: JP_FONT }}>{timer}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* ── Card container ── */}
        <div className="flex-1 px-3.5 pt-3 pb-2 flex flex-col min-h-0">
          <div className="flex-1 rounded-[22px] flex flex-col min-h-0 overflow-y-auto"
            style={{ background: "var(--s1)", border: "1px solid var(--ln)", scrollbarWidth: "none" }}>

            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center h-6 px-[9px] rounded-[7px] text-[12px] font-bold"
                  style={{
                    background: `color-mix(in srgb, ${card.cardType === "review" ? "var(--acc)" : "var(--mut)"} 16%, transparent)`,
                    color:      card.cardType === "review" ? "var(--acc)" : "var(--mut)",
                    fontFamily: JP_FONT,
                  }}>
                  {card.cardType === "review" ? "Review" : "New"}
                </span>
              </div>
              <button
                aria-label="Settings"
                onClick={() => setShowSettings(v => !v)}
                className="p-1.5 rounded-lg transition-colors duration-150"
                style={{
                  color:      showSettings ? "var(--acc)" : "var(--mut)",
                  background: showSettings ? "var(--acc-soft)" : "transparent",
                  border:     `1px solid ${showSettings ? "var(--acc-line)" : "transparent"}`,
                  cursor: "pointer",
                }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="1.5"/>
                  <circle cx="12" cy="12" r="1.5"/>
                  <circle cx="19" cy="12" r="1.5"/>
                </svg>
              </button>
            </div>

            {/* TOP HALF  */}
            <div style={{
              flex: "1 0 auto",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "0 1px 36px",
            }}>
              {!isEnglishSentenceCard && <p style={{
                height: "1.8em", lineHeight: "1.8em", margin: 0,
                opacity: showFurigana ? 1 : 0,
                transition: "opacity 0.15s ease",
                fontSize: "1rem",
                color: "var(--acc)",
                fontFamily: JP_FONT,
                letterSpacing: "0.15em",
                textAlign: "center",
                userSelect: "none",
              }}>
                {hiragana}
              </p>}

              {/* Added card.reading to the kanji button */}
              <button
                onClick={() => playTTS(targetText, "kanji", targetReading)}
                disabled={anyPlaying && !kanjiPlaying}
                style={{
                  background: "transparent", border: "none",
                  WebkitTapHighlightColor: "transparent",
                  cursor:  anyPlaying && !kanjiPlaying ? "not-allowed" : "pointer",
                  padding: 0, margin: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                <span suppressHydrationWarning style={{
                  display:       "block",
                  fontFamily:    isEnglishSentenceCard ? JP_FONT : STUDY_FONT,
                  fontSize:      isEnglishSentenceCard ? "clamp(1.45rem, 5vw, 2.4rem)" : kanjiFontSize,
                  color:         kanjiPlaying ? "var(--acc)" : "var(--ink)",
                  fontWeight:    isEnglishSentenceCard ? 650 : 600,
                  letterSpacing: isEnglishSentenceCard ? "0" : "0.02em",
                  lineHeight:    isEnglishSentenceCard ? 1.24 : 1.1,
                  transition:    "color 0.1s ease",
                  userSelect:    "none",
                  opacity:       anyPlaying && !kanjiPlaying ? 0.5 : 1,
                  maxWidth:      isEnglishSentenceCard ? "92%" : "none",
                  overflowWrap:  isEnglishSentenceCard ? "anywhere" : "normal",
                  whiteSpace:    isEnglishSentenceCard ? "normal" : "nowrap",
                }}>
                  {targetText}
                </span>
              </button>

              {!isEnglishSentenceCard && <p style={{
                height: "1.4em", lineHeight: "1.4em", margin: "8px 0 0",
                opacity: showMeaning ? 1 : 0,
                transition: "opacity 0.15s ease",
                fontSize: "1.1rem", fontWeight: 700, color: "var(--acc)",
                textAlign: "center", fontFamily: JP_FONT,
                userSelect: "none",
              }}>
                {supportText}
              </p>}
            </div>

            {/* BOTTOM HALF */}
            <div style={{
              flex: "0 0 auto",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "flex-end",
              padding: "8px 1px 40px",
            }}>

              {isEnglishSentenceCard ? (
                <p style={{
                  minHeight: "3.2em", lineHeight: 1.55, margin: 0,
                  opacity: showMeaning ? 1 : 0,
                  transition: "opacity 0.15s ease",
                  fontSize: "clamp(1rem, 3.8vw, 1.35rem)",
                  fontWeight: 700,
                  color: "var(--acc)",
                  textAlign: "center",
                  fontFamily: JP_FONT,
                  userSelect: "none",
                  maxWidth: "92%",
                  overflowWrap: "anywhere",
                }}>
                  {supportText}
                </p>
              ) : (
                <>
                  {/* Removed cleanTextForTTS so the API receives the furigana tags */}
                  <button
                    className={showFurigana ? "furi-show" : "furi-hide"}
                    onClick={() => playTTS(exampleTarget, "example")}
                    disabled={anyPlaying && !examplePlaying}
                    style={{
                      background: "transparent", border: "none",
                      WebkitTapHighlightColor: "transparent",
                      cursor:  anyPlaying && !examplePlaying ? "not-allowed" : "pointer",
                      opacity: anyPlaying && !examplePlaying ? 0.5 : 1,
                      padding: 0, width: "100%",
                      overflow: "visible",
                    }}>

                    {/* Signature: accent underline that follows the audio while the sentence plays. */}
                    <p
                    className="sc-ex"
                    data-ul={underlineActive ? (exampleUnderline === "full" ? "full" : "run") : undefined}
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{ __html: buildFuriganaHTML(exampleTarget) }}
                    style={{
                      fontFamily:    STUDY_FONT,
                      fontSize:      exFontSize,
                      color:         "var(--ink)",
                      fontWeight:    FONT_WEIGHT_MAP[fontWeight],
                      lineHeight:    1.8,
                      letterSpacing: "0.04em",
                      textAlign:     "center",
                      margin: "0 auto", padding: 0, userSelect: "none",
                      width: "fit-content", maxWidth: "100%",
                      overflow: "visible",
                      WebkitFontSmoothing: "antialiased",
                      ...(typeof exampleUnderline === "number" ? { ["--sc-ul-dur" as string]: `${exampleUnderline}s` } : null),
                    }}
                  />
                  </button>

                  <p style={{
                    height: "1.4em", lineHeight: "1.4em", margin: "6px 0 0",
                    opacity: showMeaning ? 1 : 0,
                    transition: "opacity 0.15s ease",
                    fontSize: "0.9rem", color: "var(--mut)",
                    textAlign: "center", fontFamily: JP_FONT,
                    userSelect: "none",
                  }}>
                    {exampleSupport}
                  </p>
                </>
              )}
            </div>

            {/* Toggle buttons */}
            <div className="flex items-center justify-center gap-2 px-4 pt-1 pb-3 shrink-0">
              <RevealButton label={isEnglishSentenceCard ? "Translation" : "Meaning"}  active={showMeaning}  onClick={() => setShowMeaning(v => !v)} />
              {!isEnglishSentenceCard && <RevealButton label="Furigana" active={showFurigana} onClick={() => setShowFurigana(v => !v)} />}
            </div>
          </div>
        </div>

        {/* SRS buttons */}
        <div className="rating-actions flex justify-center px-3.5 pt-1 shrink-0">
          <div className="w-full md:w-[80%] grid grid-cols-4 gap-2">
            {ratingChoices.map(({ label, rating }) => (
              <button key={rating} onClick={() => handleRate(rating)} disabled={isSaving} aria-busy={isSaving}
                className="press-feedback min-w-0 h-[50px] rounded-[14px] text-[15px] font-bold transition-colors duration-150"
                style={{
                  background: "var(--s1)",
                  border: "1px solid var(--ln)",
                  color: "var(--ink)",
                  fontFamily: JP_FONT,
                  cursor: "pointer",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {saveError && (
          <p role="alert" className="px-4 pt-2 text-center text-[12px] shrink-0" style={{ color: "var(--bad)" }}>
            {saveError}
          </p>
        )}

        <style>{`
          @keyframes sheetUp { from { transform:translateY(20px); opacity:0.6; } to { transform:translateY(0); opacity:1; } }
          @keyframes sc-underline { from { background-size: 0% 3px; } to { background-size: 100% 3px; } }

          .sc-root ruby {
            ruby-align: center;
            ruby-position: over;
            -webkit-ruby-position: before;
            pointer-events: none;
            font-family: inherit;
          }

          .sc-root rt {
            font-size: 0.42em;
            line-height: 1;
            font-weight: 600;
            font-family: var(--f-jp, 'Hiragino Sans'), sans-serif;
            letter-spacing: 0.04em;
            user-select: none;
            -webkit-user-select: none;
            transition: color 0.15s ease;
            text-shadow: none;
          }

          .furi-hide rt { color: transparent; }
          .furi-show rt { color: var(--acc); }
          /* The visible 。 sits on the left side of its full-width glyph box. */
          .sentence-period { display: inline-block; margin-right: -0.75em; }

          /* Accent underline on the example sentence while its audio plays. */
          .sc-ex {
            background-image: linear-gradient(var(--acc), var(--acc));
            background-repeat: no-repeat;
            background-position: 0 100%;
            background-size: 0% 3px;
            padding-bottom: 2px;
          }
          .sc-ex[data-ul="full"] { background-size: 100% 3px; }
          .sc-ex[data-ul="run"] { animation: sc-underline var(--sc-ul-dur, 1s) linear forwards; }
          @media (prefers-reduced-motion: reduce) {
            .sc-ex[data-ul="run"] { animation: none; background-size: 100% 3px; }
          }

          @media (min-width:768px) {
            .rating-actions {
              padding-bottom: 0.5rem;
              background: var(--g);
              position: sticky;
              bottom: 0;
              z-index: 20;
            }
          }
        `}</style>
      </div>

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          ttsProvider={ttsProvider}           setTtsProvider={setTtsProvider}
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
