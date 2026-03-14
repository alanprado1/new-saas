// lib/srs.ts

export function calculateSM2(
  current_ease_factor: number,
  current_interval: number,
  repetitions: number,
  user_rating: 1 | 2 | 3 | 4 // 1: Again, 2: Hard, 3: Good, 4: Easy
) {
  let new_interval: number;
  let new_repetitions = repetitions;
  let new_ease_factor = current_ease_factor;

  if (user_rating === 1) {
    // FAIL: Reset repetitions and interval, heavily penalize ease factor
    new_repetitions = 0;
    new_interval = 1;
    new_ease_factor = Math.max(1.3, current_ease_factor - 0.2);
  } else {
    // PASS: Increment repetitions
    new_repetitions += 1;

    // Calculate base interval
    if (new_repetitions === 1) {
      new_interval = 1;
    } else if (new_repetitions === 2) {
      new_interval = 6;
    } else {
      new_interval = current_interval * current_ease_factor;
    }

    // Map your 1-4 scale to the standard SM-2 0-5 quality scale
    // (Hard = 3, Good = 4, Easy = 5)
    const q = user_rating === 2 ? 3 : user_rating === 3 ? 4 : 5;
    
    // Standard SM-2 Ease Factor formula
    new_ease_factor = current_ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    new_ease_factor = Math.max(1.3, new_ease_factor);
    
    // Apply Fuzz Factor: interval * (0.95 to 1.05)
    if (new_interval > 1) {
      const fuzz = 0.95 + (Math.random() * 0.1);
      new_interval = new_interval * fuzz;
    }
  }

  // Round to nearest whole day
  new_interval = Math.round(new_interval);

  // Calculate the exact next review date
  const new_next_review_date = new Date();
  new_next_review_date.setDate(new_next_review_date.getDate() + new_interval);

  return {
    new_interval,
    new_ease_factor,
    new_repetitions,
    new_next_review_date: new_next_review_date.toISOString(),
  };
}