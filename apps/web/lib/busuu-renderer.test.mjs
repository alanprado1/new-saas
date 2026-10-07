import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from './busuu-test-helpers.mjs';
const css = new Proxy({}, { get: (_, key) => String(key) });
const overrides = { '@/app/busuu/runner.module.css': { __esModule: true, default: css } };

test('rendered markup hides post-answer support entirely and provides semantic removable gap controls', () => {
  const { getLessonSpec } = loadCourseModule('lib/busuu/inventory.ts');
  const { createLessonState } = loadCourseModule('lib/busuu/runner.ts');
  const { default: Renderer } = loadCourseModule('components/busuu/LessonScreen.tsx', overrides);
  const pack = getLessonSpec('B2.C01.L01').contentPack;
  for (const [i, screen] of pack.screens.entries()) {
    const state = { ...createLessonState(pack), index: i, phase: 'response', audioReady: true, slots: screen.answer?.slots?.map(() => null) ?? [] };
    const before = renderToStaticMarkup(React.createElement(Renderer, { screen, state, dispatch() {} }));
    for (const block of screen.support.after.filter(b => b.kind !== 'japanese')) assert.ok(!before.includes(block.text), `hidden ${screen.screenId}: ${block.kind}`);
    const after = renderToStaticMarkup(React.createElement(Renderer, { screen, state: { ...state, phase: 'feedback' }, dispatch() {} }));
    assert.match(after, /disabled=""|model/);
    if (screen.renderer === 'gaps') assert.equal((before.match(/aria-label="Gap /g) ?? []).length, screen.answer.slots.length);
  }
  const screen = pack.screens[5];
  const html = renderToStaticMarkup(React.createElement(Renderer, { screen, state: { ...createLessonState(pack), phase: 'response', audioReady: true, slots: ['token-3', null] }, dispatch() {} }));
  assert.match(html, /aria-label="Remove 申します from gap 1"/);
});

test('development preview identifies a missing required audio script instead of instructing impossible playback', () => {
  const pack = structuredClone(loadCourseModule('lib/busuu/inventory.ts').getLessonSpec('B2.C01.L01').contentPack);
  pack.screens[0].audio.text = null;
  const Runner = loadCourseModule('components/busuu/LessonRunner.tsx', overrides).default;
  const html = renderToStaticMarkup(React.createElement(Runner, { pack, preview: true, title: 'Preview', returnHref: '/busuu/B2', onExit() {} }));
  assert.match(html, /Required Japanese audio script is missing/);
  assert.match(html, /Development preview/);
  assert.doesNotMatch(html, /Play the source audio to continue/);
});
