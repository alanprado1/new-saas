"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { useStudySnapshot } from "@/components/StudyCacheProvider";
import { buildStudyLevel } from "@/lib/study-data";
import {
  DEFAULT_LEARNING_DIRECTION,
  getStoredLearningDirection,
  resolveLearningDirection,
  type LearningDirection,
} from "@/lib/language";
import { Meter, PageHeader, Panel, Pill, StudyLevelRow, decksFor, rememberStudyLevel } from "./study-ui";
import type { StudySummary } from "@/lib/study-summary";

function CountTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl px-3.5 py-3" style={{ background: "var(--s2)" }}>
      <b className="block text-[26px] font-extrabold tabular-nums" style={{ color: "var(--ink)" }}>{value}</b>
      <span className="text-[13px]" style={{ color: "var(--mut)" }}>{label}</span>
    </div>
  );
}

// ── Level dashboard (shared by /study and /study/[level]) ─────────────────────
export default function LevelDashboard({ level }: { level: string }) {
  const router    = useRouter();
  const searchParams = useSearchParams();
  const LEVEL     = level.toUpperCase();
  const [learningDirection, setLearningDirection] = useState<LearningDirection>(
    resolveLearningDirection(searchParams.get("direction")) ?? DEFAULT_LEARNING_DIRECTION,
  );

  const { snapshot, error, retry } = useStudySnapshot(learningDirection);
  const built = useMemo(() => snapshot ? buildStudyLevel(snapshot, level) : null, [snapshot, level]);
  const summary: StudySummary | null = built?.summary ?? null;
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

  const decks = decksFor(learningDirection);

  // Remember the level so /study reopens it next time.
  useEffect(() => { rememberStudyLevel(learningDirection, level); }, [learningDirection, level]);

  const levelSummaries = useMemo(() => {
    const result: Record<string, StudySummary | undefined> = {};
    if (!snapshot) return result;
    for (const deck of decks) result[deck.slug] = buildStudyLevel(snapshot, deck.slug).summary;
    return result;
  }, [snapshot, decks]);

  const newWords = summary?.sessionNew ?? 0;
  const reviewWords = summary?.sessionReviews ?? 0;
  const total = summary?.total ?? 0;
  const nextCard = built?.cards[0];
  // The next card is a single word in Japanese-to-English; English sentence
  // cards are too long for a preview.
  const nextWord = nextCard ? (nextCard.targetText ?? nextCard.kanji) : "";
  const nextMeaning = nextCard ? (nextCard.supportText ?? nextCard.meaning) : "";
  const disabledButton = loadingSummary || Boolean(summaryError) || !summary?.sessionTotal || openingSession;

  return (
    <AppShell active="study">
      <main className="grid max-w-[1100px] gap-[22px] px-4 py-6 md:px-9 md:py-[30px]" style={{ color: "var(--ink)" }}>
        <PageHeader direction={learningDirection} />
        <StudyLevelRow decks={decks} direction={learningDirection} activeSlug={level} summaries={levelSummaries} />

        <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* ── Auto-Learn ── */}
          <Panel label="Auto-Learn">
            <div className="flex items-center gap-2.5">
              <h2 className="m-0 text-[18px] font-bold tracking-[-0.01em]">Auto-Learn</h2>
              <Pill>{LEVEL} vocabulary</Pill>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-center gap-x-3.5 gap-y-1.5">
              <span className="text-[14px]" style={{ color: "var(--mut)" }}>Level progress</span>
              {loadingSummary
                ? <div aria-label="Loading progress" role="status" className="h-5 w-32 animate-pulse rounded" style={{ background: "var(--s3)" }} />
                : <span className="font-bold tabular-nums" style={{ color: "var(--ink)" }}>
                    {summaryError ? "Progress unavailable" : `${summary?.studied ?? 0} of ${total} studied · ${summary?.progressPercent ?? 0}%`}
                  </span>}
              <div className="col-span-2"><Meter pct={summary?.progressPercent ?? 0} /></div>
            </div>

            {summaryError && (
              <div role="alert" className="rounded-xl px-4 py-3 text-[13px]"
                style={{ color: "var(--bad)", background: "color-mix(in oklab, var(--bad) 14%, var(--s1))", border: "1px solid color-mix(in oklab, var(--bad) 34%, var(--s1))" }}>
                {summaryError}
                <button onClick={retry} className="ml-2 font-semibold underline">Retry</button>
              </div>
            )}
            {!loadingSummary && !summaryError && total === 0 && (
              <p className="m-0 text-[13px] leading-relaxed" style={{ color: "var(--mut)" }}>
                No vocabulary cards are available for this level yet.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <CountTile value={loadingSummary || summaryError ? "—" : String(newWords)} label="New words" />
              <CountTile value={loadingSummary || summaryError ? "—" : String(reviewWords)} label="Review words" />
            </div>

            <button
              onClick={() => {
                if (openingSession || !summary?.sessionTotal) return;
                setOpeningSession(true);
                router.push(`/study/${level}/session?direction=${learningDirection}&tz=${new Date().getTimezoneOffset()}`);
              }}
              disabled={disabledButton}
              aria-busy={openingSession}
              className="press-feedback h-[50px] w-full rounded-xl text-[16px] font-bold transition-[filter] enabled:hover:brightness-110 disabled:cursor-not-allowed"
              style={{
                background: "var(--acc)",
                color: "var(--acc-ink)",
                border: 0,
                opacity: loadingSummary || summaryError || !summary?.sessionTotal ? 0.5 : 1,
              }}
            >
              {openingSession ? "Opening your cards…" : loadingSummary ? "Loading cards…" : summary?.sessionTotal ? `Study ${summary.sessionTotal} cards` : total ? "All caught up" : "No cards available"}
            </button>
          </Panel>

          {/* ── Next up ── */}
          <Panel label="Next up">
            <h2 className="m-0 text-[18px] font-bold tracking-[-0.01em]">Next up</h2>
            {loadingSummary
              ? <div role="status" aria-label="Loading the next card" className="mx-auto h-16 w-40 animate-pulse rounded-xl" style={{ background: "var(--s3)" }} />
              : summaryError
                ? <p className="m-0 text-[14px]" style={{ color: "var(--mut)" }}>Next card unavailable</p>
                : nextWord
                  ? <div className="grid place-items-center gap-2 pb-2 pt-1">
                      <div lang={learningDirection === "en-ja" ? "en" : "ja"}
                        className={`max-w-full text-center font-semibold leading-[1.15] ${nextWord.length > 8 ? "text-[clamp(37px,8.5vw,51px)]" : "text-[clamp(68px,20vw,109px)]"}`}
                        style={{ fontFamily: learningDirection === "en-ja" ? "var(--f-ui)" : "var(--f-study, 'Klee One', serif)", color: "var(--ink)", overflowWrap: "anywhere" }}>
                        {nextWord}
                      </div>
                      {nextMeaning && <span className="max-w-full text-center text-[15px] font-semibold" style={{ color: "var(--acc)" }}>{nextMeaning}</span>}
                    </div>
                  : <p className="m-0 text-[14px]" style={{ color: "var(--mut)" }}>{total ? "All caught up for today." : "No cards for this level yet."}</p>}
          </Panel>
        </div>
      </main>
    </AppShell>
  );
}
