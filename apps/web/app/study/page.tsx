"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";
import type { Theme } from "@/lib/themes";

// ─────────────────────────────────────────────────────────────────────────────
// Kuromoji types (mirrors ScenePlayer.tsx — no external dependency needed here)
// ─────────────────────────────────────────────────────────────────────────────
declare global {
  interface Window {
    kuromoji: {
      builder: (opts: { dicPath: string }) => {
        build: (cb: (err: Error | null, tokenizer: KuromojiTokenizer) => void) => void;
      };
    };
  }
}
interface KuromojiToken    { surface_form: string; reading?: string; pos: string; }
interface KuromojiTokenizer { tokenize: (text: string) => KuromojiToken[]; }

// ── Furigana helpers (ported from ScenePlayer) ──────────────────────────────
function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60));
}
function hasKanji(str: string): boolean {
  return /[\u4e00-\u9faf\u3400-\u4dbf]/.test(str);
}
function addFurigana(token: KuromojiToken): string {
  const surface = token.surface_form;
  const reading = token.reading;
  if (!hasKanji(surface) || !reading) return surface;
  const hira = katakanaToHiragana(reading);
  if (hira === surface) return surface;
  const surf = surface.split("");
  const read = hira.split("");
  let suffix = "";
  while (surf.length > 0 && read.length > 0 &&
    /^[\u3041-\u3096]$/.test(surf[surf.length - 1]) &&
    surf[surf.length - 1] === read[read.length - 1]) {
    suffix = surf.pop()! + suffix; read.pop();
  }
  let prefix = "";
  while (surf.length > 0 && read.length > 0 &&
    /^[\u3041-\u3096]$/.test(surf[0]) && surf[0] === read[0]) {
    prefix += surf.shift()!; read.shift();
  }
  const kanjiPart = surf.join("");
  const readingPart = read.join("");
  if (!kanjiPart || !readingPart) return `<ruby>${surface}<rt>${hira}</rt></ruby>`;
  return `${prefix}<ruby>${kanjiPart}<rt>${readingPart}</rt></ruby>${suffix}`;
}
function buildFuriganaHTML(text: string, tokenizer: KuromojiTokenizer | null, show: boolean): string {
  if (!tokenizer) return text;
  return tokenizer.tokenize(text).map(t => show ? addFurigana(t) : t.surface_form).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants & data
// ─────────────────────────────────────────────────────────────────────────────
const GOLD = "#f5c842";
const DECKS = [
  { level: "N5", slug: "n5", words: 527,  kanji: 80,  desc: "Beginner",     color: "#f5c842" },
  { level: "N4", slug: "n4", words: 600,  kanji: 166, desc: "Elementary",   color: "#e8a838" },
  { level: "N3", slug: "n3", words: 650,  kanji: 367, desc: "Intermediate", color: "#d4752a" },
  { level: "N2", slug: "n2", words: 700,  kanji: 367, desc: "Upper-Inter",  color: "#c05040" },
  { level: "N1", slug: "n1", words: 800,  kanji: 500, desc: "Advanced",     color: "#9b3a6a" },
] as const;
type Deck = typeof DECKS[number];

const CARD_COUNT     = DECKS.length;
const ANGLE          = 360 / CARD_COUNT;
const RADIUS         = 240;
const CARD_W         = 160;
const CARD_H         = 200;
const DRAG_THRESHOLD = 6;

// ─────────────────────────────────────────────────────────────────────────────
// Shared atoms
// ─────────────────────────────────────────────────────────────────────────────
const GRAIN_URL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E")`;

function Grain() {
  return (
    <div style={{
      pointerEvents: "none", position: "fixed", inset: 0, zIndex: 0,
      opacity: 0.15, backgroundImage: GRAIN_URL,
      backgroundRepeat: "repeat", backgroundSize: "128px", mixBlendMode: "overlay",
    }} />
  );
}

// The carousel & session views use the full-opacity glow (deck.color).
// StudyCardView has its own halved-opacity version below.
function AmbientGlow({ color }: { color: string }) {
  return (
    <div style={{
      pointerEvents: "none", position: "fixed",
      top: "5%", left: "50%", transform: "translateX(-50%)",
      width: "70vw", height: "50vw", maxWidth: 700,
      background: `radial-gradient(ellipse at 50% 40%, ${color}18 0%, transparent 65%)`,
      transition: "background 0.8s ease", zIndex: 0,
    }} />
  );
}

function NavBar({ streak = 7 }: { streak?: number }) {
  return (
    <header style={{
      position: "relative", zIndex: 2, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "max(env(safe-area-inset-top,0px) + 10px, 44px) 20px 10px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      <button aria-label="Menu" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", gap: 5, padding: 4 }}>
        <span style={{ display: "block", width: 22, height: 1.5, borderRadius: 99, background: "rgba(255,255,255,0.5)" }} />
        <span style={{ display: "block", width: 22, height: 1.5, borderRadius: 99, background: "rgba(255,255,255,0.5)" }} />
        <span style={{ display: "block", width: 14, height: 1.5, borderRadius: 99, background: "rgba(255,255,255,0.28)" }} />
      </button>
      <h1 style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px", color: "rgba(255,255,255,0.88)", fontFamily: "inherit" }}>
        JLPT Plus
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: 5, borderRadius: 99, padding: "5px 11px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 2s-3.5 5-3.5 9.5c0 2.48 1.76 4.5 4 4.5 1.93 0 3.5-1.57 3.5-3.5 0-.93-.35-1.78-.93-2.43 0 0-1.07 2.93-3.07 2.93-1 0-2-.9-2-2C10 9.12 12 6 12 6V2z" fill="rgba(245,200,66,0.75)" />
        </svg>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.38)" }}>{streak}</span>
      </div>
    </header>
  );
}

