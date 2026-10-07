// Server-side assembly of map rows: combines the pure presentation mapping with launch readiness.
import { getLessonSpec } from './inventory';
import { getLessonReadiness } from './readiness';
import { describeEntry, type EntryView } from './map-presentation';
import type { CourseLevel } from './types';

export type LevelViews = Record<string, EntryView & { screenCount: number | null }>;
export function buildLevelViews(level: CourseLevel): LevelViews {
  const views: LevelViews = {};
  for (const chapter of level.chapters) for (const entry of chapter.entries) {
    const spec = getLessonSpec(entry.id);
    const ready = Boolean(spec && getLessonReadiness(spec).scoredLaunchReady);
    views[entry.id] = { ...describeEntry(entry, { curriculumObjective: spec?.curriculum.objective, ready }), screenCount: spec?.contentPack?.baseScreenCount ?? spec?.baseScreenCount ?? null };
  }
  return views;
}
