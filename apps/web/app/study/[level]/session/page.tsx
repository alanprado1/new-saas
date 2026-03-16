"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import StudyCard, { type StudyCardData, type Theme } from "@/components/StudyCard";
import { useTheme } from "@/hooks/useTheme";


// ─────────────────────────────────────────────────────────────────────────────
// Mock flashcard queue — swap for getDailySession() output later
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_CARDS: StudyCardData[] = [
  {
    kanji:      "西",
    reading:    "にし (nishi)",
    meaning:    "West",
    example_jp: "西へ行きます。",
    example_en: "I will go west.",
    cardType:   "new",
    nextReviewDays: 21,
  },
  {
    kanji:      "食べる",
    reading:    "たべる (taberu)",
    meaning:    "To eat",
    example_jp: "毎朝、朝ご飯を食べます。",
    example_en: "I eat breakfast every morning.",
    cardType:   "new",
    nextReviewDays: 21,
  },
  {
    kanji:      "水",
    reading:    "みず (mizu)",
    meaning:    "Water",
    example_jp: "コップに水を入れてください。",
    example_en: "Please put water in the cup.",
    cardType:   "review",
    nextReviewDays: 4,
  },
  {
    kanji:      "山",
    reading:    "やま (yama)",
    meaning:    "Mountain",
    example_jp: "あの山はとても高いです。",
    example_en: "That mountain is very tall.",
    cardType:   "review",
    nextReviewDays: 7,
  },
  {
    kanji:      "友達",
    reading:    "ともだち (tomodachi)",
    meaning:    "Friend",
    example_jp: "友達と一緒に映画を見ました。",
    example_en: "I watched a movie together with a friend.",
    cardType:   "new",
    nextReviewDays: 21,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Format elapsed seconds as MM:SS */
function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Completion screen
// ─────────────────────────────────────────────────────────────────────────────
function CompletionScreen({
  total,
  againCount,
  elapsed,
  theme,
  onBack,
}: {
  total: number;
  againCount: number;
  elapsed: number;
  theme: Theme;
  onBack: () => void;
}) {
  const knowCount = total - againCount;
  const accuracy  = total > 0 ? Math.round((knowCount / total) * 100) : 0;

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
      style={{ animation: "sc-fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      {/* Glow orb */}
      <div
        className="relative flex items-center justify-center mb-8"
        style={{ width: 120, height: 120 }}
      >
        {/* Pulsing outer ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(${theme.accentRgb},0.2) 0%, transparent 70%)`,
            animation: "pulseRing 2.4s ease-in-out infinite",
          }}
        />
        {/* Inner circle */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: theme.accentMid,
            border: `1.5px solid ${theme.cardBorder}`,
            boxShadow: `0 0 40px rgba(${theme.accentRgb},0.35), inset 0 1px 0 rgba(${theme.accentRgb},0.2)`,
          }}
        >
          <span style={{ fontSize: "2.2rem", lineHeight: 1 }}>🎉</span>
        </div>
      </div>

      {/* Headline */}
      <h1
        className="text-[28px] font-bold tracking-[-0.5px] mb-2"
        style={{
          color: "rgba(255,255,255,0.95)",
          fontFamily: "'Kikai Chokoku JIS','Noto Serif JP',serif",
          textShadow: `0 0 48px rgba(${theme.accentRgb},0.3)`,
        }}
      >
        Session Complete!
      </h1>
      <p
        className="text-[14px] mb-10"
        style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'Noto Sans JP',sans-serif" }}
      >
        You reviewed all {total} cards for this session.
      </p>

      {/* Stats grid */}
      <div
        className="w-full rounded-2xl overflow-hidden mb-8"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
        }}
      >
        {[
          { label: "Cards Reviewed", value: String(total),          icon: "📚" },
          { label: "Known",          value: `${knowCount}/${total}`, icon: "✓",  accent: true },
          { label: "Again",          value: `${againCount}/${total}`,icon: "↺" },
          { label: "Accuracy",       value: `${accuracy}%`,         icon: "◎",  accent: accuracy >= 80 },
          { label: "Time Spent",     value: fmtTime(elapsed),        icon: "⏱" },
        ].map(({ label, value, icon, accent }, i, arr) => (
          <div
            key={label}
            className="flex items-center justify-between px-5 py-3.5"
            style={{
              borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
            }}
          >
            <div className="flex items-center gap-2.5">
              <span style={{ fontSize: "1rem", opacity: 0.7 }}>{icon}</span>
              <span
                className="text-[14px] font-medium"
                style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Noto Sans JP',sans-serif" }}
              >
                {label}
              </span>
            </div>
            <span
              className="text-[15px] font-bold tabular-nums"
              style={{
                color: accent ? theme.accent : "rgba(255,255,255,0.8)",
                fontFamily: "'Noto Sans JP',sans-serif",
                textShadow: accent ? `0 0 14px rgba(${theme.accentRgb},0.5)` : "none",
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Back to dashboard button */}
      <button
        onClick={onBack}
        className="w-full py-4 rounded-[18px] text-[16px] font-bold tracking-wide transition-all duration-200"
        style={{
          background: `rgba(${theme.accentRgb},0.13)`,
          border: `1.5px solid ${theme.cardBorder}`,
          color: theme.accent,
          fontFamily: "'Noto Sans JP',sans-serif",
          letterSpacing: "0.04em",
          boxShadow: `0 0 32px rgba(${theme.accentRgb},0.14), inset 0 1px 0 rgba(${theme.accentRgb},0.1)`,
        }}
        onMouseEnter={e => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.background = `rgba(${theme.accentRgb},0.24)`;
          b.style.boxShadow  = `0 0 44px rgba(${theme.accentRgb},0.28)`;
          b.style.transform  = "scale(1.015)";
        }}
        onMouseLeave={e => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.background = `rgba(${theme.accentRgb},0.13)`;
          b.style.boxShadow  = `0 0 32px rgba(${theme.accentRgb},0.14)`;
          b.style.transform  = "scale(1)";
        }}
      >
        Back to Dashboard
      </button>

      {/* Study again (ghost) */}
      <button
        className="mt-3 w-full py-3.5 rounded-[18px] text-[14px] font-semibold transition-all duration-150"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.38)",
          fontFamily: "'Noto Sans JP',sans-serif",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.65)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.38)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
      >
        Study Again
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Page
// ─────────────────────────────────────────────────────────────────────────────
interface PageProps {
  params: Promise<{ level: string }>;
}

export default function SessionPage({ params }: PageProps) {
  const { level } = use(params);
  const router    = useRouter();
  const { theme } = useTheme();

  // ── Card queue state ───────────────────────────────────────────────────────
  // `queue` starts as the mock cards. Failed cards (Again) are re-appended
  // so the user sees them again before the session ends — standard SRS loop.
  const [queue,        setQueue]        = useState<StudyCardData[]>(MOCK_CARDS);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Track how many distinct cards have been answered (for progress bar)
  const totalCards = MOCK_CARDS.length;
  // `done` = cards answered correctly at least once (capped at totalCards)
  const [done,       setDone]       = useState(0);
  // Track total "Again" presses (for completion stats)
  const [againCount, setAgainCount] = useState(0);
  // Tracks item_ids seen in this session so we only count each card once for `done`
  const seenRef = useRef<Set<string>>(new Set());

  // ── Session timer ──────────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Current card ──────────────────────────────────────────────────────────
  const isComplete  = currentIndex >= queue.length;
  const currentCard = isComplete ? null : queue[currentIndex];
  const nextCard    = queue[currentIndex + 1] ?? null;

  // ── Advance helper ────────────────────────────────────────────────────────
  const advance = useCallback(() => {
    setCurrentIndex(i => i + 1);
  }, []);

  // ── onKnow ────────────────────────────────────────────────────────────────
  // Mark as known → advance. Track unique cards for progress.
  const handleKnow = useCallback(() => {
    if (!currentCard) return;
    const id = currentCard.kanji; // use kanji as a unique key (swap for item_id later)
    if (!seenRef.current.has(id)) {
      seenRef.current.add(id);
      setDone(d => Math.min(d + 1, totalCards));
    }
    advance();
  }, [currentCard, advance, totalCards]);

  // ── onAgain ───────────────────────────────────────────────────────────────
  // Mark as failed → re-append to end of queue so user sees it again.
  const handleAgain = useCallback(() => {
    if (!currentCard) return;
    setAgainCount(c => c + 1);
    // Append a fresh copy (new object ref so React re-renders cleanly)
    setQueue(q => [...q, { ...currentCard }]);
    advance();
  }, [currentCard, advance]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: "100%", minHeight: "100dvh", display: "flex", flexDirection: "column",
        background: "#07070f",
        backgroundImage: theme.gradient,
        fontFamily: "'Noto Sans JP',sans-serif",
      }}
    >
      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.18]"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
          backgroundSize: "128px",
          mixBlendMode: "overlay",
          zIndex: 0,
        }}
      />

      {/* Desktop back button */}
      <button
        onClick={() => router.push(`/study/${level}`)}
        className="desktop-back-btn"
        style={{
          position: "fixed", top: 24, left: 24, zIndex: 30,
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

      {/* ── Session complete ── */}
      {isComplete ? (
        <div className="relative z-10 flex-1 px-4 pb-10 flex flex-col justify-center items-center">
          <div className="w-full max-w-md">
            <CompletionScreen
              total={totalCards}
              againCount={againCount}
              elapsed={elapsed}
              theme={theme}
              onBack={() => router.push(`/study/${level}`)}
            />
          </div>
        </div>
      ) : (
        /* ── Active card — key forces remount/re-animation on every flip ── */
        <div className="relative z-10 flex-1 flex flex-col items-center">
          <div className="w-full max-w-md flex flex-col flex-1">
            <StudyCard
              card={currentCard!}
              nextCard={nextCard}
              theme={theme}
              onAgain={handleAgain}
              onKnow={handleKnow}
              progress={{ done, total: totalCards }}
              timer={fmtTime(elapsed)}
            />
          </div>
        </div>
      )}

      {/* Global keyframes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;600&family=Noto+Serif+JP:wght@300;400;600&display=swap');

        @keyframes sc-fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseRing {
          0%, 100% { transform: scale(1);    opacity: 0.6; }
          50%       { transform: scale(1.18); opacity: 0.25; }
        }
        .desktop-back-btn { display: none; }
        @media (min-width: 768px) { .desktop-back-btn { display: flex !important; } }
      `}</style>
    </div>
  );
}