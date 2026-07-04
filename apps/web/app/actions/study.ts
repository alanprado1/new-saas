"use server";

// app/actions/study.ts  —  SRS progress persistence + session hydration
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@/utils/supabase/server";
import { calculateSM2, RATING_TO_QUALITY, type SM2State } from "@/lib/sm2";
import type { StudyCardData } from "@/components/StudyCard";
import {
  DEFAULT_LEARNING_DIRECTION,
  adaptStudyCardForDirection,
  buildDirectionProgressKey,
  legacyProgressKeyFromDirectionKey,
  resolveLearningDirection,
  type LearningDirection,
} from "@/lib/language";

// ─────────────────────────────────────────────────────────────────────────────
// Database types
// ─────────────────────────────────────────────────────────────────────────────

interface VocabularyRow {
  id:         string;
  level:      string;
  kanji:      string;
  reading:    string;
  meaning:    string;
  example_jp: string;
  example_en: string;
  created_at: string;
}

interface EnglishVocabularyRow {
  id:             string;
  level:          string;
  word:           string;
  reading:        string | null;
  meaning:        string;
  example_jp:     string;
  example_en:     string;
  example_romaji: string | null;
  created_at:     string;
}

// ─────────────────────────────────────────────────────────────────────────────
// getDueCards
// ─────────────────────────────────────────────────────────────────────────────
// Returns the vocabulary rows from the `vocabulary` table that the authenticated user should study
// today for the given level:
//
//   • "new"    — card has no entry in user_card_progress yet
//   • "review" — card exists in user_card_progress AND next_review <= today
//
// SM-2 stats (repetition, interval, ease_factor) from the DB are merged into
// each returned card so handleRate calculates the correct next interval.
// ─────────────────────────────────────────────────────────────────────────────

export async function getDueCards(
  level: string,
  learningDirection: LearningDirection = DEFAULT_LEARNING_DIRECTION,
  dailyLimit = 20,
): Promise<StudyCardData[]> {
  const supabase = await createClient();
  const direction = resolveLearningDirection(learningDirection);
  const progressTable = direction === "en-ja" ? "english_user_card_progress" : "user_card_progress";

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn("[getDueCards] No authenticated user.");
    return [];
  }

  // Fetch the user's existing progress in one query.
  const { data: progressRows, error: progressError } = await supabase
    .from(progressTable)
    .select("card_id, repetition, interval, ease_factor, next_review")
    .eq("user_id", user.id);

  if (progressError) {
    console.error("[getDueCards] Failed to fetch progress:", progressError.message);
    return [];
  }

  // Fetch the master vocabulary list for this level from the DB.
  const vocabQuery = direction === "en-ja"
    ? supabase
      .from("english_vocabulary")
      .select("id, level, word, reading, meaning, example_jp, example_en, example_romaji, created_at")
      .eq("level", level.toLowerCase())
    : supabase
      .from("vocabulary")
      .select("id, level, kanji, reading, meaning, example_jp, example_en, created_at")
      .eq("level", level.toLowerCase());

  const { data: vocabData, error: vocabError } = await vocabQuery;

  if (vocabError) {
    console.error("[getDueCards] Failed to fetch vocabulary:", vocabError.message);
    return [];
  }

  const masterVocab = (vocabData || []) as VocabularyRow[];

  // Build a lookup map: card_id → progress row.
  const progressMap = new Map((progressRows ?? []).map(row => [row.card_id, row]));

  // Today's date as YYYY-MM-DD (compare against next_review which is a DATE).
  const todayStr = new Date().toISOString().split("T")[0];

  const dueCards: StudyCardData[] = [];

  if (direction === "en-ja") {
    for (const row of ((vocabData || []) as EnglishVocabularyRow[])) {
      const progress = progressMap.get(row.id);
      const cardBase = {
        kanji:      row.id,
        reading:    row.reading ?? "",
        meaning:    row.meaning,
        example_jp: row.example_jp,
        example_en: row.example_en,
      };

      if (!progress) {
        dueCards.push(adaptStudyCardForDirection({
          ...cardBase,
          cardType: "new",
        }, direction));
      } else if (progress.next_review <= todayStr) {
        dueCards.push(adaptStudyCardForDirection({
          ...cardBase,
          cardType:       "review",
          repetition:     progress.repetition,
          interval:       progress.interval,
          ease_factor:    progress.ease_factor,
          nextReviewDays: progress.interval,
        }, direction));
      }

      if (dueCards.length >= dailyLimit) return dueCards;
    }

    return dueCards;
  }

  for (const row of masterVocab) {
    const directionCardId = buildDirectionProgressKey(row.kanji, direction);
    const legacyCardId = legacyProgressKeyFromDirectionKey(row.kanji, direction);
    const progress = progressMap.get(directionCardId) ?? (legacyCardId ? progressMap.get(legacyCardId) : undefined);

    if (!progress) {
      // Card has never been seen — it's brand new.
      dueCards.push(adaptStudyCardForDirection({
        kanji:      row.kanji,
        reading:    row.reading,
        meaning:    row.meaning,
        example_jp: row.example_jp,
        example_en: row.example_en,
        cardType:   "new",
      }, direction));
    } else if (progress.next_review <= todayStr) {
      // Card exists in the DB and is due today or overdue.
      dueCards.push(adaptStudyCardForDirection({
        kanji:          row.kanji,
        reading:        row.reading,
        meaning:        row.meaning,
        example_jp:     row.example_jp,
        example_en:     row.example_en,
        cardType:       "review",
        repetition:     progress.repetition,
        interval:       progress.interval,
        ease_factor:    progress.ease_factor,
        nextReviewDays: progress.interval,
      }, direction));
    }

    if (dueCards.length >= dailyLimit) return dueCards;
    // Cards where next_review > today are skipped (not yet due).
  }

  return dueCards;
}

