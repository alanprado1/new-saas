import assert from "node:assert/strict";
import { test } from "node:test";
import { levelCompletionPercent, pickContinueTarget } from "./continue-target.ts";

const entry = (id) => ({ id, title: id, subtitle: "", glyph: null });
const index = [
  { id: "A1", name: "Beginner", chapters: [{ number: 1, label: "One", entries: [entry("A1.1"), entry("A1.2")] }] },
  {
    id: "B2", name: "Upper Intermediate",
    chapters: [
      { number: 1, label: "Myself", entries: [entry("B2.1"), entry("B2.2"), entry("B2.3")] },
      { number: 2, label: "Food", entries: [entry("B2.4"), entry("B2.5")] },
    ],
  },
];
const ids = (...list) => new Set(list);

test("an unfinished attempt wins, first in course order", () => {
  const target = pickContinueTarget(index, ids("B2.1"), { "B2.5": { visited: 2 }, "B2.3": { visited: 1 } }, "B2.1");
  assert.equal(target.state, "in_progress");
  assert.equal(target.entry.id, "B2.3");
  assert.equal(target.level.id, "B2");
  assert.equal(target.chapter.number, 1);
  assert.equal(target.levelPercent, 20);
});

test("a completed lesson is never reported as in progress", () => {
  const target = pickContinueTarget(index, ids("B2.2"), { "B2.2": { visited: 4 } }, "B2.2");
  assert.equal(target.state, "next");
  assert.equal(target.entry.id, "B2.3");
});

test("with nothing in progress the next lesson after the last completed one is used, across chapters", () => {
  const target = pickContinueTarget(index, ids("B2.1", "B2.2", "B2.3"), {}, "B2.3");
  assert.equal(target.entry.id, "B2.4");
  assert.equal(target.chapter.label, "Food");
});

test("skips lessons already completed and wraps within the level", () => {
  const target = pickContinueTarget(index, ids("B2.1", "B2.4", "B2.5"), {}, "B2.5");
  assert.equal(target.entry.id, "B2.2");
});

test("moves on to the next level when the current level is finished", () => {
  const target = pickContinueTarget(index, ids("A1.1", "A1.2"), {}, "A1.2");
  assert.equal(target.entry.id, "B2.1");
  assert.equal(target.level.id, "B2");
});

test("a finished final level has no target", () => {
  assert.equal(pickContinueTarget(index, ids("A1.1", "B2.1", "B2.2", "B2.3", "B2.4", "B2.5"), {}, "B2.5"), null);
});

test("no saved progress gives no target, and unknown last ids are ignored", () => {
  assert.equal(pickContinueTarget(index, ids(), {}, null), null);
  assert.equal(pickContinueTarget(index, ids("X"), {}, "X"), null);
});

test("level completion percent matches the course map count", () => {
  assert.equal(levelCompletionPercent(index[1], ids("B2.1", "B2.5", "Z")), 40);
  assert.equal(levelCompletionPercent({ id: "C", name: "", chapters: [] }, ids()), 0);
});
