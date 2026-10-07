import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCourseModule } from './busuu-test-helpers.mjs';

const pack = loadCourseModule('lib/busuu/inventory.ts').getLessonSpec('B2.C01.L01').contentPack;
const get = () => loadCourseModule('lib/busuu/attempt.ts');
test('server rejects scores, fabricated IDs, invalid order and preview/exit actions', () => {
  const m = get();
  const state = m.initialAttemptState(pack);
  const id = pack.screens[0].screenId;
  for (const action of [
    { type: 'truth', screenId: id, value: true },
    { type: 'audio_ready', screenId: id, correct: true }, { type: 'start_preview' },
    { type: 'exit' }, { type: 'audio_ready', screenId: 'invented' },
    { type: 'pair', screenId: id, side: 'invented', id: 'invented' },
  ]) assert.throws(() => m.evaluateAction(pack, state, action));
});
test('server replay grades wrong answers and preserves partial matching and token removal', () => {
  const m = get(); let state = m.initialAttemptState(pack);
  const send = (type, fields = {}) => {
    if (type === 'audio_ready' && state.audioReady) return state;
    return state = m.evaluateAction(pack, state, { type, screenId: pack.screens[state.index].screenId, ...fields });
  };
  const next = () => { if (!state.audioReady) send('audio_ready'); send('continue'); };
  next(); send('audio_ready'); send('truth', { value: false });
  assert.equal(state.outcomes[1].correct, false); next(); send('audio_ready');
  const pairs = pack.screens[2].answer.pairs;
  send('pair', { side: 'left', id: pairs[0].leftId });
  assert.equal(state.endpoint.id, pairs[0].leftId);
  send('pair', { side: 'right', id: pairs[1].rightId });
  assert.equal(state.pairMistake, true);
  for (const pair of pairs) { send('pair', { side: 'right', id: pair.rightId }); send('pair', { side: 'left', id: pair.leftId }); }
  assert.equal(state.outcomes[2].correct, false); next(); send('audio_ready');
  send('token', { id: pack.screens[3].answer.slots[0].acceptedTokenIds[0] }); next(); send('audio_ready');
  send('choice', { id: pack.screens[4].answer.acceptedOptionIds[0] }); next(); send('audio_ready');
  const token = pack.screens[5].answer.slots[0].acceptedTokenIds[0];
  send('token', { id: token }); assert.deepEqual(state.slots, [token, null]);
  send('remove_token', { slot: 0 }); assert.deepEqual(state.slots, [null, null]);
  send('token', { id: token }); send('token', { id: pack.screens[5].answer.slots[1].acceptedTokenIds[0] });
  assert.equal(m.attemptResult(pack, state).completionEligible, false); next();
  assert.equal(m.attemptResult(pack, state).completionEligible, true);
  assert.equal(m.attemptResult(pack, state).percent, 60);
  assert.throws(() => send('continue'));
});
test('content version and fingerprint must match the saved attempt', () => {
  const m = get(); const hash = 'a'.repeat(64);
  const saved = { record_id: pack.recordId, content_version: pack.contentVersion, content_hash: hash };
  m.assertAttemptPack(saved, pack, hash);
  for (const changed of [ { content_version: '999' }, { content_hash: 'b'.repeat(64) }, { record_id: 'B2.C01.L02' } ]) {
    assert.throws(() => m.assertAttemptPack({ ...saved, ...changed }, pack, hash), /version/i);
  }
});
