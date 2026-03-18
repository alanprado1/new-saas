// ─────────────────────────────────────────────────────────────────────────────
// lib/sm2.ts  —  Modernised SM-2 spaced-repetition algorithm
// ─────────────────────────────────────────────────────────────────────────────

export type SM2Quality = 0 | 1 | 2 | 3 | 4 | 5;

export interface SM2State {
  repetition:   number;  // how many times answered correctly in a row
  interval:     number;  // next review in days
  ease_factor:  number;  // multiplier for interval growth (min 1.3)
}

/** Default state for a brand-new card that has never been reviewed. */
export const DEFAULT_SM2_STATE: SM2State = {
  repetition:  0,
  interval:    1,
  ease_factor: 2.5,
};

/**
 * Calculate the next SM-2 state given a quality rating and the card's
 * current state. Returns a new state object (does not mutate the input).
 */
export function calculateSM2(
  quality: SM2Quality,
  previous: SM2State = DEFAULT_SM2_STATE,
): SM2State {
  const { repetition, interval, ease_factor } = previous;

  // ── Ease-factor adjustment (applied regardless of pass/fail) ─────────────
  const newEF = Math.max(
    1.3,
    ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  // ── Fail (quality < 2) — "Again" (0) ─────────────────────────────────────
  // By lowering the fail threshold to 2, "Hard" officially becomes a pass!
  if (quality < 2) {
    return {
      repetition:  0,
      interval:    1, // Review again tomorrow
      ease_factor: newEF,
    };
  }

  // ── Pass (quality >= 2) — "Hard" (2), "Good" (4), "Easy" (5) ─────────────
  let newInterval: number;
  const newRepetition = repetition + 1;

  // 1. Initial Learning Steps (Brand new card or right after a failure reset)
  if (repetition === 0) {
    if (quality === 5) {
      newInterval = 8; // Easy
    } else if (quality === 4) {
      newInterval = 4; // Good
    } else {
      newInterval = 1; // Hard (or fallback)
    }
  } 
  // 2. Continuous Growth (2nd review and beyond)
  else {
    // Multiply the previous interval by the Ease Factor.
    // E.g., if Good(4) was chosen initially, the 2nd interval is: 4 * 2.5 = 10 days.
    newInterval = Math.round(interval * newEF);
  }

  return {
    repetition:  newRepetition,
    interval:    newInterval,
    ease_factor: newEF,
  };
}

/** Convenience map from button label to SM-2 quality. */
export const RATING_TO_QUALITY: Record<"again" | "hard" | "good" | "easy", SM2Quality> = {
  again: 0,
  hard:  2,
  good:  4,
  easy:  5,
};