"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";
import { useStudySnapshot } from "@/components/StudyCacheProvider";
import { buildStudyLevel } from "@/lib/study-data";
import {
  DEFAULT_LEARNING_DIRECTION,
  getStoredLearningDirection,
  resolveLearningDirection,
  type LearningDirection,
} from "@/lib/language";
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

// ── Stat row with progress bar ────────────────────────────────────────────────
function StatRow({ label, value, max, theme }: { label:string; value:number; max:number; theme:Theme }) {
  const pct = max > 0 ? Math.min(100, Math.round((value/max)*100)) : 0;
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LevelDashboardPage({ params }: PageProps) {
  const { level } = use(params);
  const router    = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const LEVEL     = level.toUpperCase();
  const [learningDirection, setLearningDirection] = useState<LearningDirection>(
    resolveLearningDirection(searchParams.get("direction")) ?? DEFAULT_LEARNING_DIRECTION,
  );

  const { snapshot, error, retry } = useStudySnapshot(learningDirection);
  const summary = useMemo(() => snapshot ? buildStudyLevel(snapshot, level).summary : null, [snapshot, level]);
  const summaryError = summary ? "" : error;
  const loadingSummary = !summary && !summaryError;
  const [openingSession, setOpeningSession] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const queryDirection = searchParams.get("direction");
      setLearningDirection(queryDirection ? resolveLearningDirection(queryDirection) : getStoredLearningDirection());
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [searchParams]);

  const newWords = summary?.sessionNew ?? 0;
  const reviewWords = summary?.sessionReviews ?? 0;
  const total = summary?.total ?? 0;

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
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
        <div className="my-auto w-full max-w-md">

        {/* ── Main study card ── */}
        <div className="rounded-3xl p-5" style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", backdropFilter:"blur(12px)", boxShadow:"0 4px 40px rgba(0,0,0,0.5)", animation:"fadeUp 0.4s ease both" }}>

          {/* Card header */}
          <div className="flex items-center gap-2 mb-5">
            <span className="text-[17px] font-bold tracking-[-0.3px]" style={{ color:"rgba(255,255,255,0.9)" }}>Auto-Learn</span>
            <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background:theme.accentMid, color:theme.accent, border:`1px solid ${theme.cardBorder}` }}>
              {LEVEL} vocabulary
            </span>
          </div>

          {/* Level progress */}
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.5px] mb-2" style={{ color:"rgba(255,255,255,0.45)" }}>Level Progress</p>
              {loadingSummary ? <div aria-label="Loading progress" role="status" className="h-5 w-40 animate-pulse rounded bg-white/10" /> :
                <p className="text-[15px] font-semibold" style={{ color:"rgba(255,255,255,0.88)" }}>
                  {summaryError ? "Progress unavailable" : `${summary?.studied ?? 0} of ${total} studied`}
                </p>}
            </div>
            <div className="mr-1">
              {summary && !summaryError && <ArcGauge pct={summary.progressPercent} done={summary.studied} total={total} theme={theme} />}
            </div>
          </div>

          {summaryError && (
            <div role="alert" className="mb-4 rounded-xl px-4 py-3 text-[13px]" style={{ color:"#fca5a5", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)" }}>
              {summaryError}
              <button onClick={retry} className="ml-2 underline font-semibold">Retry</button>
            </div>
          )}
          {!loadingSummary && !summaryError && total === 0 && (
            <p className="mb-4 text-[13px] leading-relaxed" style={{ color:"rgba(255,255,255,0.55)" }}>
              No vocabulary cards are available for this level yet.
            </p>
          )}

          {/* Divider */}
          <div style={{ height:"1px", background:"rgba(255,255,255,0.06)", margin:"2px 0 4px" }} />

          {/* New Words row */}
          <div className="flex items-center justify-between py-3.5" style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-[15px] font-medium" style={{ color:"rgba(255,255,255,0.38)" }}>New Words</span>
            <div className="flex items-center gap-1">
              <span className="text-[15px] font-bold" style={{ color:"rgba(255,255,255,0.82)" }}>{loadingSummary || summaryError ? "—" : newWords}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>

          {/* Review Words row */}
          <div className="flex items-center justify-between py-3.5">
            <span className="text-[15px] font-medium" style={{ color:"rgba(255,255,255,0.38)" }}>Review Words</span>
            <div className="flex items-center gap-1">
              <span className="text-[15px] font-bold" style={{ color:"rgba(255,255,255,0.82)" }}>{loadingSummary || summaryError ? "—" : reviewWords}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>

          {/* Continue Learning button */}
          <button
            onClick={() => {
              if (openingSession || !summary?.sessionTotal) return;
              setOpeningSession(true);
              router.push(`/study/${level}/session?direction=${learningDirection}&tz=${new Date().getTimezoneOffset()}`);
            }}
            disabled={loadingSummary || Boolean(summaryError) || !summary?.sessionTotal || openingSession}
            aria-busy={openingSession}
            className="press-feedback mt-4 w-full py-4 rounded-[18px] text-[16px] font-bold tracking-wide transition-all duration-200"
            style={{
              background: `rgba(${theme.accentRgb},0.12)`,
              border: `1.5px solid ${theme.cardBorder}`,
              color: theme.accent,
              fontFamily: "'Noto Sans JP',sans-serif",
              letterSpacing: "0.04em",
              boxShadow: `0 0 32px rgba(${theme.accentRgb},0.14), inset 0 1px 0 rgba(${theme.accentRgb},0.1)`,
              opacity: loadingSummary || summaryError || !summary?.sessionTotal ? 0.5 : 1,
            }}
            onMouseEnter={e => { const b=e.currentTarget as HTMLButtonElement; if (b.disabled) return; b.style.background=`rgba(${theme.accentRgb},0.22)`; b.style.boxShadow=`0 0 44px rgba(${theme.accentRgb},0.28)`; b.style.transform="scale(1.01)"; }}
            onMouseLeave={e => { const b=e.currentTarget as HTMLButtonElement; b.style.background=`rgba(${theme.accentRgb},0.12)`; b.style.boxShadow=`0 0 32px rgba(${theme.accentRgb},0.14)`; b.style.transform="scale(1)"; }}
          >
            {openingSession ? "Opening your cards…" : loadingSummary ? "Loading cards…" : summary?.sessionTotal ? `Study ${summary.sessionTotal} cards` : total ? "All caught up" : "No cards available"}
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
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", backdropFilter:"blur(8px)" }}>
            {loadingSummary ? <div role="status" aria-label="Loading study statistics" className="space-y-5 px-5 py-5 animate-pulse"><div className="h-5 rounded bg-white/10" /><div className="h-5 rounded bg-white/10" /></div> : summaryError ? <p className="px-5 py-4 text-[14px]">Statistics unavailable</p> : <>
              <StatRow label="Studied Words" value={summary?.studied ?? 0} max={total} theme={theme} />
              <StatRow label="3+ In A Row" value={summary?.strong ?? 0} max={total} theme={theme} />
            </>}
          </div>
        </div>
        </div>{/* end max-w-md */}
      </main>

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
