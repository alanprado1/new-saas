import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveJapaneseCharacterVoices } from "./lesson-word-voices.ts";

test("matches cast voices and deterministic legacy fallback", () => {
  assert.deepEqual(resolveJapaneseCharacterVoices(["Hana", "Taro", "Hana"], { Hana: 8 }, null),
    { Hana: 8, Taro: 3 });
});

test("manual lesson voice override takes precedence for every speaker", () => {
  assert.deepEqual(resolveJapaneseCharacterVoices(["Hana", "Taro"], { Hana: 8, Taro: 1 }, 14),
    { Hana: 14, Taro: 14 });
});
