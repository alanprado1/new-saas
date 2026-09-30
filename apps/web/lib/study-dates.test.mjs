import assert from "node:assert/strict";
import { test } from "node:test";
import { dateKeyAtOffset, addDaysToDateKey } from "./study-dates.ts";

test("Sydney's local day advances before the UTC day", () => {
  assert.equal(dateKeyAtOffset(new Date("2026-09-30T15:00:00Z"), -600), "2026-10-01");
});

test("review intervals start from the learner's local day", () => {
  assert.equal(addDaysToDateKey("2026-10-01", 5), "2026-10-06");
});
