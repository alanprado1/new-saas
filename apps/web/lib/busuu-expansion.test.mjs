import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from './busuu-test-helpers.mjs';
import { completeExpansionFixture, correctActions } from './busuu-expansion-fixtures.mjs';

const get = file => loadCourseModule(`lib/busuu/${file}.ts`);
const screen = (renderer, extra = {}) => ({ screenId: 'B2.C01.L02.A01.S01', renderer, prompt: 'Test fixture',
  answer: null, support: { before: [], after: [] }, praise: null, audio: { required: false, text: null },
  visual: 'none', evidence: [], unresolved: [], ...extra });
const packOf = s => ({ schemaVersion: '1.0', contentVersion: '1.0.0', recordId: 'B2.C01.L02', status: 'reviewed', baseScreenCount: 1, screens: [s] });

test('L02 and L03 expose aligned non-scoring previews and never create saved attempts from missing content', () => {
  for (const [id, count] of [['B2.C01.L02', 9], ['B2.C01.L03', 10]]) {
    const spec = { ...get('inventory').getLessonSpec(id), contentPack: get('content-registry').getContentPack(id, '1.0.0') };
    assert.ok(spec.contentPack, 'versioned content pack must be registered');
    const readiness = get('readiness').getLessonReadiness(spec);
    assert.equal(readiness.runnerAvailable, true);
    assert.equal(readiness.previewAvailable, true);
    assert.equal(readiness.scoredLaunchReady, false);
    assert.throws(() => get('attempt').initialAttemptState(spec.contentPack));
    const m = get('runner'); let state = m.transitionLesson(spec.contentPack, m.createLessonState(spec.contentPack), { type: 'start_preview' });
    for (let i = 0; i < count; i++) {
      assert.equal(state.index, i);
      assert.equal(spec.contentPack.screens[i].screenId, `${id}.A01.S${String(i + 1).padStart(2, '0')}`);
      state = m.transitionLesson(spec.contentPack, state, { type: 'preview_skip', screenId: spec.contentPack.screens[i].screenId });
    }
    assert.equal(state.phase, 'result'); assert.equal(state.visited.length, count);
    assert.equal(m.getLessonResult(spec.contentPack, state).percent, null);
  }
});

test('complete explanation tables and dialogue are ungraded and require their own complete text', () => {
  const table = screen('table', { table: { caption: 'Actor/register', columns: ['Actor', 'Register'], rows: [{ id: 'self', cells: ['Self', 'Humble'] }] } });
  const dialogue = screen('dialogue', { dialogue: { japaneseVisible: false, speakers: ['guest', 'staff'], turns: [
    { id: 't1', speaker: 'guest', japanese: 'こんにちは。', english: 'Hello.' },
    { id: 't2', speaker: 'staff', japanese: 'どうぞ。', english: 'Please.' },
  ] } });
  for (const s of [table, dialogue]) {
    const p = packOf(s), m = get('runner');
    assert.equal(get('content-readiness').getPackReadiness(p).playable, true);
    let state = m.transitionLesson(p, m.createLessonState(p), { type: 'start' });
    assert.equal(state.phase, 'presentation');
    state = m.transitionLesson(p, state, { type: 'continue', screenId: s.screenId });
    assert.deepEqual(m.getLessonResult(p, state), { correct: 0, graded: 0, percent: null, completionEligible: true });
  }
  table.table.rows[0].cells[0] = null;
  assert.equal(get('content-readiness').getPackReadiness(packOf(table)).playable, false);
  dialogue.dialogue.turns[0].english = null;
  assert.equal(get('content-readiness').getPackReadiness(packOf(dialogue)).playable, false);
});

test('recorded response counts, hidden listening support and pre-answer hints guard scored readiness', () => {
  const s = screen('choice', { answer: { kind: 'choice', options: [{ id: 'a', text: 'One' }, { id: 'b', text: 'Two' }], acceptedOptionIds: ['a'] },
    praise: 'Correct', support: { before: [], after: [{ kind: 'explanation', text: 'Test explanation' }] },
    sourceContract: { responseSlotCount: null, transcriptBeforeAnswer: false, hintBeforeAnswer: false } });
  assert.equal(get('content-readiness').getPackReadiness(packOf(s)).playable, true);
  s.support.before.push({ kind: 'japanese', text: '秘密' });
  assert.equal(get('content-readiness').getPackReadiness(packOf(s)).playable, false);
  s.support.before = []; s.sourceContract.hintBeforeAnswer = true; s.hint = { text: null };
  assert.equal(get('content-readiness').getPackReadiness(packOf(s)).playable, false);
});

