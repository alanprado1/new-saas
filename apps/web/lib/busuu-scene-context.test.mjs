import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from './busuu-test-helpers.mjs';

const screen = (id, renderer, extra = {}) => ({ screenId: id, renderer, prompt: 'Fixture instruction', answer: null,
  support: { before: [], after: [] }, praise: null, audio: { required: false, text: null }, visual: 'none', evidence: [], unresolved: [], ...extra });
const pack = (recordId, screens) => ({ recordId, schemaVersion: '1.0', contentVersion: '1.0.0', status: 'reviewed', baseScreenCount: screens.length, screens });
const scene = () => screen('B2.C03.L03.A02.S03', 'dialogue', { dialogue: { japaneseVisible: true, translationVisible: false,
  context: 'Dessert service', speakerLabels: { guest: 'Customer', staff: 'Server' }, speakers: ['guest', 'staff'], turns: [
    { id: 'staff-1', speaker: 'staff', japanese: 'いらっしゃいませ。', english: null },
    { id: 'guest-1', speaker: 'guest', japanese: '抹茶味をお願いします。', english: null },
  ], facts: [{ id: 'selected-flavor', turnId: 'guest-1', text: '抹茶味' }] } });
const question = () => screen('B2.C03.CP.A01.S01', 'choice', { praise: 'Correct', support: { before: [], after: [{ kind: 'explanation', text: 'The customer ordered matcha.' }] },
  sceneContext: { recordId: 'B2.C03.L03', contentVersion: '1.0.0', screenId: 'B2.C03.L03.A02.S03', factId: 'selected-flavor', expectedText: '抹茶味', answerOptionId: 'matcha', access: 'review_before_launch' },
  answer: { kind: 'choice', options: [{ id: 'matcha', text: '抹茶味' }, { id: 'strawberry', text: 'いちご味' }], acceptedOptionIds: ['matcha'] } });
const setup = () => {
  const source = pack('B2.C03.L03', [scene()]), target = pack('B2.C03.CP', [question()]);
  const resolver = (id, version) => id === source.recordId && version === source.contentVersion ? source : null;
  const context = loadCourseModule('lib/busuu/scene-context.ts');
  return { source, target, resolver, context };
};

test('Japanese-only service dialogue accepts null translations and renders configured roles without English or hotel copy', () => {
  const s = scene(), readiness = loadCourseModule('lib/busuu/content-readiness.ts');
  s.sourceContract = { transcriptBeforeAnswer: true, translationBeforeAnswer: false };
  assert.deepEqual(readiness.getScreenContentGaps(s), []);
  const Renderer = loadCourseModule('components/busuu/LessonScreen.tsx').default;
  s.dialogue.turns[0].english = 'HIDDEN_ENGLISH';
  s.support.before.push({ kind: 'translation', text: 'HIDDEN_TRANSCRIPT_TRANSLATION' });
  const html = renderToStaticMarkup(React.createElement(Renderer, { screen: s, state: { phase: 'presentation', audioReady: false }, dispatch() {} }));
  assert.match(html, /Customer/); assert.match(html, /Server/); assert.match(html, /Dessert service/); assert.match(html, /抹茶味/);
  assert.doesNotMatch(html, /HIDDEN_ENGLISH|HIDDEN_TRANSCRIPT_TRANSLATION|English dialogue support|Hotel|Guest and staff/);
  assert.ok(readiness.getScreenContentGaps(s).some(g => g.field === 'support.translation'));
  s.support.before = [];
  delete s.dialogue.translationVisible;
  assert.ok(readiness.getScreenContentGaps(s).some(g => g.field === 'dialogue'));
  s.sourceContract.translationBeforeAnswer = true;
  s.dialogue.turns.forEach(t => { t.english = 'Legacy English'; });
  assert.deepEqual(readiness.getScreenContentGaps(s), []);
});

test('cross-lesson context resolves only exact version, screen and verified turn fact, with an exact answer binding', () => {
  const { source, target, resolver, context } = setup();
  assert.equal(context.getSceneContext(target, target.screens[0], resolver).screen, source.screens[0]);
  assert.deepEqual(context.getSceneContextGaps(target, resolver), []);
  const mutate = change => { const p = structuredClone(target); change(p.screens[0]); assert.ok(context.getSceneContextGaps(p, resolver).length); };
  mutate(s => { s.sceneContext.contentVersion = '1.0.1'; });
  mutate(s => { s.sceneContext.screenId = 'B2.C03.L03.A02.S04'; });
  mutate(s => { s.sceneContext.factId = 'missing'; });
  mutate(s => { s.sceneContext.expectedText = 'いちご味'; });
  mutate(s => { s.answer.acceptedOptionIds = ['strawberry']; });
  mutate(s => { s.answer.options[0].text = 'いちご味'; });
  mutate(s => { s.answer.options[1].text = '抹茶味'; });
  mutate(s => { s.sceneContext.access = 'infer_unlock'; });
  const wrongVersion = structuredClone(target); wrongVersion.screens[0].sceneContext.contentVersion = '9.9.9';
  assert.ok(context.getSceneContextGaps(wrongVersion, () => source).length, 'resolver must not substitute another version');
  source.screens[0].dialogue.facts.push({ ...source.screens[0].dialogue.facts[0] });
  assert.ok(context.getSceneContextGaps(target, resolver).length, 'duplicate facts are ambiguous');
  source.screens[0].dialogue.facts.pop();
  source.screens[0].dialogue.turns[0].japanese = null;
  assert.ok(context.getSceneContextGaps(target, resolver).length, 'review source must have all complete turns');
  source.screens[0].dialogue.turns[0].japanese = 'いらっしゃいませ。';
  source.screens[0].dialogue.facts[0].text = 'いちご味';
  assert.ok(context.getSceneContextGaps(target, resolver).length, 'facts must be supported by their source turn');
});

