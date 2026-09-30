import assert from "node:assert/strict";
import { test } from "node:test";
import { loadAppModule } from "./test-loader.mjs";

const { saveWithRetry } = loadAppModule("lib/study-save.ts");

test("a transient save failure retries the same answer quietly", async () => {
  let attempts = 0;
  const waits = [];
  const state = { repetition: 1, interval: 5, ease_factor: 2.1 };
  const saved = await saveWithRetry(async () => {
    attempts++;
    if (attempts < 3) throw new Error("Network interrupted");
    return state;
  }, async ms => { waits.push(ms); });
  assert.equal(saved, state);
  assert.equal(attempts, 3);
  assert.equal(waits.length, 2);
});

test("persistent save failures remain recoverable instead of reporting success", async () => {
  let attempts = 0;
  await assert.rejects(saveWithRetry(async () => { attempts++; throw new Error("Please retry"); }, async () => {}), /Please retry/);
  assert.equal(attempts, 3);
});

test("leaving a session stops pending retries before another account can save", async () => {
  const controller = new AbortController();
  let attempts = 0;
  await assert.rejects(saveWithRetry(async () => { attempts++; throw new Error("Network interrupted"); }, async () => { controller.abort(); }, controller.signal));
  assert.equal(attempts, 1);
});
