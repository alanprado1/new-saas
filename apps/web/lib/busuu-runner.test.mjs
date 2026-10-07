import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCourseModule } from './busuu-test-helpers.mjs';

const modules = () => ({ ...loadCourseModule('lib/busuu/inventory.ts'), ...loadCourseModule('lib/busuu/readiness.ts'), ...loadCourseModule('lib/busuu/runner.ts') });
function session() {
  const m = modules();
  const pack = m.getLessonSpec('B2.C01.L01').contentPack;
  assert.ok(pack, 'L01 needs a separate, versioned executable content pack');
  let state = m.createLessonState(pack);
  const send = (type, payload = {}) => (state = m.transitionLesson(pack, state, { type, screenId: pack.screens[state.index]?.screenId, ...payload }));
  const ready = () => send('audio_ready');
  const next = () => send('continue');
  send('start');
  return { m, pack, send, ready, next, get state() { return state; } };
}

test('L01 pack is evidence-backed, complete and separate from the retained structural audit', () => {
  const { getLessonSpec, getLessonReadiness } = modules();
  const spec = getLessonSpec('B2.C01.L01');
  assert.ok(spec.contentPack, 'executable pack is missing');
  assert.equal(spec.screens[0].modelOrScaffold.value, null, 'preserve imported audit');
  const r = getLessonReadiness(spec);
  assert.equal(r.textAnswers.complete, true);
  assert.equal(r.runnerAvailable, true);
  assert.equal(r.audio.ready, true);
  assert.equal(r.scoredLaunchReady, true);
  assert.equal(r.media.visualsDeferred, true);
  assert.equal(spec.contentPack.screens.length, 6);
  assert.ok(spec.contentPack.screens.every(s => s.evidence.length && s.evidence.every(e => /^[a-f0-9]{64}$/.test(e.sourceHash))));
  assert.doesNotMatch(JSON.stringify(spec.contentPack), /test_fixture|C:\\|Documents\//);
});

test('playback is optional; immediate grading and stale/repeated clicks preserve one result per screen', () => {
  const s = session();
  assert.equal(s.state.phase, 'presentation');
  s.next(); assert.equal(s.state.index, 1); assert.equal(s.state.phase, 'response'); assert.equal(s.state.audioReady, false);
  s.send('truth', { value: true }); assert.equal(s.state.phase, 'feedback');
  s.send('truth', { value: false }); assert.equal(s.state.outcomes[1].correct, true);
  const oldId = s.pack.screens[1].screenId;
  s.next(); s.send('continue', { screenId: oldId }); assert.equal(s.state.index, 2);
  assert.equal(Object.keys(s.state.outcomes).length, 1);
});

test('pairs accept either endpoint first, reposition matched counterparts and grade only the final pair', () => {
  const s = session(); s.ready(); s.next(); s.ready(); s.send('truth', { value: true }); s.next();
  const screen = s.pack.screens[2];
  const pairs = screen.answer.pairs;
  s.send('pair', { side: 'left', id: pairs[0].leftId });
  s.send('pair', { side: 'right', id: pairs[1].rightId });
  assert.equal(s.state.matches.length, 0);
  assert.equal(s.state.phase, 'response');
  pairs.forEach((p, i) => {
    s.send('pair', { side: 'right', id: p.rightId }); s.send('pair', { side: 'left', id: p.leftId });
    assert.equal(s.state.matches.length, i + 1);
    assert.equal(s.state.phase, i === 2 ? 'feedback' : 'response');
  });
  assert.equal(s.state.outcomes[2].correct, false, 'a wrong pair counts once in the app local policy');
  assert.deepEqual(s.m.getRightOrder(screen, s.state).map(p => p.id), pairs.map(p => p.rightId));
});

test('the fixed past suffix is never a slot; sentence choice grades immediately', () => {
  const s = session();
  const screen = s.pack.screens[3];
  assert.equal(screen.answer.slots.length, 1);
  assert.equal(screen.scaffold[1], 'ました。');
  let state = { ...s.state, index: 3, phase: 'response', slots: [null], audioReady: true };
  state = s.m.transitionLesson(s.pack, state, { type: 'token', screenId: screen.screenId, id: screen.answer.slots[0].acceptedTokenIds[0] });
  assert.equal(state.phase, 'feedback');
  state = s.m.transitionLesson(s.pack, state, { type: 'continue', screenId: screen.screenId });
  const choice = s.pack.screens[4];
  state = s.m.transitionLesson(s.pack, state, { type: 'audio_ready', screenId: choice.screenId });
  state = s.m.transitionLesson(s.pack, state, { type: 'choice', screenId: choice.screenId, id: choice.answer.acceptedOptionIds[0] });
  assert.equal(state.phase, 'feedback');
});

test('two-gap placement removes tokens, restores bank order and refuses invalid or repeated IDs', () => {
  const s = session(); const screen = s.pack.screens[5];
  let state = { ...s.state, index: 5, phase: 'response', slots: [null, null], audioReady: true };
  const send = (type, extra = {}) => (state = s.m.transitionLesson(s.pack, state, { type, screenId: screen.screenId, ...extra }));
  const ids = screen.answer.slots.map(slot => slot.acceptedTokenIds[0]);
  send('token', { id: ids[0] }); send('token', { id: ids[0] }); send('token', { id: 'invalid' });
  assert.deepEqual(state.slots, [ids[0], null]); assert.equal(state.phase, 'response');
  send('remove_token', { slot: 0 }); assert.deepEqual(state.slots, [null, null]);
  assert.deepEqual(s.m.getTokenBank(screen, state).map(t => t.id), screen.answer.tokens.map(t => t.id));
  send('token', { id: ids[0] }); send('token', { id: ids[1] }); assert.equal(state.phase, 'feedback');
  send('remove_token', { slot: 0 }); assert.deepEqual(state.slots, ids);
  send('continue'); assert.equal(state.phase, 'result');
  send('continue'); assert.equal(state.phase, 'result');
  send('exit'); assert.equal(state.phase, 'exit');
});

test('missing text, malformed answers, absent audio and unsupported runners fail closed', () => {
  const { getLessonSpec, getLessonReadiness, createLessonState, transitionLesson } = modules();
  for (const mutate of [p => p.screens[1].statement = null, p => p.screens[3].answer.slots[0].acceptedTokenIds = ['unknown'], p => p.screens[0].audio.text = null, p => p.screens[0].renderer = 'unknown']) {
    const spec = structuredClone(getLessonSpec('B2.C01.L01')); mutate(spec.contentPack);
    assert.equal(getLessonReadiness(spec).scoredLaunchReady, false);
    const state = createLessonState(spec.contentPack);
    assert.equal(transitionLesson(spec.contentPack, state, { type: 'start' }).phase, 'launch');
    const preview = transitionLesson(spec.contentPack, state, { type: 'start_preview' });
    assert.equal(preview.preview, true);
    assert.equal(preview.completionEligible, false);
  }
});

test('support is occurrence-specific and no explanation or correction leaks before feedback', () => {
  const { getLessonSpec, getVisibleSupport } = modules();
  const pack = getLessonSpec('B2.C01.L01').contentPack;
  for (const screen of pack.screens) {
    const before = getVisibleSupport(screen, 'response');
    assert.ok(before.every(b => b.kind !== 'explanation'));
    if (screen.screenId.endsWith('S04') || screen.screenId.endsWith('S05') || screen.screenId.endsWith('S06')) assert.ok(before.every(b => b.kind !== 'translation'));
    const after = getVisibleSupport(screen, 'feedback');
    assert.deepEqual(after, [...screen.support.before, ...screen.support.after]);
  }
});

test('one full correct attempt yields a local 100% result; previews and exits never award completion', () => {
  const s = session();
  for (const screen of s.pack.screens) {
    s.ready();
    const answer = screen.answer;
    if (answer?.kind === 'truth') s.send('truth', { value: answer.accepted });
    if (answer?.kind === 'choice') s.send('choice', { id: answer.acceptedOptionIds[0] });
    if (answer?.kind === 'ordered_slots') for (const slot of answer.slots) s.send('token', { id: slot.acceptedTokenIds[0] });
    if (answer?.kind === 'pairs') for (const pair of answer.pairs) { s.send('pair', { side: 'left', id: pair.leftId }); s.send('pair', { side: 'right', id: pair.rightId }); }
    s.next();
  }
  assert.deepEqual(s.m.getLessonResult(s.pack, s.state), { correct: 5, graded: 5, percent: 100, completionEligible: true });
  assert.equal(s.state.completionEligible, true);
  let preview = s.m.transitionLesson(s.pack, s.m.createLessonState(s.pack), { type: 'start_preview' });
  for (const screen of s.pack.screens) preview = s.m.transitionLesson(s.pack, preview, { type: 'preview_skip', screenId: screen.screenId });
  assert.equal(s.m.getLessonResult(s.pack, preview).percent, null);
  assert.equal(preview.completionEligible, false);
  s.send('exit'); assert.equal(s.m.getLessonResult(s.pack, s.state).completionEligible, false);
});

test('wrong completed gaps and sentence choices lock once and show one local incorrect outcome', () => {
  const s = session(); const screen = s.pack.screens[5];
  let state = { ...s.state, index: 5, phase: 'response', slots: [null, null], audioReady: true };
  const send = (type, extra = {}) => state = s.m.transitionLesson(s.pack, state, { type, screenId: screen.screenId, ...extra });
  send('token', { id: 'token-1' }); assert.equal(state.phase, 'response');
  send('token', { id: 'token-4' }); assert.equal(state.phase, 'feedback');
  assert.equal(state.outcomes[5].correct, false);
  send('remove_token', { slot: 1 }); assert.deepEqual(state.slots, ['token-1', 'token-4']);
  send('token', { id: 'token-2' }); assert.equal(Object.keys(state.outcomes).length, 1);
  const choice = s.pack.screens[4]; state = { ...s.state, index: 4, phase: 'response', audioReady: true };
  state = s.m.transitionLesson(s.pack, state, { type: 'choice', screenId: choice.screenId, id: 'choice-1' });
  state = s.m.transitionLesson(s.pack, state, { type: 'choice', screenId: choice.screenId, id: 'choice-2' });
  assert.equal(state.outcomes[4].correct, false);
});

test('readiness independently reports text, required audio, visuals and runner capability', () => {
  const { getLessonSpec, getLessonReadiness } = modules(); const spec = getLessonSpec('B2.C01.L01');
  const noAudio = getLessonReadiness(spec, { audioAdapterAvailable: false, runnerEnabled: true });
  assert.equal(noAudio.textAnswers.complete, true); assert.equal(noAudio.runnerAvailable, true);
  assert.equal(noAudio.audio.ready, false); assert.equal(noAudio.scoredLaunchReady, false);
  const noRunner = getLessonReadiness(spec, { audioAdapterAvailable: true, runnerEnabled: false });
  assert.equal(noRunner.audio.ready, true); assert.equal(noRunner.runnerAvailable, false);
  assert.equal(noRunner.scoredLaunchReady, false);
  assert.ok(getLessonReadiness(spec).media.gaps.every(g => ['video', 'image'].includes(g.field)));
});

test('the shared engine accepts canonical screens across consecutive activities', () => {
  const { getLessonSpec, createLessonState, transitionLesson } = modules();
  const pack = structuredClone(getLessonSpec('B2.C01.L01').contentPack);
  // Test-only variant, never written into production content.
  pack.status = 'development_preview'; pack.baseScreenCount = 2; pack.screens = pack.screens.slice(0, 2);
  pack.screens[1].screenId = 'B2.C01.L01.A02.S01';
  let state = transitionLesson(pack, createLessonState(pack), { type: 'start_preview' });
  assert.equal(state.phase, 'presentation');
  state = transitionLesson(pack, state, { type: 'preview_skip', screenId: pack.screens[0].screenId });
  assert.equal(state.index, 1); assert.equal(state.phase, 'response');
});
