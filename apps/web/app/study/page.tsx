"use client";

import { Suspense, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { getStoredLearningDirection } from "@/lib/language";
import LevelDashboard from "./LevelDashboard";
import { decksFor, readStudyLevel } from "./study-ui";

const noop = () => () => {};

// /study opens the level the learner used last (N5 the first time). The level is read
// synchronously on the client, so returning to Study shows it at once.
export default function StudyPage() {
  const router = useRouter();
  const level = useSyncExternalStore(noop, () => readStudyLevel(getStoredLearningDirection()), () => null);

  useEffect(() => {
    const direction = getStoredLearningDirection();
    decksFor(direction).forEach(d => router.prefetch(`/study/${d.slug}?direction=${direction}`));
  }, [router]);

  if (!level) {
    return (
      <AppShell active="study">
        <main aria-busy="true" className="grid max-w-[1100px] gap-[22px] px-4 py-6 md:px-9 md:py-[30px]">
          <div className="h-8 w-28 animate-pulse rounded-lg" style={{ background: "var(--s3)" }} />
          <div className="h-[86px] animate-pulse rounded-2xl" style={{ background: "var(--s1)" }} />
          <div className="h-[300px] animate-pulse rounded-[20px]" style={{ background: "var(--s1)" }} />
        </main>
      </AppShell>
    );
  }

  return (
    <Suspense>
      <LevelDashboard level={level} />
    </Suspense>
  );
}
