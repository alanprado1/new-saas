"use client";

// Shared Graphite pieces for the Study pages: level definitions, the level
// tile row, panels, meters and pills. All colours come from theme tokens so
// the dock's theme and ground controls re-theme these pages live.

import Link from "next/link";
import type { ReactNode } from "react";
import type { LearningDirection } from "@/lib/language";
import type { StudySummary } from "@/lib/study-summary";

export type StudyDeck = {
  level: string;
  slug: string;
  desc: string;
};

export const JAPANESE_DECKS: StudyDeck[] = [
  { level: "N5", slug: "n5", desc: "Beginner" },
  { level: "N4", slug: "n4", desc: "Elementary" },
  { level: "N3", slug: "n3", desc: "Intermediate" },
  { level: "N2", slug: "n2", desc: "Upper-Inter" },
  { level: "N1", slug: "n1", desc: "Advanced" },
];

export const ENGLISH_DECKS: StudyDeck[] = [
  { level: "A1", slug: "en-a1", desc: "Starter" },
  { level: "A2", slug: "en-a2", desc: "Elementary" },
  { level: "B1", slug: "en-b1", desc: "Intermediate" },
  { level: "B2", slug: "en-b2", desc: "Upper-Inter" },
  { level: "C1", slug: "en-c1", desc: "Advanced" },
];

export function decksFor(direction: LearningDirection): StudyDeck[] {
  return direction === "en-ja" ? ENGLISH_DECKS : JAPANESE_DECKS;
}

// The last level opened is remembered per learning direction, so /study
// reopens it. First visit (or an unknown value) falls back to the first deck (N5 / A1).
const studyLevelKey = (direction: LearningDirection) => `anigo-study-level:${direction}`;

export function rememberStudyLevel(direction: LearningDirection, slug: string) {
  if (!decksFor(direction).some(d => d.slug === slug.toLowerCase())) return;
  try { localStorage.setItem(studyLevelKey(direction), slug.toLowerCase()); } catch { /* storage unavailable */ }
}

export function readStudyLevel(direction: LearningDirection): string {
  const decks = decksFor(direction);
  try {
    const saved = localStorage.getItem(studyLevelKey(direction));
    if (saved && decks.some(d => d.slug === saved)) return saved;
  } catch { /* storage unavailable */ }
  return decks[0].slug;
}

export function Meter({ pct, color = "var(--acc)", height = 6 }: { pct: number; color?: string; height?: number }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-full" style={{ height, background: "var(--s3)" }}>
      <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
    </div>
  );
}

export function Pill({ children, color = "var(--acc)" }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex h-6 items-center rounded-[7px] px-[9px] text-[12px] font-bold"
      style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}
    >
      {children}
    </span>
  );
}

export function Panel({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <section
      aria-label={label}
      className="grid content-start gap-4 rounded-[20px] p-[22px]"
      style={{ background: "var(--s1)", border: "1px solid var(--ln)" }}
    >
      {children}
    </section>
  );
}

export function PageHeader({ direction }: { direction: LearningDirection }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h1 className="m-0 text-[30px] font-extrabold leading-[1.15] tracking-[-0.025em]" style={{ color: "var(--ink)" }}>Study</h1>
      <Pill color="var(--mut)">{direction === "en-ja" ? "Learning English" : "Learning Japanese"}</Pill>
    </div>
  );
}

export function StudyLevelRow({
  decks,
  direction,
  activeSlug,
  summaries,
}: {
  decks: StudyDeck[];
  direction: LearningDirection;
  activeSlug?: string;
  summaries?: Record<string, StudySummary | undefined>;
}) {
  return (
    <nav aria-label="Study levels" className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
      {decks.map(deck => {
        const on = deck.slug.toLowerCase() === activeSlug?.toLowerCase();
        const summary = summaries?.[deck.slug];
        const hasData = Boolean(summary && summary.total > 0);
        return (
          <Link
            key={deck.slug}
            href={`/study/${deck.slug}?direction=${direction}`}
            aria-current={on ? "page" : undefined}
            className="press-feedback grid min-w-[112px] flex-1 content-start gap-1.5 rounded-[14px] px-4 py-3.5 no-underline transition-colors"
            style={{
              border: `1px solid ${on ? "var(--acc)" : "var(--ln)"}`,
              background: on ? "var(--acc-soft)" : "var(--s1)",
              color: "var(--ink)",
            }}
          >
            <b className="text-[22px] font-extrabold leading-tight tracking-[-0.02em]" style={{ color: on ? "var(--acc)" : "var(--ink)" }}>
              {deck.level}
            </b>
            <span className="text-[12.5px]" style={{ color: "var(--mut)" }}>
              {hasData ? `${summary!.studied} of ${summary!.total}` : deck.desc}
            </span>
            {hasData && <Meter pct={summary!.progressPercent} height={5} />}
          </Link>
        );
      })}
    </nav>
  );
}