function CardBlob({ color }: { color: string }) {
  const id = `blob${color.replace("#", "")}`;
  return (
    <svg viewBox="0 0 340 280" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ position: "absolute", bottom: 0, right: 0, width: "100%", height: "68%", pointerEvents: "none" }}
      preserveAspectRatio="xMaxYMax meet">
      <defs>
        <radialGradient id={id} cx="60%" cy="55%" r="55%">
          <stop offset="0%"   stopColor={color} stopOpacity="0.45" />
          <stop offset="55%"  stopColor={color} stopOpacity="0.14" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M60 230 C20 200 10 140 30 100 C50 55 110 30 160 50 C210 70 240 40 270 70 C305 105 330 160 310 200 C295 230 250 260 200 265 C145 270 100 265 60 230Z" fill={`url(#${id})`} />
      <path d="M100 255 C60 235 40 185 60 150 C80 115 135 100 175 118 C215 136 245 115 268 145 C294 178 290 225 265 248 C240 270 195 278 155 272 C120 267 105 258 100 255Z" fill={color} fillOpacity="0.07" />
      <g transform="translate(228,188)">
        <rect x="0"  y="0" width="5" height="5" rx="1" fill={color} fillOpacity="0.7" />
        <rect x="16" y="0" width="5" height="5" rx="1" fill={color} fillOpacity="0.7" />
        <path d="M2 17 Q10.5 26 19 17" stroke={color} strokeOpacity="0.65" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE 1 — 3D Carousel (unchanged from last version)
