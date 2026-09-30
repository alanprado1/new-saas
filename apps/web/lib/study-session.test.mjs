import assert from "node:assert/strict";
import { test } from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { loadAppModule } from "./test-loader.mjs";

test("study visits reuse data; saves update dashboards and preserve session completion", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/" });
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const cache = new Map();
  const snapshot = {
    userId: "alice", direction: "ja-en", today: new Date().toISOString().slice(0, 10), timezoneOffsetMinutes: 0,
    vocabulary: [{ id: "1", level: "n5", kanji: "猫", reading: "ねこ", meaning: "cat", example_jp: "猫です。", example_en: "A cat." }], progress: [],
  };
  let loads = 0;
  let saveAttempts = 0;
  let failSave = false;
  let delaySave = false;
  let resolveSave;
  let authListener;
  const overrides = {
    "next/navigation": { useRouter: () => ({ push() {}, back() {} }), useSearchParams: () => new URLSearchParams("direction=ja-en") },
    "next/link": { __esModule: true, default: ({ children, href }) => React.createElement("a", { href }, children) },
    "@/hooks/useTheme": { useTheme: () => ({ theme: { accent: "#f5c842", accentRgb: "245,200,66" } }) },
    "@/utils/supabase/client": { createClient: () => ({ auth: { onAuthStateChange(callback) {
      authListener = callback;
      queueMicrotask(() => callback("INITIAL_SESSION", { user: { id: "alice" } }));
      return { data: { subscription: { unsubscribe() {} } } };
    } } }) },
    "@/app/actions/study": {
      getStudySnapshot: async () => { loads++; return snapshot; },
      saveCardProgress: async () => { saveAttempts++; if (failSave) throw new Error("Please retry your answer."); if (delaySave) return new Promise(resolve => { resolveSave = resolve; }); return { repetition: 1, interval: 5, ease_factor: 2.1 }; },
    },
    "@/lib/study-save": { saveWithRetry: async fn => { for (let i = 0; ; i++) { try { return await fn(); } catch (err) { if (i === 2) throw err; } } } },
    "@/components/StudyCard": { __esModule: true, default: ({ card, onRate, isSaving, saveError }) => React.createElement("div", null,
      React.createElement("span", null, card.kanji),
      React.createElement("button", { disabled: isSaving, onClick: () => onRate("good") }, "Good"),
      saveError && React.createElement("p", { role: "alert" }, saveError)) },
  };
  const Provider = loadAppModule("components/StudyCacheProvider.tsx", overrides, "", cache);
  const { buildStudyLevel } = loadAppModule("lib/study-data.ts", overrides, "", cache);
  const { LoadedSession } = loadAppModule("app/study/[level]/session/page.tsx", overrides, "\nexport { LoadedSession };\n", cache);
  function Screen({ session = false }) {
    const { snapshot: data, cacheKey } = Provider.useStudySnapshot("ja-en");
    if (!data) return React.createElement("p", null, "Skeleton");
    const level = buildStudyLevel(data, "n5");
    return session ? React.createElement(LoadedSession, { cards: level.cards, level: "n5", cacheKey, back: "/study/n5", userId: data.userId })
      : React.createElement("p", null, `Studied ${level.summary.studied}; due ${level.summary.sessionTotal}`);
  }
  const container = dom.window.document.getElementById("root");
  const root = createRoot(container);
  const render = async session => act(async () => { root.render(React.createElement(Provider.default, null, React.createElement(Screen, { session }))); });
  try {
    await render(false);
    assert.match(container.textContent, /Studied 0; due 1/);
    assert.equal(loads, 1);
    await render(true);
    assert.match(container.textContent, /猫/);
    await render(false);
    await act(async () => { dom.window.dispatchEvent(new dom.window.Event("focus")); });
    assert.equal(loads, 1);
    assert.doesNotMatch(container.textContent, /Skeleton/);
    await render(true);
    failSave = true;
    await act(async () => { [...container.querySelectorAll("button")].find(button => button.textContent === "Good").click(); });
    assert.match(container.textContent, /猫/);
    assert.match(container.textContent, /Please retry/);
    assert.doesNotMatch(container.textContent, /Session Complete/);
    failSave = false;
    await act(async () => { [...container.querySelectorAll("button")].find(button => button.textContent === "Good").click(); });
    assert.match(container.textContent, /Session Complete/);
    assert.equal(saveAttempts, 4);
    await render(false);
    assert.match(container.textContent, /Studied 1; due 0/);
    assert.equal(loads, 1);
    await render(true);
    assert.match(container.textContent, /No cards to study right now/);
    await act(async () => { authListener("SIGNED_OUT", null); });
    assert.doesNotMatch(container.textContent, /猫|Session Complete/);
    await act(async () => { authListener("SIGNED_IN", { user: { id: "alice" } }); });
    await render(true);
    delaySave = true;
    await act(async () => { [...container.querySelectorAll("button")].find(button => button.textContent === "Good").click(); });
    await render(false); // Browser Back can leave while the submitted save runs.
    assert.match(container.textContent, /Studied 0; due 1/);
    await act(async () => { resolveSave({ repetition: 1, interval: 5, ease_factor: 2.1 }); });
    assert.match(container.textContent, /Studied 1; due 0/);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

test("a reopened session adopts refreshed progress before accepting its first rating", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/" });
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const savedStates = [];
  const overrides = {
    "next/navigation": { useRouter: () => ({ push() {}, back() {} }) },
    "next/link": { __esModule: true, default: ({ children }) => React.createElement("a", null, children) },
    "@/hooks/useTheme": { useTheme: () => ({ theme: {} }) },
    "@/components/StudyCacheProvider": { cacheSavedStudyProgress() {} },
    "@/app/actions/study": { saveCardProgress: async (_id, _rating, state) => { savedStates.push(state); return state; } },
    "@/components/StudyCard": { __esModule: true, default: ({ card, onRate, isSaving }) => React.createElement("div", null,
      React.createElement("span", null, card.kanji), React.createElement("button", { disabled: isSaving, onClick: () => onRate("good") }, "Good")) },
  };
  const { LoadedSession } = loadAppModule("app/study/[level]/session/page.tsx", overrides, "\nexport { LoadedSession };\n");
  const container = dom.window.document.getElementById("root");
  const root = createRoot(container);
  const props = { cards: [{ kanji: "猫", repetition: 0, interval: 1, ease_factor: 2.1 }], level: "n5", cacheKey: "alice", userId: "alice", back: "/study/n5" };
  try {
    await act(async () => root.render(React.createElement(LoadedSession, { ...props, ready: false })));
    const good = () => [...container.querySelectorAll("button")].find(button => button.textContent === "Good");
    assert.equal(good().disabled, true);
    await act(async () => root.render(React.createElement(LoadedSession, { ...props, ready: true, cards: [{ ...props.cards[0], repetition: 5, interval: 20 }] })));
    await act(async () => good().click());
    assert.deepEqual(savedStates, [{ repetition: 5, interval: 20, ease_factor: 2.1 }]);
    assert.match(container.textContent, /Session Complete/);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