// ─────────────────────────────────────────────────────────────────────────────
// saveCardProgress
// ─────────────────────────────────────────────────────────────────────────────
// Called fire-and-forget from the client (no await). Calculates the next SM-2
// state then upserts it into user_card_progress.
//
// Required Supabase table:
//
//   create table user_card_progress (
//     id            uuid primary key default gen_random_uuid(),
//     user_id       uuid references auth.users not null,
//     card_id       text not null,
//     repetition    int   not null default 0,
//     interval      int   not null default 1,
//     ease_factor   float not null default 2.5,
//     next_review   date  not null,
//     last_reviewed timestamptz default now(),
//     unique (user_id, card_id)
//   );
//
//   alter table user_card_progress enable row level security;
//   create policy "Users manage own progress"
//     on user_card_progress for all
//     using (auth.uid() = user_id)
//     with check (auth.uid() = user_id);
// ─────────────────────────────────────────────────────────────────────────────

export async function saveCardProgress(
  cardId:          string,
  rating:          "again" | "hard" | "good" | "easy",
  currentSm2State: SM2State,
  learningDirection: LearningDirection = DEFAULT_LEARNING_DIRECTION,
) {
  try {
    const supabase = await createClient();
    const direction = resolveLearningDirection(learningDirection);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn("[SM-2] saveCardProgress: no authenticated session, skipping.");
      return;
    }

    const quality   = RATING_TO_QUALITY[rating];
    const nextState = calculateSM2(quality, currentSm2State);

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + nextState.interval);
    const progressTable = direction === "en-ja" ? "english_user_card_progress" : "user_card_progress";

    const { error } = await supabase
      .from(progressTable)
      .upsert(
        {
          user_id:       user.id,
          card_id:       direction === "en-ja" ? cardId : buildDirectionProgressKey(cardId, direction),
          ...(direction === "en-ja" ? { level: null } : {}),
          learning_direction: direction,
          repetition:    nextState.repetition,
          interval:      nextState.interval,
          ease_factor:   nextState.ease_factor,
          next_review:   nextReview.toISOString().split("T")[0],
          last_reviewed: new Date().toISOString(),
        },
        { onConflict: "user_id,card_id" },
      );

    if (error) {
      console.error("[SM-2] saveCardProgress DB error:", error.message);
    }
  } catch (err) {
    console.error("[SM-2] saveCardProgress unexpected error:", err);
  }
}
