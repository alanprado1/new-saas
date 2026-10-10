"use client";

/**
 * Home: a greeting, where you left off in the course, what is due in Study, and your latest scenes.
 * Every figure comes from a read the app already makes; nothing here has its own endpoint:
 *   Continue  → /api/course/attempts?include=active (the course map's read) + the course index built on the server
 *   Study     → useStudySnapshot / buildStudyLevel (Study's read, cached per session)
 *   Scenes    → fetchLibrary / getCachedLibrary (the Library's read), newest four for the chosen language
 * When a read is unavailable the card falls back to a plain link.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useStudySnapshot } from "@/components/StudyCacheProvider";
import { buildStudyLevel } from "@/lib/study-data";
import { fetchLibrary, getCachedLibrary, type LibraryLesson } from "@/lib/lesson";
import { DEFAULT_LEARNING_DIRECTION, getStoredLearningDirection, type LearningDirection } from "@/lib/language";
import { ringFraction, savedCourseProgress, savedInProgress, type InProgress } from "@/lib/busuu/progress";
import type { SavedAttempt } from "@/lib/busuu/attempt";
import { getCachedAttempts, setCachedAttempts } from "@/lib/busuu/attempts-cache";
import SceneCard from "./SceneCard";
import { pickContinueTarget, type ContinueTarget } from "./continue-target";
import type { CourseIndex } from "./course-index";
import { PersonIcon, PlusIcon } from "./icons";
import styles from "./home.module.css";

// ── Course (Continue card) ──────────────────────────────────

type CourseState =
  | { status: "loading" }
  | { status: "unavailable"; message: string }
  | { status: "ready"; target: ContinueTarget | null; visited: number };

function useCourseTarget(index: CourseIndex): CourseState {
  const [state, setState] = useState<CourseState>({ status: "loading" });

  useEffect(() => {
    let retired = false;
    let owner: string | null = null;
    let controller: AbortController | null = null;

    const show = (attempts: { record_id: string }[], rows: unknown) => {
      const completed = savedCourseProgress(attempts as SavedAttempt[]);
      const inProgress: InProgress = savedInProgress(rows, completed);
      // Attempts arrive newest first, so the first counted one is the lesson finished most recently.
      const last = attempts.find(a => completed[a.record_id])?.record_id ?? null;
      const target = pickContinueTarget(index, new Set(Object.keys(completed)), inProgress, last);
      setState({ status: "ready", target, visited: target ? inProgress[target.entry.id]?.visited ?? 0 : 0 });
    };

    const load = async (id: string) => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const response = await fetch("/api/course/attempts?include=active", {
          cache: "no-store",
          headers: { "X-Course-Owner": id },
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]),
        });
        const data = await response.json();
        if (retired || request.signal.aborted || owner !== id) return;
        if (!response.ok) throw new Error(data.error || "Saved progress unavailable.");
        if (data.owner !== id || !Array.isArray(data.attempts) || data.attempts.some((a: { user_id: string }) => a.user_id !== id)) {
          throw new Error("Your account changed. Reload saved progress.");
        }
        setCachedAttempts(id, { attempts: data.attempts, inProgress: data.inProgress });
        show(data.attempts, data.inProgress);
      } catch (error) {
        if (!retired && !request.signal.aborted && owner === id) {
          setState({ status: "unavailable", message: error instanceof Error ? error.message : "Saved progress unavailable." });
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null;
      if (owner === id) return;
      owner = id;
      controller?.abort();
      if (!id) { setState({ status: "unavailable", message: "Sign in to see your course progress." }); return; }
      const cached = getCachedAttempts(id);
      if (cached) show(cached.attempts as { record_id: string }[], cached.inProgress);
      else setState({ status: "loading" });
      queueMicrotask(() => { if (!retired && owner === id) void load(id); });
    });

    return () => { retired = true; controller?.abort(); subscription.unsubscribe(); };
  }, [index]);

  return state;
}

function Ring({ fraction, glyph }: { fraction: number; glyph: string | null }) {
  return (
    <div className={styles.ring} style={{ "--p": Math.round(fraction * 100) } as React.CSSProperties} aria-hidden="true">
      <div className={styles.ringInner}>
        <span className={styles.ringFace} data-kanji={glyph ? "true" : undefined}>
          {glyph ?? <PersonIcon />}
        </span>
      </div>
    </div>
  );
}

function ContinueCard({ index }: { index: CourseIndex }) {
  const course = useCourseTarget(index);

  if (course.status === "loading") {
    return (
      <section className={styles.cont} aria-busy="true" aria-label="Course">
        <div className={styles.ring} aria-hidden="true"><div className={styles.ringInner}><span className={styles.ringFace} /></div></div>
        <div className={styles.meta} style={{ flex: 1 }}>
          <div className={styles.skel} style={{ height: 14, width: "40%" }} />
          <div className={styles.skel} style={{ height: 24, width: "75%", margin: "10px 0 16px" }} />
          <div className={styles.skel} style={{ height: 44, width: 150, borderRadius: 12 }} />
        </div>
      </section>
    );
  }

  if (course.status === "ready" && course.target) {
    const { target } = course;
    const href = `/busuu/${target.level.id}?selected=${encodeURIComponent(target.entry.id)}#${encodeURIComponent(target.entry.id)}`;
    const inProgress = target.state === "in_progress";
    return (
      <section className={styles.cont} aria-label="Continue the course">
        <Ring fraction={inProgress ? ringFraction("in_progress", course.visited, null) : 0} glyph={target.entry.glyph} />
        <div className={styles.meta}>
          <small>{inProgress ? "Continue" : "Up next"} · {target.level.name} {target.level.id}</small>
          <h2>{target.entry.title}</h2>
          {target.entry.subtitle && <p>{target.entry.subtitle}</p>}
          <p className={styles.where}>Chapter {target.chapter.number}: {target.chapter.label} · {target.levelPercent}% of {target.level.id} complete</p>
          <Link href={href} className={styles.btn}>{inProgress ? "Continue lesson" : "Start lesson"}</Link>
        </div>
      </section>
    );
  }

  // No saved progress, a finished course, or the progress read is unavailable: a plain link to the course.
  const started = course.status === "ready";
  return (
    <section className={styles.cont} aria-label="Course">
      <Ring fraction={0} glyph={null} />
      <div className={styles.meta}>
        <small>Complete Japanese</small>
        <h2>{started ? "Open the course" : "Continue the course"}</h2>
        <p className={styles.where}>
          {course.status === "unavailable" ? `Your progress could not be shown. ${course.message}` : "Your lessons, chapters and checkpoints."}
        </p>
        <Link href="/busuu" className={styles.btn}>Open course</Link>
      </div>
    </section>
  );
}

// ── Study card ──────────────────────────────────────────────

const STUDY_SLUGS: Record<LearningDirection, string[]> = {
  "ja-en": ["n5", "n4", "n3", "n2", "n1"],
  "en-ja": ["en-a1", "en-a2", "en-b1", "en-b2", "en-c1"],
};
const levelLabel = (slug: string) => slug.replace(/^en-/, "").toUpperCase();

function StudyCard({ direction }: { direction: LearningDirection }) {
  const { snapshot, error } = useStudySnapshot(direction);

  const current = useMemo(() => {
    if (!snapshot) return null;
    const levels = STUDY_SLUGS[direction].map(slug => ({ slug, summary: buildStudyLevel(snapshot, slug).summary }));
    return levels.find(l => l.summary.sessionTotal > 0) ?? levels.find(l => l.summary.total > 0) ?? null;
  }, [snapshot, direction]);

  if (!snapshot && !error) {
    return (
      <section className={styles.due} aria-busy="true" aria-label="Study">
        <div className={styles.skel} style={{ height: 16, width: "50%" }} />
        <div className={styles.skel} style={{ height: 40, width: "35%" }} />
        <div className={styles.skel} style={{ height: 8 }} />
        <div className={styles.skel} style={{ height: 44, borderRadius: 12 }} />
      </section>
    );
  }

  if (!current) {
    return (
      <section className={styles.due} aria-label="Study">
        <div className={styles.dueHead}><b>Study</b></div>
        <p className={styles.note}>{error ? "Your study progress could not be shown." : "No vocabulary cards are available yet."}</p>
        <Link href="/study" className={`${styles.btn} ${styles.btnSec}`}>Open Study</Link>
      </section>
    );
  }

  const { slug, summary } = current;
  const caughtUp = summary.sessionTotal === 0;
  return (
    <section className={styles.due} aria-label="Study">
      <div className={styles.dueHead}>
        <b>{levelLabel(slug)} vocabulary</b>
        <span className={styles.pill}>Review</span>
      </div>
      <div className={styles.big}>{summary.dueReviews}<small>{summary.dueReviews === 1 ? "card due" : "cards due"}</small></div>
      <div className={styles.meter} role="progressbar" aria-label="Level progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.progressPercent}>
        <i style={{ width: `${summary.progressPercent}%` }} />
      </div>
      <div className={styles.dueRow}>
        <span>{summary.studied} of {summary.total} studied</span>
        <span>{summary.progressPercent}%</span>
      </div>
      <Link
        href={`/study/${slug}?direction=${direction}`}
        className={`${styles.btn} ${styles.btnSec}`}
        aria-disabled={caughtUp ? "true" : undefined}
      >
        {caughtUp ? "All caught up" : `Study ${summary.sessionTotal} cards`}
      </Link>
    </section>
  );
}

// ── Scenes ──────────────────────────────────────────────────

function useLatestScenes() {
  const [library, setLibrary] = useState<LibraryLesson[] | null>(null);

  useEffect(() => {
    let retired = false;
    const cached = getCachedLibrary();
    if (cached) queueMicrotask(() => { if (!retired) setLibrary(cached); });
    fetchLibrary({})
      .then(data => { if (!retired) setLibrary(data); })
      .catch(() => { if (!retired) setLibrary(current => current ?? []); });
    return () => { retired = true; };
  }, []);

  return library;
}

// ── Page ────────────────────────────────────────────────────

export default function HomeView({ index }: { index: CourseIndex }) {
  const [direction, setDirection] = useState<LearningDirection>(DEFAULT_LEARNING_DIRECTION);
  const [today, setToday] = useState("");
  const library = useLatestScenes();

  // Browser-only values are set after mount so the server and first client render match.
  useEffect(() => {
    queueMicrotask(() => {
      setDirection(getStoredLearningDirection());
      setToday(new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" }));
    });
  }, []);

  const scenes = useMemo(
    () => (library ?? []).filter(lesson => lesson.learning_direction === direction),
    [library, direction],
  );

  return (
    <div className={styles.home}>
      <header className={styles.hiRow}>
        <div className={styles.hi}>
          <h1><span className={styles.jp}>おかえり</span>Welcome back</h1>
          <p>{today}</p>
        </div>
        <Link href="/library?new=1" className={`${styles.btn} ${styles.btnSec} ${styles.btnSmall}`}>
          <PlusIcon width={16} height={16} />
          New scene
        </Link>
      </header>

      <div className={styles.top}>
        <ContinueCard index={index} />
        <StudyCard direction={direction} />
      </div>

      <section aria-labelledby="home-scenes">
        <div className={styles.sectionHead}>
          <h2 id="home-scenes">Your scenes</h2>
          <Link href="/library">{scenes.length > 0 ? `See all ${scenes.length}` : "Open library"}</Link>
        </div>
        <div style={{ height: 14 }} />
        {library === null ? (
          <div className={styles.scenes} aria-hidden="true">
            {[0, 1, 2, 3].map(i => <div key={i} className={styles.sceneSkel} style={{ animationDelay: `${i * 0.1}s` }} />)}
          </div>
        ) : scenes.length === 0 ? (
          <div className={styles.empty}>
            <p>No scenes yet.</p>
            <Link href="/library" className={`${styles.btn} ${styles.btnSec}`}>Go to the library</Link>
          </div>
        ) : (
          <div className={styles.scenes}>
            {scenes.slice(0, 4).map(lesson => (
              <SceneCard key={lesson.id} lesson={lesson} href={`/lesson/${lesson.id}`} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
