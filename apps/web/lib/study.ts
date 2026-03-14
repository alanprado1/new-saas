/**
 * lib/study.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Data-fetching utilities for the JLPT Spaced-Repetition System (SRS).
 *
 * getDailySession(level, dailyLimit)
 *   Returns a mixed deck of Review cards (overdue) and New cards (never seen),
 *   capped at dailyLimit total, reviews-first so users stay on top of their
 *   existing cards before encountering new vocabulary.
 *
 * Usage (Server Component or Route Handler — runs on the server):
 *   const cards = await getDailySession('N5', 20);
 *
 * Usage (Client Component — call via a Server Action or API route instead,
 *   because this file imports the server-side Supabase client).
 */

import { createClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single flashcard entry returned to the UI */
export interface StudyCard {
  /** The jlpt_items primary key */
  item_id: string;
  /** 'N5' | 'N4' | 'N3' | 'N2' | 'N1' */
  level: string;
  /** Kanji / kana character being studied */
  character: string;
  /** Hiragana + romaji reading */
  reading: string;
  /** English meaning */
  meaning: string;
  /** Example sentence in Japanese (may be null for some items) */
  example_jp: string | null;
  /** Example sentence translation (may be null for some items) */
  example_en: string | null;
  /**
   * 'review' — the user has seen this card before and it is now due.
   * 'new'    — the user has never reviewed this card.
   */
  cardType: "review" | "new";
  /**
   * Current SRS interval in days (undefined for new cards).
   * Useful so the UI can show "due in N days" after a correct answer.
   */
  interval?: number;
}

/** Raw row from the user_reviews table */
interface UserReviewRow {
  item_id: string;
  interval: number;
  ease_factor: number;
  repetitions: number;
  next_review_date: string;
}

/** Raw row from jlpt_items */
interface JlptItemRow {
  id: string;
  level: string;
  character: string;
  reading: string;
  meaning: string;
  example_jp: string | null;
  example_en: string | null;
}

// ── Supabase client ───────────────────────────────────────────────────────────
// Uses the anon key — RLS enforces per-user data access at the DB level.
// We read the session token from the request on the server using cookies,
// but for simplicity this module re-exports a factory so callers can pass
// in the user's access_token if they have it (e.g. from a Server Action).

function makeSupabaseClient(accessToken?: string) {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !key) {
    throw new Error(
      "[study.ts] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createClient(url, key, {
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
    auth: {
      // Disable auto-refresh in server contexts — we receive the token from
      // the browser and don't need the client to manage sessions itself.
      persistSession:    false,
      autoRefreshToken:  false,
      detectSessionInUrl: false,
    },
  });
}

// ── getDailySession ───────────────────────────────────────────────────────────

/**
 * Build a mixed study deck for one session.
 *
 * Strategy (reviews-first):
 *   1. Fetch all overdue review cards for the user at this JLPT level.
 *   2. If fewer than `dailyLimit` cards are due, backfill with new cards
 *      (items in jlpt_items that have no user_reviews row yet).
 *   3. Cap the total at `dailyLimit`.
 *
 * @param level       JLPT level string, e.g. 'N5'
 * @param dailyLimit  Maximum cards to return (e.g. 20)
 * @param accessToken The user's Supabase access token (from getSession().session.access_token)
 *
 * @returns Array of StudyCard objects ready to render in the flashcard UI.
 *          Returns [] if the user is not authenticated or has no cards due.
 *
 * @throws  Re-throws unexpected Supabase or network errors so the caller can
 *          display an appropriate error state.
 */
