// A slim, ordered view of the course inventory for the Home "Continue" card.
// Built on the server from the same inventory file and the same learner-facing title mapping the course map
// uses (describeEntry), so Home never re-derives titles itself. It carries no progress: progress is read
// in the browser from the existing /api/course/attempts read.
import inventoryData from '@/content/busuu/inventory.json';
import { describeEntry } from '@/lib/busuu/map-presentation';
import { validateInventory } from '@/lib/busuu/schema';
import type { CourseLevelId } from '@/lib/busuu/types';

export type CourseIndexEntry = {
  id: string;
  title: string;
  subtitle: string;
  /** First kanji for kanji lessons, otherwise null. */
  glyph: string | null;
};
export type CourseIndexChapter = { number: number; label: string; entries: CourseIndexEntry[] };
export type CourseIndexLevel = { id: CourseLevelId; name: string; chapters: CourseIndexChapter[] };
export type CourseIndex = CourseIndexLevel[];

let cached: CourseIndex | null = null;

/** Levels, chapters and playable-kind entries in course order. Certificate entries are left out, as the map's completion count does. */
export function buildCourseIndex(): CourseIndex {
  if (cached) return cached;
  const inventory = validateInventory(inventoryData);
  cached = inventory.levels.map(level => ({
    id: level.id,
    name: level.name,
    chapters: level.chapters.map(chapter => ({
      number: chapter.number,
      label: chapter.label,
      entries: chapter.entries
        .filter(entry => entry.kind !== 'certificate_entry')
        .map(entry => {
          const view = describeEntry(entry);
          return { id: entry.id, title: view.title, subtitle: view.subtitle, glyph: view.glyph };
        }),
    })),
  }));
  return cached;
}