// ─────────────────────────────────────────────────────────────────────────────
function CarouselView({ activeIdx, onSelect, onConfirm }: {
  activeIdx: number;
  onSelect:  (i: number) => void;
  onConfirm: () => void;
}) {
  const currentRot = useRef(-activeIdx * ANGLE);
  const targetRot  = useRef(-activeIdx * ANGLE);
  const [displayRot, setDisplayRot] = useState(-activeIdx * ANGLE);
  const rafRef = useRef<number>(0);
  const drag = useRef<{ x: number; startRot: number; moved: boolean } | null>(null);

  const runSpring = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const tick = () => {
      const diff = targetRot.current - currentRot.current;
      if (Math.abs(diff) < 0.05) {
        currentRot.current = targetRot.current;
        setDisplayRot(currentRot.current);
        return;
      }
      currentRot.current += diff * 0.14;
      setDisplayRot(currentRot.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const snapNearest = useCallback(() => {
    const snapped = Math.round(currentRot.current / ANGLE) * ANGLE;
    const idx     = ((-Math.round(currentRot.current / ANGLE)) % CARD_COUNT + CARD_COUNT) % CARD_COUNT;
    targetRot.current = snapped;
    onSelect(idx);
    runSpring();
  }, [onSelect, runSpring]);

  useEffect(() => {
    const currentSnappedSteps = Math.round(currentRot.current / ANGLE);
    const desiredSteps        = -activeIdx;
    let delta = desiredSteps - currentSnappedSteps;
    while (delta >  CARD_COUNT / 2) delta -= CARD_COUNT;
    while (delta < -CARD_COUNT / 2) delta += CARD_COUNT;
    targetRot.current = (currentSnappedSteps + delta) * ANGLE;
    runSpring();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  const onSurfaceDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    cancelAnimationFrame(rafRef.current);
    drag.current = { x: e.clientX, startRot: currentRot.current, moved: false };
  };
  const onSurfaceMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > DRAG_THRESHOLD) drag.current.moved = true;
    currentRot.current = drag.current.startRot + dx * 0.5;
    setDisplayRot(currentRot.current);
  };
  const onSurfaceUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const wasTap = !drag.current.moved;
    drag.current = null;
    if (wasTap) { onConfirm(); return; }
    snapNearest();
  };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    targetRot.current = Math.round(currentRot.current / ANGLE) * ANGLE
      - Math.sign(e.deltaX || e.deltaY) * ANGLE;
    snapNearest();
  };

  const deck = DECKS[activeIdx];

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
      <div
        onPointerDown={onSurfaceDown}
        onPointerMove={onSurfaceMove}
        onPointerUp={onSurfaceUp}
        onPointerCancel={onSurfaceUp}
        onWheel={onWheel}
        style={{
          flex: 1, minHeight: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          perspective: "900px", perspectiveOrigin: "50% 50%",
          touchAction: "none", userSelect: "none", overflow: "visible", cursor: "grab",
        }}
      >
        <div style={{
          position: "relative", width: 0, height: 0,
          transformStyle: "preserve-3d",
          transform: `rotateX(-16deg) rotateY(${displayRot}deg)`,
          willChange: "transform",
        }}>
          {DECKS.map((d, i) => {
            const isActive = i === activeIdx;
            return (
              <div key={d.slug} style={{
                position: "absolute", width: CARD_W, height: CARD_H,
                transform: `translate(-50%, -50%) rotateY(${i * ANGLE}deg) translateZ(${RADIUS}px)`,
                transformStyle: "preserve-3d", pointerEvents: "none",
                opacity: isActive ? 1 : 0.45, transition: "opacity 0.35s ease",
              }}>
                <div style={{
                  width: "100%", height: "100%", borderRadius: 20,
                  background: isActive
                    ? "linear-gradient(145deg,rgba(255,255,255,0.10) 0%,rgba(255,255,255,0.03) 100%)"
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isActive ? d.color + "70" : "rgba(255,255,255,0.08)"}`,
                  backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                  boxShadow: isActive
                    ? `0 12px 40px rgba(0,0,0,0.6), 0 0 60px ${d.color}28`
                    : "0 4px 20px rgba(0,0,0,0.35)",
                  position: "relative", overflow: "hidden",
                  transition: "border-color 0.4s, box-shadow 0.4s",
                }}>
                  <div style={{ position: "absolute", top: 12, left: 12, zIndex: 2 }}>
                    <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: "rgba(255,255,255,0.32)", marginBottom: 2 }}>{d.words}w · {d.kanji}k</p>
                    <p style={{ fontFamily: "'DM Serif Display',serif", fontStyle: "italic", fontSize: 54, fontWeight: 400, lineHeight: 0.9, letterSpacing: "-2px", color: "rgba(255,255,255,0.93)", textShadow: `0 0 36px ${d.color}55` }}>
                      {d.level}
                    </p>
                  </div>
                  <CardBlob color={d.color} />
                  {isActive && (
                    <div style={{ position: "absolute", inset: 0, borderRadius: 20, boxShadow: `inset 0 0 0 1.5px ${d.color}40`, animation: "ringPulse 2s ease-in-out infinite", pointerEvents: "none" }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flexShrink: 0, textAlign: "center", paddingBottom: "max(env(safe-area-inset-bottom,0px) + 28px, 36px)", paddingTop: 12, animation: "fadeUp 0.35s ease both" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: deck.color, opacity: 0.85, marginBottom: 12 }}>
          {deck.desc} · {deck.level}
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
          {DECKS.map((d, i) => (
            <button key={d.slug} onClick={() => onSelect(i)} style={{
              width: i === activeIdx ? 20 : 6, height: 6, borderRadius: 99, border: "none", cursor: "pointer", padding: 0,
              background: i === activeIdx ? deck.color : "rgba(255,255,255,0.15)",
              boxShadow: i === activeIdx ? `0 0 8px ${deck.color}66` : "none", transition: "all 0.3s ease",
            }} />
          ))}
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>Tap to open · Swipe to browse</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE 2 — Session details (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function SessionDetailsView({ deck, sessionCount, onBack, onStart }: {
  deck:         Deck;
  sessionCount: number;
  onBack:       () => void;
  onStart:      () => void;
}) {
  const [onlyNew, setOnlyNew] = useState(false);
  const stats = [
    { label: "Mastered",  value: 312, sub: "interval > 30d", color: "#6ee7b7" },
    { label: "Studied",   value: 489, sub: "rated once+",    color: "#93c5fd" },
    { label: "New Today", value: 8,   sub: "first seen",     color: GOLD      },
    { label: "Due Today", value: 14,  sub: "reviews due",    color: "#f87171" },
  ] as const;

  return (
    <div style={{
      flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
      position: "relative", zIndex: 1,
      padding: "16px 18px max(env(safe-area-inset-bottom,0px) + 16px, 24px)",
      maxWidth: 520, margin: "0 auto", width: "100%", gap: 14,
      animation: "slideUp 0.32s cubic-bezier(0.22,1,0.36,1) both",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, padding: "7px 13px", color: "rgba(255,255,255,0.55)",
          fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0, transition: "background 0.2s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
        >
          ← Back
        </button>
        <p style={{ flex: 1, fontFamily: "'DM Serif Display',serif", fontStyle: "italic", fontSize: 22, color: "rgba(255,255,255,0.88)", letterSpacing: "-0.5px", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Session {sessionCount}
        </p>
        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: deck.color, background: `${deck.color}18`, borderRadius: 99, padding: "4px 12px", border: `1px solid ${deck.color}33` }}>
          {deck.level}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        {stats.map(s => (
          <div key={s.label} style={{ borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "14px 15px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.26)", marginBottom: 5 }}>{s.label}</p>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginTop: 4 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div onClick={() => setOnlyNew(v => !v)} style={{
        display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
        padding: "13px 15px", borderRadius: 14, background: "rgba(255,255,255,0.04)",
        border: `1px solid ${onlyNew ? deck.color + "55" : "rgba(255,255,255,0.08)"}`,
        transition: "border-color 0.25s",
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
          border: `1.5px solid ${onlyNew ? deck.color : "rgba(255,255,255,0.22)"}`,
          background: onlyNew ? `${deck.color}25` : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
        }}>
          {onlyNew && (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke={deck.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>Only study New Cards</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 3 }}>Skip reviews today · 8 cards queued</p>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", gap: 9 }}>
        <button onClick={onStart} style={{
          flex: 3, padding: "15px 0", borderRadius: 14,
          background: deck.color, color: "#07070f",
          fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer",
          boxShadow: `0 4px 24px ${deck.color}44`, transition: "opacity 0.2s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        >
          Continue Learning →
        </button>
        <button style={{
          flex: 1, padding: "15px 0", borderRadius: 14,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.5)", fontWeight: 600, fontSize: 13,
          cursor: "pointer", transition: "background 0.2s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
        >
          Browse
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", paddingTop: 2 }}>
        <div style={{ width: 120, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.11)" }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE 3 — Study card (redesigned per spec)
//
// Changes vs previous version:
//  • Pulls theme from useTheme() — all accent colours use theme.accent etc.
//  • AmbientGlow opacity halved: was `${color}18` (≈9.4%), now `${color}0C` (≈4.7%)
//  • Top padding reduced: `44px` → `20px` so card sits higher
//  • "New" badge moved inside the glass card (absolute top-left)
//  • Top-bar no longer renders the "New" badge
//  • Reset button removed
//  • "Meaning" and "Furigana" toggles moved inside the glass card (bottom)
//  • Furigana rendered via buildFuriganaHTML + dangerouslySetInnerHTML
//    and toggled with CSS --furi-opacity variable (matches ScenePlayer)
//  • SRS buttons styled as pill-shaped toggles matching the old Meaning/Hiragana style
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE_CARDS = [
  { kanji: "西",    sentence: "西へ行きます。",         meaning: "West",     pos: "Noun"         },
  { kanji: "食べる", sentence: "毎日野菜を食べる。",     meaning: "to eat",   pos: "Ichidan verb" },
  { kanji: "飲む",   sentence: "水をたくさん飲む。",     meaning: "to drink", pos: "Godan verb"   },
  { kanji: "見る",   sentence: "映画を見るのが好きだ。", meaning: "to see",   pos: "Ichidan verb" },
  { kanji: "行く",   sentence: "学校に行く。",           meaning: "to go",    pos: "Godan verb"   },
];

const SRS_LABELS = ["Again", "Hard", "Good", "Easy"] as const;

function StudyCardView({ deck, onBack, onComplete }: {
  deck:       Deck;
  onBack:     () => void;
  onComplete: () => void;
}) {
  const { theme } = useTheme();
  const [idx,          setIdx]          = useState(0);
  const [showMeaning,  setShowMeaning]  = useState(false);
  const [showFurigana, setShowFurigana] = useState(false);
  // kuromoji tokenizer — loaded once on mount
  const [tokenizer, setTokenizer]       = useState<KuromojiTokenizer | null>(null);

  const TOTAL = SAMPLE_CARDS.length;
  const card  = SAMPLE_CARDS[idx % TOTAL];

  // Load kuromoji once
  useEffect(() => {
    if (typeof window === "undefined" || !window.kuromoji) return;
    window.kuromoji.builder({ dicPath: "/dict" }).build((err, t) => {
      if (!err) setTokenizer(t);
    });
  }, []);

  const advance = () => {
    if (idx + 1 >= TOTAL) { onComplete(); return; }
    setIdx(c => c + 1);
    setShowMeaning(false);
    setShowFurigana(false);
  };

  // ── Halved-opacity ambient glow for study view ──
  // Original was `${color}18` (~9.4% alpha). Half of that is `${color}0C` (~4.7%).
  const halfGlow = (
    <div style={{
      pointerEvents: "none", position: "fixed",
      top: "5%", left: "50%", transform: "translateX(-50%)",
      width: "70vw", height: "50vw", maxWidth: 700,
      background: `radial-gradient(ellipse at 50% 40%, ${theme.accent}0C 0%, transparent 65%)`,
      transition: "background 0.8s ease", zIndex: 0,
    }} />
  );

  // Toggle pill shared style helper
  const pillStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, height: 36, borderRadius: 99,
    background: active ? `rgba(${theme.accentRgb},0.13)` : "rgba(255,255,255,0.06)",
    border: `1px solid ${active ? theme.cardBorder : "rgba(255,255,255,0.1)"}`,
    color: active ? theme.accent : "rgba(255,255,255,0.5)",
    fontSize: 13, fontWeight: 600, letterSpacing: "0.03em",
    cursor: "pointer", transition: "all 0.22s",
  });

  // SRS pill style — same base as toggles, colour tinted per button
  const srsPillStyle = (label: typeof SRS_LABELS[number]): React.CSSProperties => {
    const colorMap: Record<typeof SRS_LABELS[number], string> = {
      Again: "rgba(255,255,255,0.45)",
      Hard:  "#f97316",
      Good:  theme.accent,   // uses theme accent for Good
      Easy:  "#3b82f6",
    };
    const col = colorMap[label];
    return {
      flex: 1, padding: "14px 0", borderRadius: 99,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      color: col,
      fontWeight: 700, fontSize: 14, letterSpacing: "0.02em",
      cursor: "pointer", transition: "background 0.2s, border-color 0.2s",
    };
  };

  return (
    <div style={{
      height: "100dvh", overflow: "hidden",
      background: "#0a0a12", fontFamily: "'Noto Sans JP',sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      position: "relative",
    }}>
      <Grain />
      {halfGlow}

      {/* ── Top bar: Back button + counter only (no "New" badge) ── */}
      <div style={{
        position: "relative", zIndex: 2, flexShrink: 0,
        width: "100%", maxWidth: 600,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        // Reduced top padding so the card sits closer to the top
        padding: "max(env(safe-area-inset-top,0px) + 8px, 20px) 16px 8px",
      }}>
        <button onClick={onBack} style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10, padding: "7px 14px",
          color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600,
          cursor: "pointer", transition: "background 0.2s",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
        >
          ← Back
        </button>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "rgba(255,255,255,0.28)" }}>
          {idx + 1} / {TOTAL}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 600, padding: "0 16px 6px", flexShrink: 0 }}>
        <div style={{ height: 2, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 99, background: theme.accent, width: `${(idx / TOTAL) * 100}%`, transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* ── Glassmorphic flash-card ── */}
      <div style={{
        position: "relative", zIndex: 1,
        flex: 1, minHeight: 0,
        width: "100%", maxWidth: 600,
        padding: "0 16px", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          flex: 1, minHeight: 0, borderRadius: 24,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
          backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
          boxShadow: `0 0 0 0.5px rgba(255,255,255,0.05), 0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)`,
          display: "flex", flexDirection: "column", overflow: "hidden",
          position: "relative",
        }}>

          {/* "New" badge — absolute top-left inside the card */}
          <div style={{
            position: "absolute", top: 14, left: 16, zIndex: 3,
            fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            color: theme.accent, background: `rgba(${theme.accentRgb},0.12)`, borderRadius: 6,
            padding: "3px 9px", border: `1px solid rgba(${theme.accentRgb},0.35)`,
          }}>
            New
          </div>

          {/* Top half — kanji centred */}
          <div style={{
            flex: 1, minHeight: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "44px 24px 16px", // extra top to clear the "New" badge
          }}>
            {/* Kanji — with furigana via dangerouslySetInnerHTML */}
            <p
              dangerouslySetInnerHTML={{
                __html: buildFuriganaHTML(card.kanji, tokenizer, showFurigana),
              }}
              style={{
                fontFamily: "'Noto Sans JP',sans-serif",
                fontSize: "clamp(72px, 18vw, 110px)", fontWeight: 400, lineHeight: 1.15,
                color: "rgba(255,255,255,0.95)", textAlign: "center", letterSpacing: "0.02em",
                // CSS variable that controls rt (furigana) opacity — matches ScenePlayer
                ["--furi-opacity" as string]: showFurigana ? 1 : 0,
                ["--accent-rt" as string]: `rgba(${theme.accentRgb},0.85)`,
              }}
            />

            {/* Meaning — slides in below kanji */}
            <div style={{
              overflow: "hidden", maxHeight: showMeaning ? 40 : 0, opacity: showMeaning ? 1 : 0,
              transition: "max-height 0.3s ease, opacity 0.25s ease", marginTop: showMeaning ? 12 : 0,
            }}>
              <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, color: "rgba(255,255,255,0.75)", textAlign: "center" }}>
                {card.meaning}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", flexShrink: 0 }} />

          {/* Bottom half — sentence centred, furigana-enabled */}
          <div style={{
            flex: 1, minHeight: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "14px 28px 8px",
          }}>
            <p
              dangerouslySetInnerHTML={{
                __html: buildFuriganaHTML(card.sentence, tokenizer, showFurigana),
              }}
              style={{
                fontSize: "clamp(15px, 3.5vw, 18px)", color: "rgba(255,255,255,0.55)",
                lineHeight: 1.9, letterSpacing: "0.05em", textAlign: "center",
                ["--furi-opacity" as string]: showFurigana ? 1 : 0,
                ["--accent-rt" as string]: `rgba(${theme.accentRgb},0.75)`,
              }}
            />
          </div>

          {/* ── Toggle pills INSIDE the card, at the bottom ── */}
          <div style={{
            flexShrink: 0,
            display: "flex", gap: 8,
            padding: "10px 16px 14px",
          }}>
            {/* Meaning toggle */}
            <button onClick={() => setShowMeaning(v => !v)} style={pillStyle(showMeaning)}>
              Meaning
            </button>
            {/* Furigana toggle */}
            <button onClick={() => setShowFurigana(v => !v)} style={pillStyle(showFurigana)}>
              Furigana
            </button>
          </div>
        </div>
      </div>

      {/* ── SRS row — pill-shaped, outside the card, pinned at bottom ── */}
      <div style={{
        position: "relative", zIndex: 2, flexShrink: 0,
        width: "100%", maxWidth: 600,
        display: "flex", gap: 8,
        padding: "8px 16px max(env(safe-area-inset-bottom,0px) + 8px, 16px)",
      }}>
        {SRS_LABELS.map(label => (
          <button
            key={label}
            onClick={advance}
            style={srsPillStyle(label)}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.10)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.18)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)";
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session-complete overlay (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function SessionCompleteOverlay({ sessionCount, onDismiss }: { sessionCount: number; onDismiss: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(7,7,15,0.94)", backdropFilter: "blur(20px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      animation: "fadeIn 0.35s ease both",
    }}>
      <div style={{
        width: "100%", maxWidth: 380,
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(245,200,66,0.22)",
        borderRadius: 28, padding: "40px 32px", position: "relative", overflow: "hidden",
        animation: "scaleUp 0.4s cubic-bezier(0.34,1.56,0.64,1) both", textAlign: "center",
      }}>
        {[200, 300, 400].map((s, ii) => (
          <div key={s} style={{
            position: "absolute", borderRadius: "50%",
            border: "1px solid rgba(245,200,66,0.1)", width: s, height: s,
            top: -(s / 2 - 40), right: -(s / 2 - 40),
            animation: `pulse 3s ${ii * 0.5}s ease-in-out infinite`,
          }} />
        ))}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ fontSize: 48, marginBottom: 6 }}>✦</div>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 8 }}>Session Complete</p>
          <h2 style={{ color: "#fff", fontSize: 36, fontWeight: 800, letterSpacing: "-1.5px", fontFamily: "'DM Serif Display',serif", fontStyle: "italic", marginBottom: 6 }}>
            Session {sessionCount}
          </h2>
          <p style={{ color: GOLD, fontSize: 14, marginBottom: 28, opacity: 0.75 }}>Keep the streak alive 🔥</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
            {([["Words reviewed","20",GOLD],["Accuracy","86%","#6ee7b7"],["New cards","5","#93c5fd"]] as const).map(([label, val, col]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                <span>{label}</span>
                <span style={{ color: col, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{val}</span>
              </div>
            ))}
          </div>
          <button onClick={onDismiss} style={{ width: "100%", padding: "13px 0", borderRadius: 14, background: GOLD, color: "#07070f", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer" }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root — three-state machine
// ─────────────────────────────────────────────────────────────────────────────
type AppState = "carousel" | "details" | "study";

export default function StudyPage() {
  const [appState,     setAppState]     = useState<AppState>("carousel");
  const [activeIdx,    setActiveIdx]    = useState(0);
  const [sessionCount, setSessionCount] = useState(21);
  const [showComplete, setShowComplete] = useState(false);

  const deck = DECKS[activeIdx];

  const handleComplete = () => {
    setAppState("carousel");
    setSessionCount(c => c + 1);
    setShowComplete(true);
  };

  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    @keyframes fadeUp   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slideUp  { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
    @keyframes scaleUp  { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
    @keyframes pulse    { 0%,100%{opacity:.45;transform:scale(1)} 50%{opacity:.9;transform:scale(1.04)} }
    @keyframes ringPulse{ 0%,100%{opacity:0.4} 50%{opacity:1} }
    ruby { ruby-align: center; ruby-position: over; }
    rt {
      font-size: 0.45em;
      color: var(--accent-rt, rgba(245,200,66,0.85));
      font-weight: 400;
      font-family: 'Noto Sans JP', sans-serif;
      letter-spacing: 0;
      opacity: var(--furi-opacity, 0);
      transition: opacity 0.2s ease;
      user-select: none;
    }
  `;

  if (appState === "study") {
    return (
      <>
        <style>{STYLES}</style>
        <StudyCardView deck={deck} onBack={() => setAppState("carousel")} onComplete={handleComplete} />
        {showComplete && <SessionCompleteOverlay sessionCount={sessionCount} onDismiss={() => setShowComplete(false)} />}
      </>
    );
  }

  return (
    <>
      <style>{STYLES}</style>
      <Grain />
      <AmbientGlow color={deck.color} />

      <div style={{
        height: "100dvh", overflow: "hidden",
        background: "#07070f", fontFamily: "'Noto Sans JP',sans-serif",
        display: "flex", flexDirection: "column",
        position: "relative", zIndex: 1, userSelect: "none",
      }}>
        <NavBar />

        {appState === "carousel" && (
          <CarouselView
            activeIdx={activeIdx}
            onSelect={setActiveIdx}
            onConfirm={() => setAppState("details")}
          />
        )}

        {appState === "details" && (
          <SessionDetailsView
            deck={deck}
            sessionCount={sessionCount}
            onBack={() => setAppState("carousel")}
            onStart={() => setAppState("study")}
          />
        )}
      </div>

      {showComplete && (
        <SessionCompleteOverlay sessionCount={sessionCount} onDismiss={() => setShowComplete(false)} />
      )}
    </>
  );
}
