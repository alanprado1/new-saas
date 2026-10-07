import type { LessonContentPack, LessonContentScreen, LessonSpec } from './types';

export function getAppResponseCount(screen: LessonContentScreen): number {
  const a = screen.answer;
  return a?.kind === 'pairs' ? a.pairs.length : a?.kind === 'ordered_slots' ? a.slots.length :
    a?.kind === 'ordered_tokens' ? a.tokens.length : a?.kind === 'multi_choice' ? a.requiredCount : a ? 1 : 0;
}

// This opt-in contract is app evidence only. Never project authored tasks into raw source records.
// Observed records retain their existing strict alignment; no legacy pack/hash/state is modified.
export function assertSummaryStructure(pack: LessonContentPack, spec: LessonSpec) {
  const c = pack.structuralContract;
  const fail = () => { throw new Error('Invalid reviewed app structure for summary-only evidence'); };
  if (!c || c.version !== '1.0' || c.kind !== 'summary_authored' || c.origin !== 'app_authored' ||
    c.review?.status !== 'reviewed' || !c.review.note?.trim() || pack.status !== 'reviewed' || pack.provenance.origin !== 'app_authored' ||
    spec.evidenceDepth !== 'summary_only' || spec.screens.length || spec.optionalProduction ||
    pack.completion || pack.recordId !== spec.recordId || pack.baseScreenCount !== spec.baseScreenCount ||
    !Number.isInteger(pack.baseScreenCount) || pack.baseScreenCount <= 0 || pack.screens.length !== pack.baseScreenCount ||
    !Array.isArray(c.activities) || !c.activities.length || !Array.isArray(c.tasks) || c.tasks.length !== pack.screens.length) return fail();
  // A retained activity partition is evidence: preserve every known ID, ordinal,
  // source activity list and count. Only its absent task rows may be app-authored.
  if (spec.activities.length && spec.activities.length !== c.activities.length) return fail();
  const ids: string[] = [];
  for (const [i, activity] of c.activities.entries()) {
    const prefix = `${pack.recordId}.A${String(i + 1).padStart(2, '0')}`;
    const retained = spec.activities[i];
    if (retained && (retained.activityId !== prefix || retained.ordinal !== i + 1 ||
      !Array.isArray(retained.screenIds) || retained.screenIds.length || !Array.isArray(retained.sourceActivityIds) ||
      retained.sourceActivityIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(retained.sourceActivityIds).size !== retained.sourceActivityIds.length ||
      (retained.baseScreenCount !== null && (!Number.isInteger(retained.baseScreenCount) || retained.baseScreenCount <= 0 || retained.baseScreenCount !== activity.baseScreenCount)))) return fail();
    if (activity.activityId !== prefix || activity.ordinal !== i + 1 || !Array.isArray(activity.sourceActivityIds) ||
      activity.sourceActivityIds.join('|') !== (retained?.sourceActivityIds ?? []).join('|') ||
      !Array.isArray(activity.screenIds) || !activity.screenIds.length || activity.baseScreenCount !== activity.screenIds.length ||
      !activity.screenIds.every((id, j) => id === `${prefix}.S${String(j + 1).padStart(2, '0')}`)) return fail();
    ids.push(...activity.screenIds);
  }
  if (ids.join('|') !== pack.screens.map(s => s.screenId).join('|')) return fail();
  for (const [i, screen] of pack.screens.entries()) {
    const source = screen.sourceContract, task = c.tasks[i];
    if (!source || source.sourceScreenId !== null || source.sourceActivityId !== null || source.sourceExerciseNumber !== null ||
      source.sourceRenderer !== null || source.sourceRendererId !== null || source.responseSlotCount !== null || source.responseSlotCountState !== 'unknown' ||
      task.screenId !== screen.screenId || !Number.isInteger(task.responseCount) || task.responseCount !== getAppResponseCount(screen)) return fail();
  }
}
