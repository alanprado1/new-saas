import assert from "node:assert/strict";
import { test } from "node:test";
import { loadAppModule } from "./test-loader.mjs";

const { buildStudyLevel, updateStudyProgress } = loadAppModule("lib/study-data.ts");
const snapshot = {
  userId: "alice", direction: "ja-en", today: "2026-09-30", timezoneOffsetMinutes: 0,
  vocabulary: [
    { id: "1", level: "n5", kanji: "猫", reading: "ねこ", meaning: "cat", example_jp: "猫です。", example_en: "A cat." },
    { id: "2", level: "n5", kanji: "犬", reading: "いぬ", meaning: "dog", example_jp: "犬です。", example_en: "A dog." },
    { id: "3", level: "n4", kanji: "鳥", reading: "とり", meaning: "bird", example_jp: "鳥です。", example_en: "A bird." },
  ],
  progress: [{ card_id: "犬", repetition: 2, interval: 5, ease_factor: 2.1, next_review: "2026-09-29" }],
};

test("cached levels prioritize due cards and retain the correct learning language", () => {
  const level = buildStudyLevel(snapshot, "n5");
  assert.deepEqual(level.cards.map(card => card.kanji), ["犬", "猫"]);
  assert.equal(level.cards[0].repetition, 2);
  assert.equal(level.summary.sessionTotal, 2);
  assert.equal(buildStudyLevel(snapshot, "n4").cards.length, 1);
});

test("saved ratings update stats and remove scheduled cards from future sessions", () => {
  const updated = updateStudyProgress(snapshot, "犬", { repetition: 3, interval: 10, ease_factor: 2.1 });
  const level = buildStudyLevel(updated, "n5");
  assert.equal(level.summary.strong, 1);
  assert.equal(level.summary.dueReviews, 0);
  assert.deepEqual(level.cards.map(card => card.kanji), ["猫"]);
  const learned = updateStudyProgress(updated, "猫", { repetition: 1, interval: 5, ease_factor: 2.1 });
  assert.equal(buildStudyLevel(learned, "n5").summary.studied, 2);
  assert.equal(buildStudyLevel(learned, "n5").cards.length, 0);
  assert.equal(buildStudyLevel(snapshot, "n5").summary.dueReviews, 1);
});

test("a repeated Again rating replaces progress without inflating studied counts", () => {
  const state = { repetition: 0, interval: 1, ease_factor: 1.9 };
  const first = updateStudyProgress(snapshot, "猫", state);
  const second = updateStudyProgress(first, "猫", state);
  assert.equal(buildStudyLevel(second, "n5").summary.studied, 2);
  assert.equal(second.progress.filter(row => row.card_id === "ja-en:猫").length, 1);
});

test("English levels use vocabulary ids and English sentence targets", () => {
  const english = { ...snapshot, direction: "en-ja", vocabulary: [{ id: "hello", level: "en-a1", reading: null, meaning: "Hello", example_jp: "こんにちは", example_en: "Hello there." }], progress: [] };
  const level = buildStudyLevel(english, "en-a1");
  assert.equal(level.cards[0].kanji, "hello");
  assert.equal(level.cards[0].targetText, "Hello there.");
  const saved = updateStudyProgress(english, "hello", { repetition: 1, interval: 5, ease_factor: 2.1 });
  assert.equal(saved.progress[0].card_id, "hello");
  assert.equal(buildStudyLevel(saved, "en-a1").summary.sessionTotal, 0);
});

test("future sessions refill beyond the first twenty cached cards", () => {
  const data = { ...snapshot, vocabulary: Array.from({ length: 25 }, (_, i) => ({ ...snapshot.vocabulary[0], id: String(i), kanji: String(i) })), progress: [] };
  const first = buildStudyLevel(data, "n5");
  assert.equal(first.cards.length, 20);
  const saved = first.cards.reduce((value, card) => updateStudyProgress(value, card.kanji, { repetition: 1, interval: 5, ease_factor: 2.1 }), data);
  assert.deepEqual(buildStudyLevel(saved, "n5").cards.map(card => card.kanji), ["20", "21", "22", "23", "24"]);
});
