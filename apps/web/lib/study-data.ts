import type { StudyCardData } from "@/components/StudyCard";
import type { SM2State } from "./sm2";
import { adaptStudyCardForDirection, buildDirectionProgressKey, type LearningDirection } from "./language";
import { buildStudySummary, type StudyProgressRow } from "./study-summary";
import { addDaysToDateKey } from "./study-dates";

export interface StudyVocabulary {
  id: string;
  level: string;
  kanji?: string;
  reading: string | null;
  meaning: string;
  example_jp: string;
  example_en: string;
}

export interface StudySnapshot {
  userId: string;
  direction: LearningDirection;
  today: string;
  timezoneOffsetMinutes: number;
  vocabulary: StudyVocabulary[];
  progress: (StudyProgressRow & SM2State)[];
}

export function buildStudyLevel(snapshot: StudySnapshot, level: string, dailyLimit = 20) {
  const rows = snapshot.vocabulary.filter(row => row.level.toLowerCase() === level.toLowerCase());
  const ids = rows.map(row => snapshot.direction === "en-ja" ? row.id : row.kanji!).filter(Boolean);
  const summary = buildStudySummary(ids, snapshot.progress, snapshot.direction, snapshot.today, dailyLimit);
  const progressById = new Map(snapshot.progress.map(row => [row.card_id, row]));
  const seen = new Set<string>();
  const reviews: StudyCardData[] = [];
  const fresh: StudyCardData[] = [];
  for (const row of rows) {
    const id = snapshot.direction === "en-ja" ? row.id : row.kanji;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const progress = snapshot.direction === "en-ja" ? progressById.get(id)
      : progressById.get(buildDirectionProgressKey(id, snapshot.direction)) ?? progressById.get(id);
    if (progress && progress.next_review > snapshot.today) continue;
    const card: StudyCardData = adaptStudyCardForDirection({
      kanji: id, reading: row.reading ?? "", meaning: row.meaning,
      example_jp: row.example_jp, example_en: row.example_en,
      cardType: progress ? "review" : "new",
      ...(progress ? { repetition: progress.repetition, interval: progress.interval,
        ease_factor: progress.ease_factor, nextReviewDays: progress.interval } : {}),
    }, snapshot.direction);
    (progress ? reviews : fresh).push(card);
  }
  return { summary, cards: [...reviews, ...fresh].slice(0, Math.max(0, dailyLimit)) };
}

export function updateStudyProgress(snapshot: StudySnapshot, cardId: string, state: SM2State): StudySnapshot {
  const id = snapshot.direction === "en-ja" ? cardId : buildDirectionProgressKey(cardId, snapshot.direction);
  const row = { ...state, card_id: id, next_review: addDaysToDateKey(snapshot.today, state.interval) };
  return { ...snapshot, progress: [...snapshot.progress.filter(progress => progress.card_id !== id), row] };
}