test('readiness fails unresolved context and forbids a quiz transcript, source audio and hidden replay', () => {
  const { target, resolver } = setup(), readiness = loadCourseModule('lib/busuu/content-readiness.ts');
  assert.equal(readiness.getPackReadiness(target, resolver).playable, true);
  assert.equal(readiness.getPackReadiness(target, () => null).playable, false);
  for (const mutate of [s => { s.audio.text = '抹茶味をお願いします。'; }, s => { s.audio.feedbackText = '抹茶味をお願いします。'; },
    s => { s.support.before.push({ kind: 'japanese', text: '抹茶味をお願いします。' }); }, s => { s.audio.required = true; }]) {
    const p = structuredClone(target); mutate(p.screens[0]); assert.equal(readiness.getPackReadiness(p, resolver).playable, false);
  }
});

test('question markup hides pre-answer source even for invalid injected support and exposes review only before launch', () => {
  const { target, resolver, context } = setup();
  const Renderer = loadCourseModule('components/busuu/LessonScreen.tsx').default;
  target.screens[0].support.before.push({ kind: 'japanese', text: 'HIDDEN_TRANSCRIPT' });
  target.screens[0].hint = { text: 'HIDDEN_HINT' };
  const html = renderToStaticMarkup(React.createElement(Renderer, { screen: target.screens[0], state: { phase: 'response', audioReady: true }, dispatch() {} }));
  assert.doesNotMatch(html, /HIDDEN_TRANSCRIPT|HIDDEN_HINT/);
  const reviews = context.getLaunchSceneReviews(target, resolver);
  assert.equal(reviews.length, 1); assert.equal(target.baseScreenCount, 1); assert.equal(target.screens.length, 1);
  const Review = loadCourseModule('components/busuu/LessonScreen.tsx').Dialogue;
  const reviewHtml = renderToStaticMarkup(React.createElement(Review, { screen: reviews[0].screen }));
  assert.match(reviewHtml, /抹茶味をお願いします。/); assert.doesNotMatch(reviewHtml, /Replay|<audio/);
});

test('real checkpoint starts in independently loaded evaluator and browser session without prior resolver installation', () => {
  const cp = JSON.parse(fs.readFileSync(new URL('../content/busuu/b2-c03-cp.v1.json', import.meta.url)));
  // Each loadCourseModule call owns a fresh module cache, like independent server and browser bundles.
  const evaluator = loadCourseModule('lib/busuu/attempt.ts');
  assert.equal(evaluator.initialAttemptState(cp).phase, 'response');
  const { CourseAttemptSession } = loadCourseModule('lib/busuu/attempt-client.ts');
  const session = new CourseAttemptSession(cp, 'fixture-owner', null, () => { throw new Error('No transport expected'); }, () => {}, 'fixture-writer');
  assert.equal(session.snapshot().state.phase, 'response'); session.dispose();
  const invalid = structuredClone(cp); invalid.screens[3].sceneContext.contentVersion = '1.0.1';
  assert.throws(() => evaluator.initialAttemptState(invalid), /cannot create/);
  assert.throws(() => new CourseAttemptSession(invalid, 'fixture-owner', null, () => {}, () => {}, 'fixture-writer'), /cannot create/);
});

test('real launch exposes accessible separate Japanese scene review before Start without adding checkpoint screens', () => {
  const { getLessonSpec } = loadCourseModule('lib/busuu/inventory.ts');
  const spec = getLessonSpec('B2.C03.CP');
  const readiness = loadCourseModule('lib/busuu/readiness.ts').getLessonReadiness(spec);
  const Launch = loadCourseModule('components/busuu/LessonLaunch.tsx', {
    '@/app/busuu/busuu.module.css': { __esModule: true, default: {} },
    'next/link': ({ href, children }) => React.createElement('a', { href }, children),
    'next/navigation': { useRouter: () => ({ push() {} }) },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Launch, { levelId: 'B2', entry: { id: 'B2.C03.CP', kind: 'checkpoint', sourceLabel: { value: 'Checkpoint' }, mappedObjective: { value: null } },
    chapter: { number: 3, label: 'Chapter 3' }, spec, readiness }));
  assert.match(html, /aria-labelledby="scene-review-title"/); assert.match(html, /<summary>.*scene review/);
  assert.match(html, /抹茶味のかき氷を一つお願いします。/); assert.match(html, /Customer/); assert.match(html, /Shop assistant/);
  assert.ok(html.indexOf('Review the earlier scene') < html.indexOf('Start lesson'));
  assert.doesNotMatch(html, /English dialogue support unavailable|Hotel scene|<audio|Replay audio/);
  assert.equal(spec.contentPack.screens.length, 20); assert.equal(spec.contentPack.baseScreenCount, 20);
  assert.equal(readiness.scoredLaunchReady, true);
});
