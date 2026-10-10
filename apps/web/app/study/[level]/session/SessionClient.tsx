"use client";

// app/study/[level]/session/SessionClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Interactive shell for the study session.
// Receives pre-fetched due cards from the Server Component and owns all
// queue state, the timer, rating logic, and the completion screen.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import StudyCard, { type StudyCardData } from "@/components/StudyCard";
import { saveCardProgress } from "@/app/actions/study";
import { type SM2State, DEFAULT_SM2_STATE } from "@/lib/sm2";
import { DEFAULT_LEARNING_DIRECTION } from "@/lib/language";
import { cacheSavedStudyProgress } from "@/components/StudyCacheProvider";
import { saveWithRetry } from "@/lib/study-save";

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
  onBack,
}: {
  total:      number;
  againCount: number;
  ratingCount: number;
  elapsed:    number;
  onBack:     () => void;
}) {
  const passedRatings = ratingCount - againCount;
  const passRate = ratingCount > 0 ? Math.round((passedRatings / ratingCount) * 100) : 0;

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
      style={{ animation: "sc-fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      {/* Completion mark */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-8"
        style={{ background: "var(--acc-soft)", border: "1.5px solid var(--acc-line)", color: "var(--acc)" }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>

      {/* Headline */}
      <h1
        className="text-[28px] font-extrabold tracking-[-0.5px] mb-2"
        style={{ color: "var(--ink)", fontFamily: "var(--f-ui, system-ui), var(--f-jp), sans-serif" }}
      >
        Session Complete!
      </h1>
      <p
        className="text-[14px] mb-10"
        style={{ color: "var(--mut)", fontFamily: "var(--f-ui, system-ui), var(--f-jp), sans-serif" }}
      >
        You reviewed all {total} cards for this session.
      </p>

      {/* Stats grid */}
      <div
        className="w-full rounded-2xl overflow-hidden mb-8"
        style={{ background: "var(--s1)", border: "1px solid var(--ln)" }}
      >
        {[
          { label: "Cards Reviewed", value: String(total) },
          { label: "Passed Ratings", value: `${passedRatings}/${ratingCount}`, accent: true },
          { label: "Again Ratings",  value: String(againCount) },
          { label: "Pass Rate",      value: `${passRate}%`, accent: passRate >= 80 },
          { label: "Time Spent",     value: fmtTime(elapsed) },
        ].map(({ label, value, accent }, i, arr) => (
          <div
            key={label}
            className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--ln)" : "none" }}
          >
            <span
              className="text-[14px] font-medium"
              style={{ color: "var(--mut)", fontFamily: "var(--f-ui, system-ui), var(--f-jp), sans-serif" }}
            >
              {label}
            </span>
            <span
              className="text-[15px] font-bold tabular-nums"
              style={{ color: accent ? "var(--acc)" : "var(--ink)", fontFamily: "var(--f-ui, system-ui), var(--f-jp), sans-serif" }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Back to dashboard */}
      <button
        onClick={onBack}
        className="press-feedback w-full h-[50px] rounded-xl text-[16px] font-bold transition-[filter] hover:brightness-110"
        style={{
          background: "var(--acc)",
          color:      "var(--acc-ink)",
          border:     0,
          fontFamily: "var(--f-ui, system-ui), var(--f-jp), sans-serif",
          cursor:     "pointer",
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
  cacheKey: string;
  userId: string;
  ready?: boolean;
  onStart?: () => void;
}

export default function SessionClient({ initialCards, level, cacheKey, userId, ready = true, onStart }: SessionClientProps) {
  const router    = useRouter();

  // ── Card queue ─────────────────────────────────────────────────────────────
  const [savedQueue, setQueue] = useState<StudyCardData[]>(initialCards);
  const [hasRated, setHasRated] = useState(false);
  const queue = hasRated ? savedQueue : initialCards;
  const [currentIndex, setCurrentIndex] = useState(0);

  const totalCards = initialCards.length;
  const [done,       setDone]       = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const saveInFlightRef = useRef(false);
  const saveAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => { saveAbortRef.current?.abort(); }, []);
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
    if (!currentCard || !ready || saveInFlightRef.current) return;
    if (!hasRated) { setQueue(initialCards); setHasRated(true); onStart?.(); }
    saveInFlightRef.current = true;
    const controller = new AbortController();
    saveAbortRef.current = controller;
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
      const savedState = await saveWithRetry(() => saveCardProgress(
        currentCard.kanji,
        rating,
        sm2State,
        currentCard.learningDirection ?? DEFAULT_LEARNING_DIRECTION,
        new Date().getTimezoneOffset(),
        userId,
      ), undefined, controller.signal);
      cacheSavedStudyProgress(cacheKey, currentCard.kanji, savedState);
      controller.signal.throwIfAborted();
      setRatingCount(count => count + 1);
      if (rating === "again") {
        setAgainCount(count => count + 1);
        setQueue(cards => [...cards, {
          ...currentCard,
          cardType: "review",
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
      if (controller.signal.aborted) return;
      if (movedAhead) setCurrentIndex(index => Math.max(0, index - 1));
      setSaveError(error instanceof Error ? error.message : "Your answer could not be saved. Please retry.");
    } finally {
      saveInFlightRef.current = false;
      if (!controller.signal.aborted) setIsSaving(false);
    }
  }, [currentCard, currentIndex, queue.length, advance, totalCards, cacheKey, userId, ready, hasRated, initialCards, onStart]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="session-screen"
      style={{
        width: "100%", height: "100dvh", minHeight: 0, display: "flex", flexDirection: "column",
        background: "var(--g)",
        color: "var(--ink)",
        fontFamily: "var(--f-ui, system-ui), var(--f-jp), sans-serif",
      }}
    >
      {/* Desktop back button */}
      <button
        onClick={() => router.back()}
        disabled={isSaving}
        aria-busy={isSaving}
        className="desktop-back-btn sc-back"
        style={{
          position: "fixed", top: 24, left: 24, zIndex: 30,
          alignItems: "center", gap: 6,
          background: "var(--s1)", border: "1px solid var(--ln)",
          borderRadius: 10, padding: "7px 13px",
          color: "var(--mut)", fontSize: 13, fontWeight: 600,
          cursor: "pointer",
        }}
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
              onBack={() => router.push(`/study/${level}?direction=${initialCards[0]?.learningDirection ?? DEFAULT_LEARNING_DIRECTION}`)}
            />
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center">
          <div className="w-full max-w-md md:max-w-[75vw] flex flex-col flex-1 min-h-0">
            <StudyCard
              card={currentCard!}
              nextCard={nextCard}
              onRate={handleRate}
              isSaving={isSaving || !ready}
              saveError={saveError}
              progress={{ done, total: totalCards }}
              timer={fmtTime(elapsed)}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes sc-fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .desktop-back-btn { display: none; }
        @media (min-width: 768px) { .desktop-back-btn { display: flex !important; } }
        .sc-back:hover:not(:disabled) { background: var(--s2) !important; color: var(--ink) !important; }
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
