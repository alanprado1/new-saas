import inventoryData from '@/content/busuu/inventory.json';
import structureData from '@/content/busuu/b2-structure.json';
import { assertContentAlignment, getContentPack, getRuntimeCompletionMetadata } from './content-registry';
import { validateInventory } from './schema';
import type { CourseLevelId, LessonSpec } from './types';

export const inventory = validateInventory(inventoryData);
const structures = new Map((structureData.records as unknown as LessonSpec[]).map(s => [s.recordId, s]));

export function isCourseLevel(level: string): level is CourseLevelId {
  return level === 'A1' || level === 'A2' || level === 'B1' || level === 'B2';
}
export function getLevelInventory(level: string) {
  return inventory.levels.find(l => l.id === level) ?? null;
}
export function getCourseEntry(level: string, recordId: string) {
  const courseLevel = getLevelInventory(level);
  const chapter = courseLevel?.chapters.find(c => c.entries.some(e => e.id === recordId));
  const entry = chapter?.entries.find(e => e.id === recordId);
  return chapter && entry ? { chapter, entry } : null;
}
export function getTimelineHref(level: CourseLevelId, recordId?: string) {
  return recordId && getCourseEntry(level, recordId)
    ? `/busuu/${level}?selected=${encodeURIComponent(recordId)}#${encodeURIComponent(recordId)}` : `/busuu/${level}`;
}
export function getInitialProgress() {
  // Initial/loading fallback only. SavedCourseMap reads account-owned attempts; research scores never seed progress.
  return { completedEntries: 0, percent: 0, score: null };
}
export function getLessonSpec(recordId: string): LessonSpec | null {
  const level = recordId.split('.')[0];
  const found = getCourseEntry(level, recordId);
  if (!found) return null;
  const spec = structures.get(recordId);
  if (spec) {
    const contentPack = getContentPack(recordId);
    if (contentPack) { assertContentAlignment(contentPack, spec); return { ...spec, optionalProduction: getRuntimeCompletionMetadata(spec), contentPack }; }
    return spec;
  }
  return {
    recordId, contentVersion: inventory.version, baseScreenCount: null, sequenceState: 'unknown',
    evidenceDepth: found.entry.evidenceDepth, evidence: found.entry.evidence,
    activities: [], screens: [], dependencies: [], optionalProduction: null,
    curriculum: { objective: found.entry.mappedObjective.value, grammarTargets: [], vocabularyCategories: [], newConceptIds: [], priorConceptIds: [] },
  };
}
