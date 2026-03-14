"use client";

import Link from "next/link";
import type { Theme } from "@/components/StudyCard";

// ── Gold theme ────────────────────────────────────────────────────────────────
const GOLD_THEME: Theme = {
  name: "gold",
  label: "⛩ Gold",
  accent: "#f5c842",
  accentRgb: "245,200,66",
  accentMid: "rgba(245,200,66,0.18)",
  accentLow: "rgba(245,200,66,0.07)",
  accentGlow: "rgba(245,200,66,0.35)",
  cardBorder: "rgba(245,200,66,0.4)",
  gradient:
    "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(120,80,255,0.12), transparent), " +
    "radial-gradient(ellipse 60% 40% at 80% 80%, rgba(245,200,66,0.06), transparent)",
};

const DECKS = [
  { level: "N5", slug: "n5", words: 527, kanji: 80  },
  { level: "N4", slug: "n4", words: 600, kanji: 166 },
  { level: "N3", slug: "n3", words: 650, kanji: 367 },
  { level: "N2", slug: "n2", words: 700, kanji: 367 },
  { level: "N1", slug: "n1", words: 800, kanji: 500 },
];

// ── Dark blob decoration ──────────────────────────────────────────────────────
function BlobDecoration() {
  return (
    <svg
      viewBox="0 0 340 280" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute bottom-0 right-0 w-full h-[68%] pointer-events-none"
      preserveAspectRatio="xMaxYMax meet"
    >
      <defs>
        <radialGradient id="blobDark" cx="60%" cy="55%" r="55%">
          <stop offset="0%"   stopColor="rgba(245,200,66,0.42)" />
          <stop offset="55%"  stopColor="rgba(245,200,66,0.16)" />
          <stop offset="100%" stopColor="rgba(245,200,66,0)" />
        </radialGradient>
      </defs>
      <path
        d="M60 230 C20 200 10 140 30 100 C50 55 110 30 160 50
           C210 70 240 40 270 70 C305 105 330 160 310 200
           C295 230 250 260 200 265 C145 270 100 265 60 230Z"
        fill="url(#blobDark)"
      />
      <path
        d="M100 255 C60 235 40 185 60 150 C80 115 135 100 175 118
           C215 136 245 115 268 145 C294 178 290 225 265 248
           C240 270 195 278 155 272 C120 267 105 258 100 255Z"
        fill="rgba(245,200,66,0.08)"
      />
      {/* Smiley */}
      <g transform="translate(228,188)">
        <rect x="0"  y="0" width="5" height="5" rx="1" fill="rgba(245,200,66,0.7)" />
        <rect x="16" y="0" width="5" height="5" rx="1" fill="rgba(245,200,66,0.7)" />
        <ellipse cx="2"  cy="14" rx="5" ry="3" fill="rgba(245,200,66,0.3)" />
        <ellipse cx="19" cy="14" rx="5" ry="3" fill="rgba(245,200,66,0.3)" />
        <path d="M2 17 Q10.5 26 19 17" stroke="rgba(245,200,66,0.65)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}

export default function StudyPage() {
  return (
    <div
      className="max-w-md mx-auto min-h-screen flex flex-col select-none"
      style={{ background: "#07070f", backgroundImage: GOLD_THEME.gradient, fontFamily: "'Noto Sans JP', sans-serif" }}
    >
      {/* Grain */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.18]" style={{ backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E\")", backgroundRepeat:"repeat", backgroundSize:"128px", mixBlendMode:"overlay", zIndex:0 }} />

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-center px-5 pt-14 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <button aria-label="Menu" className="absolute left-5 flex flex-col gap-[5px] p-1">
          <span className="block w-[22px] h-[1.5px] rounded-full bg-white opacity-55" />
          <span className="block w-[22px] h-[1.5px] rounded-full bg-white opacity-55" />
          <span className="block w-[15px] h-[1.5px] rounded-full bg-white opacity-35" />
        </button>
        <h1 className="text-[17px] font-bold tracking-[-0.3px]" style={{ color: "rgba(255,255,255,0.88)" }}>
          JLPT Plus
        </h1>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-10">
        {/* Streak pill */}
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 mb-5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}>
          {/* Fire icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M12 2s-3.5 5-3.5 9.5c0 2.48 1.76 4.5 4 4.5 1.93 0 3.5-1.57 3.5-3.5 0-.93-.35-1.78-.93-2.43 0 0-1.07 2.93-3.07 2.93-1 0-2-.9-2-2C10 9.12 12 6 12 6V2z" fill="rgba(245,200,66,0.7)" />
            <path d="M9.5 17.5C9.5 19.43 10.79 21 12.5 21c1.71 0 3-1.57 3-3.5 0-.93-.36-1.75-.96-2.33-.5.53-1.23.83-2.04.83-.81 0-1.54-.3-2.04-.83-.6.58-.96 1.4-.96 2.33z" fill="rgba(245,200,66,0.5)" />
          </svg>
          <span className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.38)" }}>0</span>
        </div>

        {/* Card stack */}
        <div className="relative w-full flex items-center justify-center" style={{ height: 340 }}>
          {/* Ghost cards */}
          <div className="absolute rounded-3xl" style={{ width:"88%", height:320, top:14, right:"1%", background:"rgba(255,255,255,0.022)", border:"1px solid rgba(255,255,255,0.055)", opacity:0.6, transform:"rotate(2.5deg)" }} />
          <div className="absolute rounded-3xl" style={{ width:"88%", height:320, top:10, left:"1%", background:"rgba(255,255,255,0.016)", border:"1px solid rgba(255,255,255,0.04)", opacity:0.4, transform:"rotate(-1.8deg)" }} />

          {/* Active card */}
          <Link
            href="/study/n5"
            className="relative z-10 block rounded-3xl overflow-hidden"
            style={{ width:"90%", height:320, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", backdropFilter:"blur(16px)", boxShadow:"0 0 0 0.5px rgba(255,255,255,0.06), 0 8px 48px rgba(0,0,0,0.6), 0 0 80px rgba(245,200,66,0.05)", animation:"fadeUp 0.5s ease both" }}
          >
            <div className="relative h-full">
              <div className="absolute top-6 left-7 z-10">
                <p className="text-[13px] font-medium mb-1" style={{ color:"rgba(255,255,255,0.3)", fontFamily:"'Noto Sans JP', sans-serif" }}>
                  527 Words · 80 Kanji
                </p>
                <p className="text-[72px] font-bold leading-none tracking-[-3px]" style={{ color:"rgba(255,255,255,0.92)", fontFamily:"'Kikai Chokoku JIS','Noto Sans JP','Noto Serif JP',serif", textShadow:"0 0 60px rgba(245,200,66,0.3)" }}>
                  N5
                </p>
              </div>
              <BlobDecoration />
            </div>
          </Link>
        </div>

        {/* Dots */}
        <div className="flex items-center gap-[7px] mt-6">
          {DECKS.map((d, i) => (
            <span key={d.slug} className="rounded-full transition-all duration-200" style={{ width: i===0?8:7, height: i===0?8:7, background: i===0 ? GOLD_THEME.accent : "rgba(255,255,255,0.16)", boxShadow: i===0 ? "0 0 8px rgba(245,200,66,0.55)" : "none" }} />
          ))}
        </div>
      </main>

      <div className="relative z-10 flex justify-center pb-2">
        <div className="w-[134px] h-[5px] rounded-full" style={{ background:"rgba(255,255,255,0.14)" }} />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600&family=Noto+Serif+JP:wght@400;600;700&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
