"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import type { Theme } from "@/components/StudyCard";

interface PageProps { params: Promise<{ level: string }>; }


// ── Semi-circle arc gauge ─────────────────────────────────────────────────────
function ArcGauge({ pct, done, total, theme }: { pct:number; done:number; total:number; theme:Theme }) {
  const r = 42, cx = 52, cy = 52;
  const trackLen  = Math.PI * r;
  const filledLen = (pct / 100) * trackLen;
  return (
    <div className="relative flex items-center justify-center" style={{ width:104, height:62 }}>
      <svg width="104" height="62" viewBox="0 0 104 62" fill="none" style={{ overflow:"visible" }}>
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" fill="none" />
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} stroke={theme.accent} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${filledLen} ${trackLen}`} fill="none" style={{ filter:`drop-shadow(0 0 6px rgba(${theme.accentRgb},0.6))` }} />
      </svg>
      <div className="absolute bottom-0 flex flex-col items-center leading-tight">
        <span className="text-[16px] font-bold tracking-[-0.5px]" style={{ color:"rgba(255,255,255,0.9)", fontFamily:"'Noto Sans JP',sans-serif" }}>{pct}%</span>
        <span className="text-[11px] font-medium" style={{ color:"rgba(255,255,255,0.3)", fontFamily:"'Noto Sans JP',sans-serif" }}>{done}/{total}</span>
      </div>
    </div>
  );
}

// ── Goal dropdown ─────────────────────────────────────────────────────────────
const GOALS = [10,20,30,40,50];
function GoalDropdown({ value, onChange, theme }: { value:number; onChange:(v:number)=>void; theme:Theme }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v=>!v)}
        className="flex items-center gap-2 rounded-xl px-4 py-2.5"
        style={{ background:"rgba(255,255,255,0.06)", border:`1px solid ${open ? theme.cardBorder : "rgba(255,255,255,0.1)"}`, minWidth:130 }}
      >
        <span className="text-[15px] font-semibold" style={{ color:"rgba(255,255,255,0.88)", fontFamily:"'Noto Sans JP',sans-serif" }}>{value} items</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className={`ml-auto transition-transform ${open?"rotate-180":""}`}>
          <path d="M6 9l6 6 6-6" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 rounded-2xl overflow-hidden z-20" style={{ minWidth:130, background:"rgba(12,12,24,0.97)", border:"1px solid rgba(255,255,255,0.1)", boxShadow:"0 16px 48px rgba(0,0,0,0.7)", backdropFilter:"blur(20px)", animation:"fdDown 0.12s ease both" }}>
          {GOALS.map(g => (
            <button key={g} onClick={() => { onChange(g); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-[14px] font-medium transition-colors duration-100"
              style={{ background: g===value ? theme.accentMid : "transparent", color: g===value ? theme.accent : "rgba(255,255,255,0.55)", fontFamily:"'Noto Sans JP',sans-serif" }}
            >
              {g} items
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stat row with progress bar ────────────────────────────────────────────────
function StatRow({ label, value, max, theme }: { label:string; value:number; max:number; theme:Theme }) {
  const pct = Math.min(100, Math.round((value/max)*100));
  return (
    <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
      <span className="text-[14px] font-medium w-36 shrink-0" style={{ color:"rgba(255,255,255,0.38)", fontFamily:"'Noto Sans JP',sans-serif" }}>{label}</span>
      <span className="text-[14px] font-bold w-[78px] text-right shrink-0 tabular-nums" style={{ color:"rgba(255,255,255,0.7)", fontFamily:"'Noto Sans JP',sans-serif" }}>{value}/{max}</span>
      <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.07)" }}>
        <div className="h-full rounded-full" style={{ width:`${pct}%`, background:`linear-gradient(to right, ${theme.accent}, rgba(${theme.accentRgb},0.55))`, boxShadow:`0 0 8px rgba(${theme.accentRgb},0.4)` }} />
      </div>
    </div>
  );
}

// ── Bottom tabs ───────────────────────────────────────────────────────────────
function BottomTabs({ active, theme }: { active:"word"|"kanji"; theme:Theme }) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30" style={{ background:"rgba(7,7,15,0.92)", borderTop:"1px solid rgba(255,255,255,0.06)", backdropFilter:"blur(16px)" }}>
      <div className="flex">
        {/* Word */}
        <button className="flex-1 flex flex-col items-center pt-3 pb-5 gap-0.5" style={{ color: active==="word" ? theme.accent : "rgba(255,255,255,0.28)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: active==="word" ? theme.accentMid : "transparent" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-[11px] font-medium" style={{ fontFamily:"'Noto Sans JP',sans-serif" }}>Word</span>
        </button>
        {/* Kanji */}
        <button className="flex-1 flex flex-col items-center pt-3 pb-5 gap-0.5" style={{ color: active==="kanji" ? theme.accent : "rgba(255,255,255,0.28)" }}>
          <div className="w-7 h-7 flex items-center justify-center">
            <span className="text-[22px] leading-none" style={{ fontFamily:"'Hiragino Kaku Gothic Pro','Noto Sans JP',sans-serif" }}>字</span>
          </div>
          <span className="text-[11px] font-medium" style={{ fontFamily:"'Noto Sans JP',sans-serif" }}>Kanji</span>
        </button>
      </div>
    </nav>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LevelDashboardPage({ params }: PageProps) {
  const { level } = use(params);
  const router    = useRouter();
  const { theme } = useTheme();
  const LEVEL     = level.toUpperCase();

  const [goalItems, setGoalItems] = useState(20);

  // Mock data — replace with getDailySession() call
  const newWords    = 6;
  const reviewWords = 14;
  const done        = newWords;
  const pct         = Math.round((done / goalItems) * 100);
  const mastered    = 225;
  const studied     = 227;
  const total       = 527;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background:"#07070f", backgroundImage:theme.gradient, fontFamily:"'Noto Sans JP',sans-serif", width:"100%" }}
    >
      {/* Grain */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.18]" style={{ backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E\")", backgroundRepeat:"repeat", backgroundSize:"128px", mixBlendMode:"overlay", zIndex:0 }} />

      {/* Top accent wash — full width */}
      <div className="absolute top-0 left-0 w-full h-32 pointer-events-none" style={{ background:`linear-gradient(180deg, rgba(${theme.accentRgb},0.08) 0%, transparent 100%)`, zIndex:1 }} />

      {/* Desktop back button */}
      <button
        onClick={() => router.back()}
        className="desktop-back-btn"
        style={{
          position: "fixed", top: 24, left: 24, zIndex: 20,
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

      {/* Scrollable content — centered column */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 pt-3 pb-32 overflow-y-auto">
        <div className="w-full max-w-md">

        {/* ── Main study card ── */}
        <div className="rounded-3xl p-5" style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", backdropFilter:"blur(12px)", boxShadow:"0 4px 40px rgba(0,0,0,0.5)", animation:"fadeUp 0.4s ease both" }}>

          {/* Card header */}
          <div className="flex items-center gap-2 mb-5">
            <span className="text-[17px] font-bold tracking-[-0.3px]" style={{ color:"rgba(255,255,255,0.9)" }}>Auto-Learn</span>
            <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background:theme.accentMid, color:theme.accent, border:`1px solid ${theme.cardBorder}` }}>
              Session 21
            </span>
            <button className="ml-auto flex items-center gap-0.5 text-[13px] font-medium" style={{ color:"rgba(255,255,255,0.3)" }}>
              History
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Goal + arc */}
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] mb-2" style={{ color:"rgba(255,255,255,0.28)" }}>Study Goal</p>
              <GoalDropdown value={goalItems} onChange={setGoalItems} theme={theme} />
            </div>
            <div className="mr-1">
              <ArcGauge pct={pct} done={done} total={goalItems} theme={theme} />
            </div>
          </div>

          {/* Divider */}
          <div style={{ height:"1px", background:"rgba(255,255,255,0.06)", margin:"2px 0 4px" }} />

          {/* New Words row */}
          <div className="flex items-center justify-between py-3.5" style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-[15px] font-medium" style={{ color:"rgba(255,255,255,0.38)" }}>New Words</span>
            <div className="flex items-center gap-1">
              <span className="text-[15px] font-bold" style={{ color:"rgba(255,255,255,0.82)" }}>{newWords}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>

          {/* Review Words row */}
          <div className="flex items-center justify-between py-3.5">
            <span className="text-[15px] font-medium" style={{ color:"rgba(255,255,255,0.38)" }}>Review Words</span>
            <div className="flex items-center gap-1">
              <span className="text-[15px] font-bold" style={{ color:"rgba(255,255,255,0.82)" }}>{reviewWords}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>

          {/* Continue Learning button */}
          <button
            onClick={() => router.push(`/study/${level}/session`)}
            className="mt-4 w-full py-4 rounded-[18px] text-[16px] font-bold tracking-wide transition-all duration-200"
            style={{
              background: `rgba(${theme.accentRgb},0.12)`,
              border: `1.5px solid ${theme.cardBorder}`,
              color: theme.accent,
              fontFamily: "'Noto Sans JP',sans-serif",
              letterSpacing: "0.04em",
              boxShadow: `0 0 32px rgba(${theme.accentRgb},0.14), inset 0 1px 0 rgba(${theme.accentRgb},0.1)`,
            }}
            onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background=`rgba(${theme.accentRgb},0.22)`; b.style.boxShadow=`0 0 44px rgba(${theme.accentRgb},0.28)`; b.style.transform="scale(1.01)"; }}
            onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background=`rgba(${theme.accentRgb},0.12)`; b.style.boxShadow=`0 0 32px rgba(${theme.accentRgb},0.14)`; b.style.transform="scale(1)"; }}
          >
            Continue Learning
          </button>
        </div>

        {/* ── Stats section ── */}
        <div className="mt-7" style={{ animation:"fadeUp 0.45s ease 0.08s both", opacity:0 }}>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[17px] font-bold tracking-[-0.3px]" style={{ color:"rgba(255,255,255,0.88)" }}>{LEVEL} Study Stats</h2>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M12 2l2.9 6.26L22 9.27l-5 5.14 1.18 7.23L12 18.4l-6.18 3.24L7 14.41 2 9.27l7.1-1.01L12 2z" stroke="rgba(255,255,255,0.2)" strokeWidth="1.6" strokeLinejoin="round"/>
              </svg>
            </div>
            <button className="flex items-center gap-0.5 text-[13px] font-medium" style={{ color:"rgba(255,255,255,0.3)" }}>
              All Words
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", backdropFilter:"blur(8px)" }}>
            <StatRow label="Mastered Words" value={mastered} max={total} theme={theme} />
            <StatRow label="Studied Words"  value={studied}  max={total} theme={theme} />
          </div>
        </div>
        </div>{/* end max-w-md */}
      </main>

      <BottomTabs active="word" theme={theme} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600&family=Noto+Serif+JP:wght@400;600;700&display=swap');
        @keyframes fadeUp  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fdDown  { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        .desktop-back-btn { display: none; }
        @media (min-width: 768px) { .desktop-back-btn { display: flex !important; } }
      `}</style>
    </div>
  );
}