export async function getDailySession(
  level: string,
  dailyLimit: number,
  accessToken: string
): Promise<StudyCard[]> {
  if (!accessToken) {
    console.warn("[getDailySession] No access token — returning empty deck.");
    return [];
  }

  const supabase = makeSupabaseClient(accessToken);

  // ── Step 1: Identify current user ─────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn("[getDailySession] Could not verify user:", authError?.message);
    return [];
  }

  const userId = user.id;
  const now    = new Date().toISOString();

  // ── Step 2: Overdue review cards ──────────────────────────────────────────
  // Fetch user_reviews joined to jlpt_items where:
  //   • the review belongs to this user
  //   • the item is at the requested JLPT level
  //   • next_review_date is in the past (card is due)
  //
  // We request up to dailyLimit rows here; if we get fewer we'll fill the
  // remainder with new cards below.

  const { data: reviewRows, error: reviewError } = await supabase
    .from("user_reviews")
    .select(
      `
      item_id,
      interval,
      ease_factor,
      repetitions,
      next_review_date,
      jlpt_items!inner (
        id,
        level,
        character,
        reading,
        meaning,
        example_jp,
        example_en
      )
      `
    )
    .eq("user_id", userId)
    .eq("jlpt_items.level", level)
    .lte("next_review_date", now)
    .order("next_review_date", { ascending: true }) // most overdue first
    .limit(dailyLimit);

  if (reviewError) {
    throw new Error(
      `[getDailySession] Failed to fetch review cards: ${reviewError.message}`
    );
  }

  // Build the review portion of the deck
  const reviewCards: StudyCard[] = (reviewRows ?? []).map((row) => {
    // Supabase returns the joined table as a nested object
    const item = (row as unknown as { jlpt_items: JlptItemRow }).jlpt_items;
    return {
      item_id:    item.id,
      level:      item.level,
      character:  item.character,
      reading:    item.reading,
      meaning:    item.meaning,
      example_jp: item.example_jp,
      example_en: item.example_en,
      cardType:   "review",
      interval:   (row as unknown as UserReviewRow).interval,
    };
  });

  // ── Step 3: New cards (backfill) ──────────────────────────────────────────
  const remaining = dailyLimit - reviewCards.length;

  let newCards: StudyCard[] = [];

  if (remaining > 0) {
    // Find item IDs the user has already seen at any point (not just due ones)
    // so we never re-surface a card the user is already tracking.
    const { data: seenRows, error: seenError } = await supabase
      .from("user_reviews")
      .select("item_id")
      .eq("user_id", userId);

    if (seenError) {
      throw new Error(
        `[getDailySession] Failed to fetch seen item list: ${seenError.message}`
      );
    }

    const seenItemIds = (seenRows ?? []).map((r) => r.item_id as string);

    // Query jlpt_items for unseen items at this level
    let newItemQuery = supabase
      .from("jlpt_items")
      .select("id, level, character, reading, meaning, example_jp, example_en")
      .eq("level", level)
      .order("created_at", { ascending: true }) // oldest items first (stable ordering)
      .limit(remaining);

    // Exclude already-seen items. Supabase PostgREST uses .not("id","in",...)
    // with a string array. If seenItemIds is empty we skip the filter entirely
    // (PostgREST treats an empty `in` list as matching nothing, which would
    // incorrectly exclude ALL rows).
    if (seenItemIds.length > 0) {
      newItemQuery = newItemQuery.not("id", "in", `(${seenItemIds.join(",")})`);
    }

    const { data: newRows, error: newError } = await newItemQuery;

    if (newError) {
      throw new Error(
        `[getDailySession] Failed to fetch new cards: ${newError.message}`
      );
    }

    newCards = (newRows ?? []).map((item: JlptItemRow) => ({
      item_id:    item.id,
      level:      item.level,
      character:  item.character,
      reading:    item.reading,
      meaning:    item.meaning,
      example_jp: item.example_jp,
      example_en: item.example_en,
      cardType:   "new",
      interval:   undefined,
    }));
  }

  // ── Step 4: Combine and return ─────────────────────────────────────────────
  // Reviews always come before new cards so existing progress is reinforced
  // before new vocabulary is introduced.
  return [...reviewCards, ...newCards];
}

// ── recordReview ──────────────────────────────────────────────────────────────

/**
 * Persist the result of a single card review using a simplified SM-2 algorithm.
 *
 * Call this after the user answers a card (correct or incorrect).
 *
 * SM-2 in brief:
 *   quality = 0 (wrong) → reset interval to 1 day, penalise ease_factor
 *   quality = 1 (hard)  → keep interval, slight ease penalty
 *   quality = 2 (good)  → advance interval by current ease
 *   quality = 3 (easy)  → advance interval + bonus, increase ease
 *
 * @param itemId      The jlpt_items.id of the card just reviewed
 * @param quality     0 = wrong, 1 = hard, 2 = good, 3 = easy
 * @param current     The current SRS state (undefined if this is a new card)
 * @param accessToken The user's Supabase access token
 */
export async function recordReview(
  itemId:      string,
  quality:     0 | 1 | 2 | 3,
  current:     { interval: number; ease_factor: number; repetitions: number } | undefined,
  accessToken: string
): Promise<void> {
  const supabase = makeSupabaseClient(accessToken);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("[recordReview] Unauthenticated.");
  }

  // ── SM-2 calculation ───────────────────────────────────────────────────────
  // ease_factor is stored as an integer (hundredths), e.g. 250 = 2.50
  const prev = current ?? { interval: 0, ease_factor: 250, repetitions: 0 };

  let { interval, ease_factor, repetitions } = prev;

  if (quality === 0) {
    // Wrong answer — reset streak, short re-review tomorrow
    interval    = 1;
    repetitions = 0;
    ease_factor = Math.max(130, ease_factor - 20); // floor at 1.30
  } else {
    // Correct answer — advance
    if (repetitions === 0)      interval = 1;
    else if (repetitions === 1) interval = 4;
    else                         interval = Math.round(interval * (ease_factor / 100));

    repetitions += 1;

    // Adjust ease: quality 1 = -15, quality 2 = no change, quality 3 = +10
    const easeAdjust = quality === 1 ? -15 : quality === 3 ? 10 : 0;
    ease_factor = Math.max(130, ease_factor + easeAdjust);
  }

  const next_review_date = new Date(
    Date.now() + interval * 24 * 60 * 60 * 1000
  ).toISOString();

  // ── Upsert into user_reviews ───────────────────────────────────────────────
  const { error: upsertError } = await supabase
    .from("user_reviews")
    .upsert(
      {
        user_id:          user.id,
        item_id:          itemId,
        interval,
        ease_factor,
        repetitions,
        next_review_date,
        last_reviewed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,item_id" } // uses the UNIQUE constraint
    );

  if (upsertError) {
    throw new Error(
      `[recordReview] Failed to save review: ${upsertError.message}`
    );
  }
}