test('renderer keeps transcript-free material out of accessible markup and renders table, hint and partial slots', () => {
  const Renderer = loadCourseModule('components/busuu/LessonScreen.tsx').default;
  const render = s => renderToStaticMarkup(React.createElement(Renderer, { screen: s, state: { ...get('runner').createLessonState(packOf(s)), preview: true, phase: 'response', audioReady: true }, dispatch() {} }));
  const s = screen('choice', { sourceContract: { transcriptBeforeAnswer: false }, support: {
    before: [{ kind: 'japanese', text: 'HIDDEN_SCRIPT', secondary: 'HIDDEN_READING' }, { kind: 'translation', text: 'HIDDEN_TRANSLATION' }], after: [{ kind: 'explanation', text: 'HIDDEN_FEEDBACK' }] }, audio: { required: true, text: 'HIDDEN_AUDIO' } });
  assert.doesNotMatch(render(s), /HIDDEN_/);
  const table = screen('table', { table: { caption: 'Actor/register', columns: ['Actor', 'Form'], rows: [{ id: 'r', cells: ['Self', null] }] } });
  assert.match(render(table), /<table/); assert.match(render(table), /scope="col"/); assert.match(render(table), /Text unavailable/);
  assert.match(render(screen('gaps', { sourceContract: { responseSlotCount: 2 }, hint: { text: 'Fixture hint' } })), /Fixture hint/);
  assert.equal((render(screen('gaps', { sourceContract: { responseSlotCount: 2 } })).match(/Response gap/g) ?? []).length, 2);
  const dialogue = screen('dialogue', { dialogue: { japaneseVisible: false, speakers: ['guest', 'staff'], turns: [{ id: 't1', speaker: 'guest', japanese: 'HIDDEN_DIALOGUE', english: 'Documented support' }] } });
  assert.match(render(dialogue), /Documented support/); assert.doesNotMatch(render(dialogue), /HIDDEN_DIALOGUE/);
});

test('both complete fixture sequences grade once per response screen, resume partial state and finish without extra base rows', () => {
  const m = get('attempt');
  for (const [lesson, total, graded] of [['l02', 9, 7], ['l03', 10, 6]]) {
    const pack = completeExpansionFixture(lesson);
    let state = m.initialAttemptState(pack);
    const apply = action => { state = m.evaluateAction(pack, state, { ...action, screenId: pack.screens[state.index].screenId }); };
    for (let i = 0; i < total; i++) {
      const s = pack.screens[i]; assert.equal(state.index, i);
      if (!state.audioReady) apply({ type: 'audio_ready' });
      for (const action of correctActions(s)) {
        apply(action);
        // A persisted/reopened JSON state restores endpoint, matches, token placements and feedback exactly.
        const persisted = JSON.stringify(state); state = JSON.parse(persisted);
        assert.equal(JSON.stringify(state), persisted);
      }
      if (s.answer) assert.equal(state.phase, 'feedback');
      apply({ type: 'continue' });
    }
    assert.deepEqual(m.attemptResult(pack, state), { correct: graded, graded, percent: 100, completionEligible: true });
    assert.equal(state.visited.length, total);
    assert.throws(() => m.evaluateAction(pack, state, { type: 'continue', screenId: pack.screens.at(-1).screenId }));
  }
});

test('content registry resolves exact versions and rejects foreign lesson alignment and changed occurrence counts', () => {
  const { getContentPack, assertContentAlignment } = get('content-registry');
  const spec = get('inventory').getLessonSpec('B2.C01.L02');
  assert.equal(getContentPack('B2.C01.L02', '2.0.0'), null);
  assert.equal(getContentPack('B2.C01.L02', '1.0.0').recordId, 'B2.C01.L02');
  assert.throws(() => assertContentAlignment(getContentPack('B2.C01.L03'), spec));
  const changed = structuredClone(spec.contentPack); changed.screens[3].sourceContract.responseSlotCount = 3;
  assert.throws(() => assertContentAlignment(changed, spec));
  const server = get('attempt-server');
  assert.notEqual(server.coursePack('B2.C01.L02').hash, server.coursePack('B2.C01.L03').hash);
  assert.equal(server.coursePack('B2.C01.L01', '1.0.0').hash, '631c827850208d3fbd9f26d5a81f8cb7957c665de3872ffd571e62fa0388d349');
});
test('history model requires the documented English and parallel script', () => {
  const fixture = completeExpansionFixture('l03'), readiness = get('content-readiness');
  assert.equal(fixture.screens[2].sourceContract.translationBeforeAnswer, true);
  assert.equal(fixture.screens[2].sourceContract.parallelReadingBeforeAnswer, true);
  assert.equal(readiness.getPackReadiness(fixture).playable, true);
  const missingEnglish = structuredClone(fixture); missingEnglish.screens[2].support.before = missingEnglish.screens[2].support.before.filter(b => b.kind !== 'translation');
  assert.equal(readiness.getPackReadiness(missingEnglish).playable, false);
  const missingReading = structuredClone(fixture); delete missingReading.screens[2].support.before.find(b => b.kind === 'japanese').secondary;
  assert.equal(readiness.getPackReadiness(missingReading).playable, false);
});
test('cumulative scene reuse must point to an earlier dialogue in the same lesson', () => {
  const fixture = completeExpansionFixture('l03'), readiness = get('content-readiness');
  for (const target of ['B2.C01.L03.A01.S99', 'B2.C01.L03.A01.S01', 'B2.C01.L02.A01.S09', 'B2.C01.L03.A01.S10']) {
    const invalid = structuredClone(fixture); invalid.screens[9].sourceContract.sceneReuse = target;
    assert.equal(readiness.getPackReadiness(invalid).playable, false, target);
  }
});
