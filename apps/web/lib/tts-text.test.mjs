import assert from "node:assert/strict";
import { test } from "node:test";
import { furiganaToSpeechText } from "./tts-text.ts";

test("keeps は as a particle while preserving 働's annotated reading", () => {
  assert.equal(
    furiganaToSpeechText("[彼](かれ)は[新聞社](しんぶんしゃ)で[働](はたら)いています。"),
    "カレはシンブンシャでハタラいています。",
  );
});

test("preserves the annotated reading of 町", () => {
  assert.equal(
    furiganaToSpeechText("[彼](かれ)はこの[町](まち)の[市民](しみん)です。"),
    "カレはこのマチのシミンです。",
  );
});

test("keeps kanji context for VoiceVox phrase boundaries", () => {
  assert.equal(
    furiganaToSpeechText("[彼](かれ)は[新聞社](しんぶんしゃ)で[働](はたら)いています。", "surface"),
    "彼は新聞社で働いています。",
  );
});
