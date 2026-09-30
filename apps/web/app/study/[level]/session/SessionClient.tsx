"use client";

// app/study/[level]/session/SessionClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Interactive shell for the study session.
// Receives pre-fetched due cards from the Server Component and owns all
// queue state, the timer, rating logic, and the completion screen.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import StudyCard, { type StudyCardData, type Theme } from "@/components/StudyCard";
import { useTheme } from "@/hooks/useTheme";
import { saveCardProgress } from "@/app/actions/study";
import { type SM2State, DEFAULT_SM2_STATE } from "@/lib/sm2";
import { DEFAULT_LEARNING_DIRECTION } from "@/lib/language";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
  ratingCount,
  elapsed,
  theme,
  onBack,
}: {
  total:      number;
  againCount: number;
  ratingCount: number;
  elapsed:    number;
  theme:      Theme;
  onBack:     () => void;
}) {
  const passedRatings = ratingCount - againCount;
  const passRate = ratingCount > 0 ? Math.round((passedRatings / ratingCount) * 100) : 0;

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
      style={{ animation: "sc-fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      {/* Glow orb */}
      <div className="relative flex items-center justify-center mb-8" style={{ width: 120, height: 120 }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(${theme.accentRgb},0.2) 0%, transparent 70%)`,
            animation: "pulseRing 2.4s ease-in-out infinite",
          }}
        />
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
          { label: "Cards Reviewed", value: String(total),           icon: "📚" },
          { label: "Passed Ratings", value: `${passedRatings}/${ratingCount}`, icon: "✓", accent: true },
          { label: "Again Ratings",  value: String(againCount), icon: "↺" },
          { label: "Pass Rate",      value: `${passRate}%`, icon: "◎", accent: passRate >= 80 },
          { label: "Time Spent",     value: fmtTime(elapsed),         icon: "⏱" },
        ].map(({ label, value, icon, accent }, i, arr) => (
          <div
            key={label}
            className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
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
                color:      accent ? theme.accent : "rgba(255,255,255,0.8)",
                fontFamily: "'Noto Sans JP',sans-serif",
                textShadow: accent ? `0 0 14px rgba(${theme.accentRgb},0.5)` : "none",
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Back to dashboard */}
      <button
        onClick={onBack}
        className="w-full py-4 rounded-[18px] text-[16px] font-bold tracking-wide transition-all duration-200"
        style={{
          background:    `rgba(${theme.accentRgb},0.13)`,
          border:        `1.5px solid ${theme.cardBorder}`,
          color:         theme.accent,
          fontFamily:    "'Noto Sans JP',sans-serif",
          letterSpacing: "0.04em",
          boxShadow:     `0 0 32px rgba(${theme.accentRgb},0.14), inset 0 1px 0 rgba(${theme.accentRgb},0.1)`,
          cursor:        "pointer",
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

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SessionClient
// ─────────────────────────────────────────────────────────────────────────────

interface SessionClientProps {
  initialCards: StudyCardData[];
  level:        string;
}

export default function SessionClient({ initialCards, level }: SessionClientProps) {
  const router    = useRouter();
  const { theme } = useTheme();

  // ── Card queue ─────────────────────────────────────────────────────────────
  const [queue,        setQueue]        = useState<StudyCardData[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);

  const totalCards = initialCards.length;
  const [done,       setDone]       = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const saveInFlightRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());

  // ── Session timer ──────────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Current / next card ────────────────────────────────────────────────────
  const isComplete  = currentIndex >= queue.length;
  const currentCard = isComplete ? null : queue[currentIndex];
  const nextCard    = queue[currentIndex + 1] ?? null;

  // ── Advance ────────────────────────────────────────────────────────────────
  const advance = useCallback(() => {
    setCurrentIndex(i => i + 1);
  }, []);

  // ── handleRate ────────────────────────────────────────────────────────────
  const handleRate = useCallback(async (rating: "again" | "hard" | "good" | "easy") => {
    if (!currentCard || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setIsSaving(true);
    setSaveError("");
    const movedAhead = currentIndex + 1 < queue.length;
    if (movedAhead) advance();

    const sm2State: SM2State = {
      repetition:  currentCard.repetition  ?? DEFAULT_SM2_STATE.repetition,
      interval:    currentCard.interval    ?? DEFAULT_SM2_STATE.interval,
      ease_factor: currentCard.ease_factor ?? DEFAULT_SM2_STATE.ease_factor,
    };
    try {
      const savedState = await saveCardProgress(
        currentCard.kanji,
        rating,
        sm2State,
        currentCard.learningDirection ?? DEFAULT_LEARNING_DIRECTION,
        new Date().getTimezoneOffset(),
      );
      setRatingCount(count => count + 1);
      if (rating === "again") {
        setAgainCount(count => count + 1);
        setQueue(cards => [...cards, {
          ...currentCard,
          repetition: savedState.repetition,
          interval: savedState.interval,
          ease_factor: savedState.ease_factor,
          nextReviewDays: savedState.interval,
        }]);
      } else {
        const id = `${currentCard.learningDirection ?? DEFAULT_LEARNING_DIRECTION}:${currentCard.kanji}`;
        if (!seenRef.current.has(id)) {
          seenRef.current.add(id);
          setDone(count => Math.min(count + 1, totalCards));
        }
      }
      if (!movedAhead) advance();
    } catch (error) {
      if (movedAhead) setCurrentIndex(index => Math.max(0, index - 1));
      setSaveError(error instanceof Error ? error.message : "Your answer could not be saved. Please retry.");
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }, [currentCard, currentIndex, queue.length, advance, totalCards]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="session-screen"
      style={{
        width: "100%", height: "100dvh", minHeight: 0, display: "flex", flexDirection: "column",
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
        onClick={() => router.back()}
        disabled={isSaving}
        aria-busy={isSaving}
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
              ratingCount={ratingCount}
              elapsed={elapsed}
              theme={theme}
              onBack={() => router.push(`/study/${level}`)}
            />
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center">
          <div className="w-full max-w-md md:max-w-[75vw] flex flex-col flex-1 min-h-0">
            <StudyCard
              card={currentCard!}
              nextCard={nextCard}
              theme={theme}
              onRate={handleRate}
              isSaving={isSaving}
              saveError={saveError}
              progress={{ done, total: totalCards }}
              timer={fmtTime(elapsed)}
            />
          </div>
        </div>
      )}

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
        .session-screen {
          padding-top: env(safe-area-inset-top, 0px);
          padding-bottom: max(env(safe-area-inset-bottom, 0px), 42px);
        }
        @media (min-width: 768px) {
          .session-screen { padding: 0; }
        }
      `}</style>
    </div>
  );
}
