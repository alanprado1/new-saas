import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { segmentJapaneseWords } from "./japanese-word-segments.ts";

const require = createRequire(import.meta.url);
const kuromoji = require("kuromoji");
const here = path.dirname(fileURLToPath(import.meta.url));
const tokenizer = await new Promise((resolve, reject) => {
  kuromoji.builder({ dicPath: path.join(here, "../public/dict") }).build((error, value) =>
    error ? reject(error) : resolve(value));
});

test("conjugated words stay together while particles and punctuation stay separate", () => {
  const words = segmentJapaneseWords("あ、待って！写真を撮るから。", tokenizer);
  assert.deepEqual(words.map(({ surface }) => surface),
    ["あ", "、", "待って", "！", "写真", "を", "撮る", "から", "。"]);
  assert.deepEqual(words.filter(({ clickable }) => clickable).map(({ speech }) => speech),
    ["あ", "まって", "しゃしん", "お", "とる", "から"]);
});

test("polite verb endings and grammatical particle readings use sentence context", () => {
  const words = segmentJapaneseWords("ここへ行きます。私は食べました。", tokenizer);
  assert.deepEqual(words.filter(({ clickable }) => clickable).map(({ surface, speech }) => [surface, speech]), [
    ["ここ", "ここ"], ["へ", "え"], ["行きます", "いきます"],
    ["私", "わたし"], ["は", "わ"], ["食べました", "たべました"],
  ]);
});
