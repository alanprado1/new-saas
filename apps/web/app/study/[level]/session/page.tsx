"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useStudySnapshot } from "@/components/StudyCacheProvider";
import StudySessionSkeleton from "@/components/StudySessionSkeleton";
import { buildStudyLevel } from "@/lib/study-data";
import { resolveLearningDirection } from "@/lib/language";
import type { StudyCardData } from "@/components/StudyCard";
import SessionClient from "./SessionClient";

export default function SessionPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = use(params);
  const direction = resolveLearningDirection(useSearchParams().get("direction"));
  const { snapshot, cacheKey, isFresh, error, retry } = useStudySnapshot(direction);
  const cards = useMemo(() => snapshot ? buildStudyLevel(snapshot, level).cards : null, [snapshot, level]);
  const sessionKey = `${snapshot?.userId}:${direction}:${level}`;
  const back = `/study/${level}?direction=${direction}`;
  if (cards && snapshot) return <LoadedSession key={sessionKey} cards={cards} level={level} cacheKey={cacheKey} back={back} userId={snapshot.userId} ready={isFresh} error={error} retry={retry} />;
  if (!cards && !error) return <StudySessionSkeleton />;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#07070f] px-6 text-center text-white">
      <h1 className="text-2xl font-semibold">{error && !cards ? "Could not load your cards" : "No cards to study right now"}</h1>
      <p className="max-w-sm text-sm text-white/50">{error && !cards ? error : `There are no available ${level.toUpperCase()} cards right now. Your reviews may be scheduled for later.`}</p>
      {!cards && error && <button onClick={retry} className="press-feedback rounded-xl bg-white/10 px-6 py-3">Retry</button>}
      <Link href={back} className="rounded-xl border border-white/10 px-6 py-3 text-white/70">← Back to Dashboard</Link>
    </main>
  );
}

function LoadedSession({ cards, level, cacheKey, back, userId, ready = true, error = "", retry }: { cards: StudyCardData[]; level: string; cacheKey: string; back: string; userId: string; ready?: boolean; error?: string; retry?: () => void }) {
  // Adopt refreshed cards until the first rating, then preserve the active queue
  // through cache updates and the final successful save.
  const [sessionCards, setSessionCards] = useState<StudyCardData[] | null>(null);
  const activeCards = sessionCards ?? cards;
  if (activeCards.length) return <>
    {!sessionCards && error && <div role="alert" className="bg-[#07070f] px-4 py-3 text-center text-sm text-red-300">{error} <button onClick={retry} className="underline">Retry</button></div>}
    <SessionClient initialCards={activeCards} level={level} cacheKey={cacheKey} userId={userId} ready={Boolean(sessionCards) || ready} onStart={() => setSessionCards(activeCards)} />
  </>;
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#07070f] px-6 text-center text-white">
    <h1 className="text-2xl font-semibold">No cards to study right now</h1>
    <p className="max-w-sm text-sm text-white/50">There are no available {level.toUpperCase()} cards right now. Your reviews may be scheduled for later.</p>
    <Link href={back} className="rounded-xl border border-white/10 px-6 py-3 text-white/70">← Back to Dashboard</Link>
  </main>;
}
