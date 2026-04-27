"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";

const DECKS = [
  { level: "N5", slug: "n5", words: 527, kanji: 80,  desc: "Beginner",     color: "#f5c842" },
  { level: "N4", slug: "n4", words: 600, kanji: 166, desc: "Elementary",   color: "#e8a838" },
  { level: "N3", slug: "n3", words: 650, kanji: 367, desc: "Intermediate", color: "#d4752a" },
  { level: "N2", slug: "n2", words: 700, kanji: 367, desc: "Upper-Inter",  color: "#c05040" },
  { level: "N1", slug: "n1", words: 800, kanji: 500, desc: "Advanced",     color: "#9b3a6a" },
];

const CARD_COUNT     = DECKS.length;
const ANGLE          = 360 / CARD_COUNT;
const RADIUS         = 240;
const CARD_W         = 160;
const CARD_H         = 200;
const DRAG_THRESHOLD = 6;

// ── Card blob (per-color) ─────────────────────────────────────────────────────
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

// ── 3D Carousel — math entirely intact ───────────────────────────────────────
function CardCarousel({ activeIdx, onSelect, onConfirm, accentColor }: {
  activeIdx: number;
  onSelect: (i: number) => void;
  onConfirm: () => void;
  accentColor: string;
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

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    cancelAnimationFrame(rafRef.current);
    drag.current = { x: e.clientX, startRot: currentRot.current, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > DRAG_THRESHOLD) drag.current.moved = true;
    currentRot.current = drag.current.startRot + dx * 0.5;
    setDisplayRot(currentRot.current);
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const wasTap = !drag.current.moved;
    drag.current = null;
    if (wasTap) { onConfirm(); } else { snapNearest(); }
  };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    targetRot.current = Math.round(currentRot.current / ANGLE) * ANGLE
      - Math.sign(e.deltaX || e.deltaY) * ANGLE;
    snapNearest();
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      className="carousel-wrap"
      style={{
        width: "100%", height: 340,
        display: "flex", alignItems: "center", justifyContent: "center",
        perspective: "900px", perspectiveOrigin: "50% 50%",
        touchAction: "none", userSelect: "none", overflow: "visible",
        cursor: "pointer",
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
                <div style={{ position: "absolute", top: 4, left: 12, zIndex: 2 }}>
                  <p style={{ fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.32)", marginBottom: 2 }}>
                    {d.words}w · {d.kanji}k
                  </p>
                  <p style={{ fontFamily: "'Flavors', cursive", fontStyle: "bold", fontSize: 40, fontWeight: 400, lineHeight: 0.9, letterSpacing: "-2px", color: "rgba(255,255,255,0.93)", textShadow: `0 0 36px ${d.color}55` }}>
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
  );
}

export default function StudyPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [activeIdx, setActiveIdx] = useState(0);
  const deck = DECKS[activeIdx];

  return (
    <div
      className="select-none"
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: "#07070f",
        backgroundImage: theme.gradient,
        fontFamily: "'Noto Sans JP', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* Grain — full window */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.18]" style={{ backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E\")", backgroundRepeat:"repeat", backgroundSize:"128px", mixBlendMode:"overlay", zIndex:0 }} />

      {/* Desktop back button — hidden on mobile via .desktop-back-btn */}
      <button
        onClick={() => router.back()}
        className="desktop-back-btn"
        style={{
          position: "fixed", top: 24, left: 24, zIndex: 10,
          alignItems: "center", gap: 6,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 10, padding: "7px 13px",
          color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 600,
          cursor: "pointer", transition: "background 0.2s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
      >
        ← Back
      </button>

      {/* Center content */}
      <div className="carousel-content" style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Streak pill */}
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 mb-5" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${theme.cardBorder}` }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M12 2s-3.5 5-3.5 9.5c0 2.48 1.76 4.5 4 4.5 1.93 0 3.5-1.57 3.5-3.5 0-.93-.35-1.78-.93-2.43 0 0-1.07 2.93-3.07 2.93-1 0-2-.9-2-2C10 9.12 12 6 12 6V2z" fill={theme.accent} fillOpacity="0.7" />
            <path d="M9.5 17.5C9.5 19.43 10.79 21 12.5 21c1.71 0 3-1.57 3-3.5 0-.93-.36-1.75-.96-2.33-.5.53-1.23.83-2.04.83-.81 0-1.54-.3-2.04-.83-.6.58-.96 1.4-.96 2.33z" fill={theme.accent} fillOpacity="0.5" />
          </svg>
          <span className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.38)" }}>0</span>
        </div>

        {/* 3D Carousel */}
        <CardCarousel
          activeIdx={activeIdx}
          onSelect={setActiveIdx}
          onConfirm={() => router.push(`/study/${deck.slug}`)}
          accentColor={theme.accent}
        />

        {/* Deck label — uses theme accent */}
        <p className="text-[11px] font-bold tracking-[0.2em] uppercase mb-3 mt-1" style={{ color: deck.color, opacity: 0.85 }}>
          {deck.desc} · {deck.level}
        </p>

        {/* Dots */}
        <div className="flex items-center gap-2">
          {DECKS.map((d, i) => (
            <button
              key={d.slug}
              onClick={() => setActiveIdx(i)}
              className="rounded-full border-none p-0 transition-all duration-300"
              style={{
                width: i === activeIdx ? 20 : 6, height: 6,
                background: i === activeIdx ? deck.color : "rgba(255,255,255,0.15)",
                boxShadow: i === activeIdx ? `0 0 8px ${deck.color}66` : "none",
                cursor: "pointer",
              }}
            />
          ))}
        </div>

        <p className="text-[11px] mt-3" style={{ color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>
          Tap to open · Swipe to browse
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600&family=Noto+Serif+JP:wght@400;600;700&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;600&display=swap');
        @keyframes fadeUp    { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ringPulse { 0%,100%{opacity:0.4} 50%{opacity:1} }

        /* Mobile: carousel at natural scale */
        .carousel-content { width: 100%; }
        .carousel-wrap    { width: 100%; }

        /* Desktop: expand bg full window (already done by width:100%), scale carousel 10% bigger */
        @media (min-width: 768px) {
          .carousel-wrap { transform: scale(1.1); transform-origin: center center; }
        }

        /* Desktop back button */
        .desktop-back-btn { display: none; }
        @media (min-width: 768px) { .desktop-back-btn { display: flex !important; } }
      `}</style>
    </div>
  );
}