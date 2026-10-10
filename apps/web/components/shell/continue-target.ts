// Which course lesson the Home "Continue" card points at.
// Pure: takes the slim course index and the learner's saved progress (as the course map reads it) and returns a target.
import type { CourseIndex, CourseIndexChapter, CourseIndexEntry, CourseIndexLevel } from "./course-index";

export type ContinueTarget = {
  /** in_progress: a saved, unfinished attempt exists. next: the lesson after the last one completed. */
  state: "in_progress" | "next";
  level: CourseIndexLevel;
  chapter: CourseIndexChapter;
  entry: CourseIndexEntry;
  /** Share of this level's lessons completed, 0-100 (the same count the course map shows). */
  levelPercent: number;
};

type Flat = { level: CourseIndexLevel; chapter: CourseIndexChapter; entry: CourseIndexEntry };

function flatten(index: CourseIndex): Flat[] {
  return index.flatMap(level => level.chapters.flatMap(chapter => chapter.entries.map(entry => ({ level, chapter, entry }))));
}

/** Percent of a level's lessons that are completed. */
export function levelCompletionPercent(level: CourseIndexLevel, completed: ReadonlySet<string>): number {
  const entries = level.chapters.flatMap(chapter => chapter.entries);
  return entries.length ? Math.round(entries.filter(entry => completed.has(entry.id)).length / entries.length * 100) : 0;
}

/**
 * - An unfinished saved attempt wins: the first one in course order.
 * - Otherwise the first lesson not yet completed after `lastCompletedId` in the same level,
 *   then the rest of that level from its start, then later levels.
 * - With nothing completed or in progress, or everything done, there is no target (the card falls back to a plain link).
 */
export function pickContinueTarget(
  index: CourseIndex,
  completed: ReadonlySet<string>,
  inProgress: Readonly<Record<string, { visited: number }>>,
  lastCompletedId: string | null,
): ContinueTarget | null {
  const flat = flatten(index);
  const make = (item: Flat, state: ContinueTarget["state"]): ContinueTarget => ({
    state,
    level: item.level,
    chapter: item.chapter,
    entry: item.entry,
    levelPercent: levelCompletionPercent(item.level, completed),
  });

  const started = flat.find(item => inProgress[item.entry.id] && !completed.has(item.entry.id));
  if (started) return make(started, "in_progress");

  const lastAt = lastCompletedId ? flat.findIndex(item => item.entry.id === lastCompletedId) : -1;
  if (lastAt < 0) return null;
  const last = flat[lastAt];
  const open = (item: Flat) => !completed.has(item.entry.id);
  const sameLevel = flat.filter(item => item.level.id === last.level.id);
  const afterLast = sameLevel.slice(sameLevel.findIndex(item => item.entry.id === last.entry.id) + 1).find(open);
  const next = afterLast
    ?? sameLevel.find(open)
    ?? flat.slice(lastAt + 1).find(open);
  return next ? make(next, "next") : null;
}
