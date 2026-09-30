import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadAppModule } from "./test-loader.mjs";

const StudyCard = loadAppModule("components/StudyCard.tsx").default;
const props = {
  card: { kanji: "猫", reading: "ねこ", meaning: "cat", example_jp: "猫です。", example_en: "It's a cat." },
  theme: { accent: "#f5c842", accentRgb: "245,200,66" },
  onRate() {},
};

test("saving a study answer adds no visible content or layout row", () => {
  const ready = renderToStaticMarkup(React.createElement(StudyCard, props));
  const saving = renderToStaticMarkup(React.createElement(StudyCard, { ...props, isSaving: true }));
  assert.equal((saving.match(/<p\b/g) ?? []).length, (ready.match(/<p\b/g) ?? []).length);
  assert.equal(/Saving your answer/.test(saving), false);
});

test("failed saves remain visible and accessible for retry", () => {
  const html = renderToStaticMarkup(React.createElement(StudyCard, { ...props, saveError: "Please retry your answer." }));
  assert.match(html, /role="alert"/);
  assert.match(html, /Please retry your answer/);
});
