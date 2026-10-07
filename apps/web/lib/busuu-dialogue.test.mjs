import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCourseModule } from './busuu-test-helpers.mjs';
const settings = { provider: 'edge', voice: 'ja-JP-NanamiNeural', speed: 0.75 };
const turns = [{ text: 'こんにちは。', ...settings }, { text: 'どうぞ。', ...settings, voice: 'ja-JP-KeitaNeural' }];
function setup() {
  const players = [], requests = [];
  const { CourseAudioAdapter } = loadCourseModule('lib/busuu/audio.ts');
  const adapter = new CourseAudioAdapter(async (_url, init) => { requests.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ audioBase64: 'AAAA' }) }; }, () => {
    const p = { play: async () => {}, pause() {}, removeAttribute() {}, onended: null, onerror: null }; players.push(p); return p;
  }, () => {});
  adapter.setAccount('owner'); adapter.setScreen('scene');
  return { adapter, players, requests };
}
const tick = () => new Promise(setImmediate);
test('dialogue waits for each speaker turn, keeps TTS voices/speed and completes only after the last turn', async () => {
  const h = setup(); let complete = false;
  const pending = h.adapter.playDialogue(turns).then(result => { complete = result; return result; });
  await tick(); assert.equal(h.players.length, 1); assert.equal(complete, false);
  assert.equal(h.players[0].playbackRate, 0.75);
  h.players[0].onended(); await tick(); assert.equal(h.players.length, 2); assert.equal(complete, false);
  assert.equal(h.requests[1].voice, 'ja-JP-KeitaNeural');
  h.players[1].onended(); assert.equal(await pending, true); h.adapter.dispose();
});
test('cancel, screen/account changes and turn errors retire dialogue without playing the next turn', async () => {
  for (const retire of ['cancel', 'screen', 'account', 'error']) {
    const h = setup(), pending = h.adapter.playDialogue(turns);
    await tick(); const stale = h.players[0].onended;
    if (retire === 'cancel') h.adapter.cancel();
    if (retire === 'screen') h.adapter.setScreen('other');
    if (retire === 'account') h.adapter.setAccount('other');
    if (retire === 'error') h.players[0].onerror();
    assert.equal(await pending, false); stale(); await tick(); assert.equal(h.players.length, 1);
    h.adapter.dispose();
  }
});
test('retired callbacks from an ended dialogue turn cannot finish or cancel the next speaker', async () => {
  const h = setup(); let complete = false;
  const pending = h.adapter.playDialogue(turns).then(ok => { complete = ok; return ok; });
  await tick(); const oldEnded = h.players[0].onended, oldError = h.players[0].onerror;
  oldEnded(); await tick();
  oldEnded(); await tick(); assert.equal(complete, false);
  oldError(); await tick(); assert.equal(complete, false);
  h.players[1].onended(); assert.equal(await pending, true); h.adapter.dispose();
});
