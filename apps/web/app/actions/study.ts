"use server";

// app/actions/study.ts  —  SRS progress persistence + session hydration
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@/utils/supabase/server";
import { calculateSM2, RATING_TO_QUALITY, type SM2State } from "@/lib/sm2";
import type { StudyCardData } from "@/components/StudyCard";
import type { StudySummary } from "@/lib/study-summary";
import { addDaysToDateKey, dateKeyAtOffset } from "@/lib/study-dates";
import { loadAllPages } from "@/lib/load-all-pages";
import { buildStudyLevel, type StudySnapshot } from "@/lib/study-data";
import {
  DEFAULT_LEARNING_DIRECTION,
  buildDirectionProgressKey,
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
  timezoneOffsetMinutes = 0,
): Promise<StudyCardData[]> {
  return buildStudyLevel(await getStudySnapshot(learningDirection, timezoneOffsetMinutes), level, dailyLimit).cards;
}

// Warm every level with one vocabulary scan and one user progress scan.
export async function getStudySnapshot(
  learningDirection: LearningDirection = DEFAULT_LEARNING_DIRECTION,
  timezoneOffsetMinutes = 0,
): Promise<StudySnapshot> {
  const supabase = await createClient();
  const direction = resolveLearningDirection(learningDirection);
  const progressTable = direction === "en-ja" ? "english_user_card_progress" : "user_card_progress";

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Sign in to load your study cards.");
  }

  // Fetch progress and vocabulary together to keep session opening quick.
  const progressQuery = loadAllPages((from, to, includeCount) => supabase
    .from(progressTable)
    .select("card_id, repetition, interval, ease_factor, next_review", { count: includeCount ? "exact" : undefined })
    .eq("user_id", user.id)
    .order("card_id")
    .range(from, to));

  // Fetch the master vocabulary list for this level from the DB.
  const vocabQuery = direction === "en-ja"
    ? loadAllPages((from, to, includeCount) => supabase
      .from("english_vocabulary")
      .select("id, level, word, reading, meaning, example_jp, example_en, example_romaji, created_at", { count: includeCount ? "exact" : undefined })
      .order("id")
      .range(from, to))
    : loadAllPages((from, to, includeCount) => supabase
      .from("vocabulary")
      .select("id, level, kanji, reading, meaning, example_jp, example_en, created_at", { count: includeCount ? "exact" : undefined })
      .order("id")
      .range(from, to));

  const [progressRows, vocabData] = await Promise.all([progressQuery, vocabQuery]);

  return {
    userId: user.id,
    direction,
    today: dateKeyAtOffset(new Date(), timezoneOffsetMinutes),
    timezoneOffsetMinutes,
    vocabulary: vocabData as (VocabularyRow | EnglishVocabularyRow)[],
    progress: progressRows,
  };
}

/* Legacy card/summary entry points use the same canonical snapshot builder. */
export async function getStudyDashboard(
  level: string,
  learningDirection: LearningDirection = DEFAULT_LEARNING_DIRECTION,
  timezoneOffsetMinutes = 0,
): Promise<StudySummary> {
  return buildStudyLevel(await getStudySnapshot(learningDirection, timezoneOffsetMinutes), level).summary;
}



// ─────────────────────────────────────────────────────────────────────────────
// saveCardProgress
// ─────────────────────────────────────────────────────────────────────────────
// Calculates the next SM-2
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
  timezoneOffsetMinutes = 0,
  expectedUserId?: string,
) {
  try {
    const supabase = await createClient();
    const direction = resolveLearningDirection(learningDirection);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Your session expired. Sign in and retry this card.");
    }
    if (expectedUserId && user.id !== expectedUserId) {
      throw new Error("Your account changed. Reopen Study to continue.");
    }

    const quality   = RATING_TO_QUALITY[rating];
    const nextState = calculateSM2(quality, currentSm2State);

    const nextReviewDate = addDaysToDateKey(
      dateKeyAtOffset(new Date(), timezoneOffsetMinutes),
      nextState.interval,
    );
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
          next_review:   nextReviewDate,
          last_reviewed: new Date().toISOString(),
        },
        { onConflict: "user_id,card_id" },
      )
      .select("card_id")
      .single();

    if (error) {
      console.error("[SM-2] saveCardProgress DB error:", error);
      throw new Error("Your answer could not be saved. Please retry.");
    }
    return nextState;
  } catch (err) {
    console.error("[SM-2] saveCardProgress unexpected error:", err);
    throw err;
  }
}
