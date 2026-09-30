import type { LearningDirection } from "./language";

export interface StudyProgressRow {
  card_id: string;
  repetition: number;
  next_review: string;
}

export interface StudySummary {
  total: number;
  studied: number;
  strong: number;
  dueReviews: number;
  newAvailable: number;
  sessionReviews: number;
  sessionNew: number;
  sessionTotal: number;
  progressPercent: number;
}

export function buildStudySummary(
  vocabularyIds: string[],
  progressRows: StudyProgressRow[],
  direction: LearningDirection,
  today: string,
  dailyLimit = 20,
): StudySummary {
  const progressById = new Map(progressRows.map(row => [row.card_id, row]));
  const uniqueIds = [...new Set(vocabularyIds)];
  let studied = 0;
  let strong = 0;
  let dueReviews = 0;
  let newAvailable = 0;

  for (const id of uniqueIds) {
    const progress = progressById.get(`${direction}:${id}`)
      ?? (direction === "ja-en" || direction === "en-ja" ? progressById.get(id) : undefined);
    if (!progress) {
      newAvailable += 1;
      continue;
    }
    studied += 1;
    if (progress.repetition >= 3) strong += 1;
    if (progress.next_review <= today) dueReviews += 1;
  }

  const limit = Math.max(0, Math.floor(dailyLimit));
  const sessionReviews = Math.min(dueReviews, limit);
  const sessionNew = Math.min(newAvailable, limit - sessionReviews);
  const total = uniqueIds.length;

  return {
    total,
    studied,
    strong,
    dueReviews,
    newAvailable,
    sessionReviews,
    sessionNew,
    sessionTotal: sessionReviews + sessionNew,
    progressPercent: total ? Math.round((studied / total) * 100) : 0,
  };
}
