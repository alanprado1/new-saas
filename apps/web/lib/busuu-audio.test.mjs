import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppModule } from './test-loader.mjs';

function setup(fetcher, timeoutMs) {
  const { CourseAudioAdapter } = loadAppModule('lib/busuu/audio.ts');
  const players = [], states = [];
  const adapter = new CourseAudioAdapter(fetcher, src => {
    const player = { src, playbackRate: 1, paused: false, onended: null, onerror: null, play: async () => {}, pause() { this.paused = true; }, removeAttribute() {} };
    players.push(player); return player;
  }, state => states.push(state), timeoutMs);
  adapter.setAccount('account-a'); adapter.setScreen('S01');
  const item = { text: '私は山口ともうします。', provider: 'edge', voice: 'ja-JP-NanamiNeural', speed: 1 };
  return { adapter, players, states, item };
}
const response = () => ({ ok: true, json: async () => ({ audioBase64: 'YWJj' }) });

test('course audio uses existing Japanese endpoint options, caches and replays without regenerating', async () => {
  const calls = []; const s = setup(async (...args) => { calls.push(args); return response(); });
  assert.equal(await s.adapter.play(s.item), true);
  assert.equal(await s.adapter.play({ ...s.item, speed: 0.75 }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/api/tts');
  assert.deepEqual(JSON.parse(calls[0][1].body), { text: s.item.text, provider: 'edge', voice: s.item.voice, targetLanguage: 'ja', learningDirection: 'en-ja' });
  assert.equal(s.players[1].playbackRate, 0.75);
  assert.equal(s.players[0].paused, true);
  await s.adapter.play({ ...s.item, voice: 'ja-JP-KeitaNeural' }); assert.equal(calls.length, 2);
});

test('repeated play while loading deduplicates; stale responses cannot play or update/cache a new screen', async () => {
  let resolve; let calls = 0; let signal;
  const s = setup((_url, init) => { calls++; signal = init.signal; return new Promise(done => resolve = done); });
  const first = s.adapter.play(s.item); const second = s.adapter.play(s.item);
  assert.equal(calls, 1);
  s.adapter.setScreen('S02'); const count = s.states.length;
  assert.equal(signal.aborted, true); resolve(response());
  assert.equal(await first, false); assert.equal(await second, false);
  assert.equal(s.players.length, 0); assert.equal(s.states.length, count);
});

test('account change and exit stop playback, abort requests and clear account-owned cache', async () => {
  let calls = 0; const s = setup(async () => { calls++; return response(); });
  await s.adapter.play(s.item); s.adapter.setAccount('account-b');
  assert.equal(s.players[0].paused, true);
  await s.adapter.play(s.item); assert.equal(calls, 2);
  s.adapter.dispose(); assert.equal(s.players[1].paused, true);
  assert.equal(await s.adapter.play(s.item), false);
});

test('loading and endpoint/playback failures are recoverable, invalid audio is never cached', async () => {
  let calls = 0; const s = setup(async () => ++calls === 1 ? { ok: false, status: 500 } : response());
  assert.equal(await s.adapter.play(s.item), false);
  assert.equal(s.states.at(-1).status, 'error');
  assert.equal(await s.adapter.play(s.item), true);
  assert.ok(s.states.some(state => state.status === 'loading'));
  s.players.at(-1).onerror(); assert.equal(s.states.at(-1).status, 'error');
  const empty = setup(async () => ({ ok: true, json: async () => ({ audioBase64: '' }) }));
  assert.equal(await empty.adapter.play(empty.item), false);
  assert.equal(empty.players.length, 0);
});

test('late account responses and retired player callbacks cannot change the new account audio state', async () => {
  let resolve;
  const s = setup(() => new Promise(done => resolve = done));
  const pending = s.adapter.play(s.item);
  s.adapter.setAccount('account-b'); const states = s.states.length;
  resolve(response()); assert.equal(await pending, false);
  assert.equal(s.players.length, 0); assert.equal(s.states.length, states);
  const played = setup(async () => response());
  await played.adapter.play(played.item);
  const end = played.players[0].onended, error = played.players[0].onerror;
  played.adapter.setScreen('S02'); const count = played.states.length;
  end(); error(); assert.equal(played.states.length, count);
});

test('the adapter accepts VoiceVox and explicit readings while ignoring non-Japanese saved Edge voices', async () => {
  const calls = []; const s = setup(async (...args) => { calls.push(args); return response(); });
  await s.adapter.play({ ...s.item, provider: 'voicevox', voice: 1, reading: 'わたくし' });
  assert.equal(JSON.parse(calls[0][1].body).reading, 'わたくし');
  assert.match(s.players[0].src, /^data:audio\/wav/);
  const { readCourseAudioPreferences } = loadAppModule('lib/busuu/audio.ts');
  assert.equal(readCourseAudioPreferences({ getItem: key => key === 'pref_edgeVoice' ? 'en-US-AriaNeural' : null }).edgeVoice, 'ja-JP-NanamiNeural');
});

test('a stalled synthesis request becomes a recoverable timeout instead of loading forever', { timeout: 200 }, async () => {
  const s = setup((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))), 10);
  assert.equal(await s.adapter.play(s.item), false);
  assert.equal(s.states.at(-1).status, 'error');
  assert.match(s.states.at(-1).message, /too long/);
});

