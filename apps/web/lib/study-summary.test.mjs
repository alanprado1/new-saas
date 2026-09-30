import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStudySummary } from "./study-summary.ts";

test("study summary uses real cards, prioritizes due reviews, and accepts legacy Japanese progress", () => {
  const summary = buildStudySummary(
    ["猫", "犬", "鳥", "魚"],
    [
      { card_id: "猫", repetition: 3, next_review: "2026-09-29" },
      { card_id: "ja-en:犬", repetition: 1, next_review: "2026-10-03" },
    ],
    "ja-en",
    "2026-09-30",
    2,
  );

  assert.deepEqual(summary, {
    total: 4,
    studied: 2,
    strong: 1,
    dueReviews: 1,
    newAvailable: 2,
    sessionReviews: 1,
    sessionNew: 1,
    sessionTotal: 2,
    progressPercent: 50,
  });
});

test("an empty level has no session or invented progress", () => {
  assert.deepEqual(buildStudySummary([], [], "ja-en", "2026-09-30"), {
    total: 0,
    studied: 0,
    strong: 0,
    dueReviews: 0,
    newAvailable: 0,
    sessionReviews: 0,
    sessionNew: 0,
    sessionTotal: 0,
    progressPercent: 0,
  });
});

test("English direction progress uses its stored card ids", () => {
  const summary = buildStudySummary(
    ["hello"],
    [{ card_id: "hello", repetition: 3, next_review: "2026-09-29" }],
    "en-ja",
    "2026-09-30",
  );
  assert.equal(summary.studied, 1);
  assert.equal(summary.strong, 1);
  assert.equal(summary.dueReviews, 1);
  assert.equal(summary.newAvailable, 0);
});
