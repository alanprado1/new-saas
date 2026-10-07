import type { SavedAttempt } from './attempt';
import type { CourseChapter } from './types';
export type CourseProgress = Record<string, { accuracy: number | null }>;
export function savedCourseProgress(attempts: SavedAttempt[]): CourseProgress {
  const progress: CourseProgress = {};
  for (const a of attempts) {
    if (a.completed_at && a.state.phase === 'result' && !a.state.preview && a.result.completionEligible && !progress[a.record_id]) {
      progress[a.record_id] = { accuracy: a.result.percent };
    }
  }
  return progress;
}
export function chapterCompletion(chapter: CourseChapter, progress: CourseProgress) {
  const entries = chapter.entries.filter(e => e.kind !== 'certificate_entry');
  return entries.length ? Math.round(entries.filter(e => progress[e.id]).length / entries.length * 100) : 0;
}

// Presentation helpers (no progress calculation changes): in-progress rows come from active, uncompleted saved attempts.
export type InProgressRow = { record_id: string; visited: number };
export type InProgress = Record<string, { visited: number }>;
export type RowStatus = 'not_started' | 'in_progress' | 'completed';
export function savedInProgress(rows: unknown, completed: CourseProgress): InProgress {
  const progress: InProgress = {};
  if (!Array.isArray(rows)) return progress;
  for (const row of rows as InProgressRow[]) {
    if (typeof row?.record_id === 'string' && Number.isFinite(row.visited) && row.visited > 0 && !completed[row.record_id]) progress[row.record_id] = { visited: row.visited };
  }
  return progress;
}
export function rowStatus(recordId: string, completed: CourseProgress, inProgress: InProgress): RowStatus {
  return completed[recordId] ? 'completed' : inProgress[recordId] ? 'in_progress' : 'not_started';
}
/** Share of the ring to fill, 0..1. Completed is always full; in-progress is capped just below full. */
export function ringFraction(status: RowStatus, visited = 0, total: number | null = null) {
  if (status === 'completed') return 1;
  if (status !== 'in_progress') return 0;
  const share = total && total > 0 ? visited / total : 0.1;
  return Math.min(0.95, Math.max(0.06, share));
}