const words = ['参る', 'お墓参り', '参加'].map(text => ({ text, provider: 'edge', voice: 'ja-JP-NanamiNeural', speed: 1 }));
const tick = ms => new Promise(resolve => setTimeout(resolve, ms));

test('a word sequence plays one clip per word, waits the gap between clips, stays playing through gaps and completes after the last clip', async () => {
  const requests = [], s = setup(async (_url, init) => { requests.push(JSON.parse(init.body).text); return response(); });
  let done = null;
  const pending = s.adapter.playSequence(words, 60).then(ok => { done = ok; return ok; });
  await tick(5); assert.equal(s.players.length, 1);
  s.players[0].onended(); await tick(5);
  assert.equal(s.players.length, 1, 'the next word has not started inside the gap');
  assert.equal(s.states.at(-1).status, 'playing', 'state stays playing during the gap');
  await tick(80); assert.equal(s.players.length, 2, 'the next word starts after the gap');
  s.players[1].onended(); await tick(5); assert.equal(s.players.length, 2);
  await tick(80); assert.equal(s.players.length, 3);
  assert.equal(done, null);
  s.players[2].onended();
  assert.equal(await pending, true);
  assert.deepEqual(requests, ['参る', 'お墓参り', '参加']);
  const statuses = s.states.map(st => st.status), first = statuses.indexOf('loading');
  assert.deepEqual(statuses.slice(first, -1).filter(x => x === 'idle'), [], 'no idle flicker between words');
  assert.equal(s.states.at(-1).status, 'idle');
  s.adapter.dispose();
});

test('cancel (and a screen change) during the gap stops the rest of the word sequence', async () => {
  for (const stop of ['cancel', 'screen']) {
    const s = setup(async () => response());
    const pending = s.adapter.playSequence(words, 50);
    await tick(5); s.players[0].onended(); await tick(5);
    if (stop === 'cancel') s.adapter.cancel(); else s.adapter.setScreen('S02');
    assert.equal(await pending, false);
    await tick(90); assert.equal(s.players.length, 1, 'no later word plays after the gap would have ended');
    assert.equal(s.states.at(-1).status, 'idle');
    s.adapter.dispose();
  }
});

test('a gap of zero plays the next clip straight after the previous one', async () => {
  const s = setup(async () => response());
  const pending = s.adapter.playSequence(words.slice(0, 2), 0);
  await tick(5); s.players[0].onended(); await tick(5);
  assert.equal(s.players.length, 2); s.players[1].onended();
  assert.equal(await pending, true); s.adapter.dispose();
});
