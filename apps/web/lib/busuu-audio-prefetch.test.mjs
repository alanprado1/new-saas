import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { loadCourseModule } from './busuu-test-helpers.mjs';

const get = f => loadCourseModule(`lib/busuu/${f}.ts`);
const tick = (n = 5) => new Promise(resolve => { let i = 0; const go = () => (++i >= n ? resolve() : setTimeout(go, 0)); go(); });
const edge = { provider: 'edge', edgeVoice: 'ja-JP-AoiNeural', voiceVoxId: 3 };
const vox = { provider: 'voicevox', edgeVoice: 'ja-JP-AoiNeural', voiceVoxId: 3 };

const screen = (n, extra) => ({ screenId: `B2.C03.L02.A01.S0${n}`, renderer: 'model', prompt: 'p', answer: null, praise: null, support: { before: [], after: [] },
  audio: { required: false, text: null }, visual: 'none', evidence: [], unresolved: [], ...extra });
const dialogueScreen = (n, extra = {}) => screen(n, { renderer: 'dialogue', dialogue: { speakers: ['guest', 'staff'], japaneseVisible: false, turns: [
  { id: 't1', speaker: 'guest', japanese: '予約しました。', reading: 'よやくしました', english: null },
  { id: 't2', speaker: 'staff', japanese: 'お待ちしておりました。', reading: null, english: null }] }, audio: { required: true, text: null }, ...extra });
const fixturePack = (retry = true) => ({ schemaVersion: '1.0', contentVersion: '1.0.0', recordId: 'B2.C03.L02', status: 'reviewed', baseScreenCount: 6,
  ...(retry ? { retryPolicy: { kind: 'end_once', screenIds: ['B2.C03.L02.A01.S02'] } } : {}), screens: [
    dialogueScreen(1),
    screen(2, { renderer: 'truth', truthMode: 'audio_only', answer: { kind: 'truth', accepted: true }, sourceContract: { transcriptBeforeAnswer: false },
      audio: { required: true, text: '早く着きました。', reading: 'はやくつきました', feedbackText: '早く着きました。' } }),
    screen(3, { renderer: 'choice', sourceContract: { sceneReuse: 'B2.C03.L02.A01.S01' }, audio: { required: true, text: null } }),
    screen(4, { renderer: 'choice', audio: { required: false, text: '聞かないでください。', beforeAnswer: false, feedbackText: '正しい文です。' } }),
    screen(5, { renderer: 'choice', sceneContext: { recordId: 'x', contentVersion: '1.0.0', screenId: 'x', fact: 'f' }, audio: { required: false, text: '隠れた文です。', feedbackText: '隠れた答えです。' } }),
    screen(6, { renderer: 'table', audio: { required: false, text: null } }),
  ] });
const texts = items => items.map(i => i.text);

test('lesson plan enumerates dialogue turns, scene replay once, feedback audio, retry-safe, and skips silent screens', () => {
  const { planLessonClips, planLessonPrefetch } = get('audio-plan');
  const pack = fixturePack();
  const clips = planLessonClips(pack, edge, 1);
  assert.deepEqual(clips.map(c => [c.screenId.slice(-2), c.role, c.item.text]), [
    ['01', 'source', '予約しました。'], ['01', 'source', 'お待ちしておりました。'],
    ['02', 'source', '早く着きました。'], ['02', 'feedback', '早く着きました。'], // feedback is requested without the reading, so it is its own clip
    ['04', 'feedback', '正しい文です。'], // beforeAnswer:false plays no source audio but keeps corrected-sentence feedback
  ]);
  // dialogue voices follow playback: guest uses the selected voice, staff the fixed staff voice; readings travel with the clip
  assert.deepEqual(clips.slice(0, 2).map(c => [c.item.voice, c.item.reading]), [['ja-JP-AoiNeural', 'よやくしました'], ['ja-JP-KeitaNeural', null]]);
  assert.equal(clips[2].item.reading, 'はやくつきました');
  // screen 3 reuses the scene (Replay scene) and screen 5 is a delayed scene question: neither adds a clip or leaks hidden text
  assert.ok(!texts(clips.map(c => c.item)).some(t => t.includes('隠れた')));
  // retry policy replays base screens only, so the plan is identical with or without retry
  assert.deepEqual(planLessonPrefetch(fixturePack(false), edge, 1), planLessonPrefetch(pack, edge, 1));
  // provider/voice/speed are applied exactly as playback does
  const voxClips = planLessonPrefetch(pack, vox, 0.75);
  assert.ok(voxClips.every(i => i.provider === 'voicevox' && i.voice === 3 && i.speed === 0.75));
  assert.equal(voxClips.length, 5);
});

test('plan matches the playback request for every screen, source and feedback, and prefetch starts at the current screen', () => {
  const { getScreenPlayback, planLessonPrefetch } = get('audio-plan');
  const pack = fixturePack();
  const scene = getScreenPlayback(pack, pack.screens[2], edge, 1);
  assert.equal(scene.kind, 'dialogue'); assert.deepEqual(texts(scene.items), ['予約しました。', 'お待ちしておりました。']);
  assert.equal(getScreenPlayback(pack, pack.screens[3], edge, 1), null);
  assert.equal(getScreenPlayback(pack, pack.screens[3], edge, 1, true).item.text, '正しい文です。');
  assert.equal(getScreenPlayback(pack, pack.screens[4], edge, 1), null);
  assert.equal(getScreenPlayback(pack, pack.screens[4], edge, 1, true), null);
  assert.deepEqual(texts(planLessonPrefetch(pack, edge, 1, 1)), ['早く着きました。', '早く着きました。', '予約しました。', 'お待ちしておりました。', '正しい文です。']);
  assert.deepEqual(texts(planLessonPrefetch(pack, edge, 1, 3)), ['正しい文です。', '予約しました。', 'お待ちしておりました。', '早く着きました。', '早く着きました。']);
});

test('every registered pack plans only non-empty clips that equal what its screens play', () => {
  const { getScreenPlayback, planLessonClips, playbackItems } = get('audio-plan');
  let total = 0;
  for (const name of fs.readdirSync(new URL('../content/busuu/', import.meta.url)).filter(n => /^b2-.*\.json$/.test(n))) {
    const pack = JSON.parse(fs.readFileSync(new URL(`../content/busuu/${name}`, import.meta.url)));
    if (!Array.isArray(pack.screens)) continue;
    const planned = planLessonClips(pack, vox, 1), plannedKeys = new Set(planned.map(c => JSON.stringify([c.item.reading ?? '', c.item.text])));
    for (const s of pack.screens) for (const feedback of [false, true]) {
      const playback = getScreenPlayback(pack, s, vox, 1, feedback);
      for (const item of playback ? playbackItems(playback) : []) assert.ok(plannedKeys.has(JSON.stringify([item.reading ?? '', item.text])));
    }
    assert.ok(planned.every(c => c.item.text.trim()));
    total += planned.length;
  }
  assert.ok(total > 500);
});

// ---- cache layer -------------------------------------------------------------------------------------------------------------
const b64 = text => Buffer.from(text).toString('base64');
function fakeCaches() {
  const entries = new Map();
  const cache = {
    async match(url) { const e = entries.get(url); return e && new Response(e.bytes, { headers: e.headers }); },
    async put(url, response) { entries.set(url, { bytes: new Uint8Array(await response.arrayBuffer()), headers: [...response.headers] }); },
    async delete(url) { return entries.delete(url); },
    async keys() { return [...entries.keys()].map(url => ({ url })); },
  };
  return { entries, storage: { opened: [], async open(name) { this.opened.push(name); return cache; } } };
}
const item = { text: '予約しました。', reading: 'よやくしました', provider: 'edge', voice: 'ja-JP-NanamiNeural', speed: 1 };

test('clip keys are SHA-256 hashes that change with account, provider, voice, reading and text but not playback speed', async () => {
  const { clipCacheKey } = get('audio-cache');
  const base = await clipCacheKey('acct', item);
  assert.match(base, /^[0-9a-f]{64}$/);
  assert.equal(await clipCacheKey('acct', { ...item }), base);
  assert.equal(await clipCacheKey('acct', { ...item, speed: 0.75 }), base); // speed is client-side playbackRate, never sent to /api/tts
  for (const change of [{ voice: 'ja-JP-KeitaNeural' }, { provider: 'voicevox', voice: 1 }, { reading: undefined }, { text: '予約しました' }])
    assert.notEqual(await clipCacheKey('acct', { ...item, ...change }), base);
  assert.notEqual(await clipCacheKey('other', item), base);
  assert.notEqual(await clipCacheKey('acct', { ...item, provider: 'voicevox', voice: 1 }), await clipCacheKey('acct', { ...item, provider: 'voicevox', voice: 2 }));
});

test('Cache API store hits, misses, never stores empty/invalid audio, uses hash-only URLs and expires', async () => {
  const { createCacheApiClipStore, CLIP_CACHE_NAME, CLIP_CACHE_LIMITS } = get('audio-cache'), { clipCacheKey } = get('audio-cache');
  const fake = fakeCaches(); let clock = 1_000_000;
  const store = createCacheApiClipStore(fake.storage, () => clock);
  const hash = await clipCacheKey('private-account-id', item);
  assert.equal(await store.get(hash), null); assert.equal(await store.has(hash), false);
  assert.equal(await store.put(hash, b64('audio-bytes')), true);
  assert.equal(await store.get(hash), b64('audio-bytes')); assert.equal(await store.has(hash), true);
  assert.deepEqual(fake.storage.opened.every(n => n === CLIP_CACHE_NAME), true);
  for (const bad of ['', 'not base64!', '====', null, undefined, 42]) assert.equal(await store.put(await clipCacheKey('x', { ...item, text: String(bad) }), bad), false);
  assert.equal(await store.put(hash + 'a', 'A'.repeat(CLIP_CACHE_LIMITS.maxClipBase64 + 4)), false);
  assert.equal(fake.entries.size, 1);
  const urls = [...fake.entries.keys()].join('\n');
  assert.ok(!/予約|よやく|private-account-id|NanamiNeural|edge/.test(urls)); assert.ok(urls.includes(hash)); assert.ok(/^https:\/\//.test(urls));
  clock += CLIP_CACHE_LIMITS.maxAgeMs + 1; // age bound
  assert.equal(await store.has(hash), false); assert.equal(await store.get(hash), null); assert.equal(fake.entries.size, 0);
});

test('prune enforces entry, byte and age bounds oldest first, and failures stay silent', async () => {
  const { createCacheApiClipStore, CLIP_CACHE_LIMITS } = get('audio-cache');
  const fake = fakeCaches(); let clock = 5_000_000;
  const store = createCacheApiClipStore(fake.storage, () => clock, { ...CLIP_CACHE_LIMITS, maxEntries: 3, maxBytes: 1_000, pruneEvery: 1000 });
  for (const name of ['a', 'b', 'c', 'd', 'e']) { clock += 10; await store.put(name.repeat(64), b64(name.repeat(10))); }
  await store.prune();
  assert.deepEqual([...fake.entries.keys()].map(u => u.at(-1)), ['c', 'd', 'e']);
  const small = createCacheApiClipStore(fake.storage, () => clock, { ...CLIP_CACHE_LIMITS, maxEntries: 10, maxBytes: 20, pruneEvery: 1000 });
  await small.prune(); assert.deepEqual([...fake.entries.keys()].map(u => u.at(-1)), ['d', 'e']);
  const broken = createCacheApiClipStore({ open: async () => { throw new Error('quota'); } });
  assert.equal(await broken.put('f'.repeat(64), b64('x')), false); assert.equal(await broken.get('f'.repeat(64)), null); await broken.prune();
});

// ---- adapter: prefetch + playback --------------------------------------------------------------------------------------------
function memoryStore() {
  const map = new Map(), log = [];
  return { map, log, async get(h) { return map.get(h) ?? null; }, async has(h) { return map.has(h); }, async put(h, v) { log.push(h); map.set(h, v); return true; },
    async delete(h) { map.delete(h); }, async prune() { log.push('prune'); } };
}
function rig(store, fetchImpl, concurrency = 2, autoEnd = false) {
  const { CourseAudioAdapter } = get('audio'), calls = [], states = [], players = [];
  const fetcher = (url, init) => { const body = JSON.parse(init.body); calls.push(body); return fetchImpl(body, init); };
  const adapter = new CourseAudioAdapter(fetcher, src => { const p = { src, playbackRate: 1, onended: null, onerror: null, play: async () => { if (autoEnd) setTimeout(() => p.onended?.(), 0); }, pause() {}, removeAttribute() {} }; players.push(p); return p; },
    s => states.push(s), undefined, store, concurrency);
  adapter.setAccount('acct'); adapter.setScreen('S01'); states.length = 0;
  return { adapter, calls, states, players };
}
const ok = body => ({ ok: true, status: 200, json: async () => ({ audioBase64: b64(`clip:${body.text}`) }) });
const hang = (_body, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
const items = n => Array.from({ length: n }, (_, i) => ({ ...item, text: `文${i}`, reading: undefined }));

test('prefetch fetches in order with bounded concurrency, persists clips silently, and playback then needs no request', async () => {
  const store = memoryStore(); let inFlight = 0, max = 0; const resolvers = [];
  const r = rig(store, body => { inFlight++; max = Math.max(max, inFlight); return new Promise(done => resolvers.push(() => { inFlight--; done(ok(body)); })); });
  const plan = items(5);
  r.adapter.prefetch(plan); await tick();
  assert.deepEqual(r.calls.map(c => c.text).sort(), ['文0', '文1']); assert.equal(store.log[0], 'prune'); // only two in flight, head of the queue first
  while (resolvers.length) { resolvers.shift()(); await tick(); }
  assert.deepEqual(r.calls.map(c => c.text).slice(2), ['文2', '文3', '文4']);
  assert.equal(max, 2); assert.equal(store.map.size, 5);
  assert.equal(r.states.length, 0); // prefetch never touches playback/UI state
  assert.equal(await r.adapter.play(plan[3]), true);
  assert.equal(r.calls.length, 5); assert.match(r.players[0].src, new RegExp(b64('clip:文3').slice(0, 20)));
  assert.equal(JSON.stringify(r.calls.find(c => c.text === '文0')), JSON.stringify({ text: '文0', provider: 'edge', voice: 'ja-JP-NanamiNeural', targetLanguage: 'ja', learningDirection: 'en-ja' }));
});

test('a reload (new adapter, same persistent store) reuses clips for prefetch and playback; a voice change refetches', async () => {
  const store = memoryStore(), plan = items(3);
  const first = rig(store, async body => ok(body)); first.adapter.prefetch(plan); await tick(20);
  assert.equal(first.calls.length, 3);
  const reload = rig(store, async body => ok(body)); reload.adapter.prefetch(plan); await tick(20);
  assert.equal(reload.calls.length, 0);
  assert.equal(await reload.adapter.play({ ...plan[1], speed: 0.75 }), true); assert.equal(reload.calls.length, 0);
  assert.equal(reload.players[0].playbackRate, 0.75);
  assert.equal(await reload.adapter.play({ ...plan[1], voice: 'ja-JP-KeitaNeural' }), true); assert.equal(reload.calls.length, 1);
  reload.adapter.prefetch(plan.map(p => ({ ...p, provider: 'voicevox', voice: 3 }))); await tick(20);
  assert.equal(reload.calls.length, 4);
  assert.equal(store.map.size, 7);
});

test('playback joins a running prefetch of the same clip instead of duplicating it, and persists clips fetched during play', async () => {
  const store = memoryStore(); let release;
  const r = rig(store, body => new Promise(done => { release = () => done(ok(body)); }));
  const plan = items(1);
  r.adapter.prefetch(plan); await tick();
  const playing = r.adapter.play(plan[0]); await tick();
  assert.equal(r.calls.length, 1); release(); assert.equal(await playing, true);
  assert.equal(r.calls.length, 1); assert.equal(r.players.length, 1);
  const noPrefetch = rig(memoryStore(), async body => ok(body));
  await noPrefetch.adapter.play(plan[0]); await tick();
  assert.equal(noPrefetch.calls.length, 1);
  const again = rig(noPrefetch.adapter.store, async body => ok(body)); // same persistent store, fresh memory
  await again.adapter.play(plan[0]); assert.equal(again.calls.length, 0);
});

test('prefetch failures, empty audio and offline are silent, uncached and bounded; playback still falls back to the network', async () => {
  const store = memoryStore(); let mode = 'empty';
  const r = rig(store, async body => {
    if (mode === 'offline') throw new TypeError('Failed to fetch');
    if (mode === 'error') return { ok: false, status: 500, json: async () => ({}) };
    if (mode === 'empty') return { ok: true, status: 200, json: async () => ({ audioBase64: '' }) };
    return ok(body);
  });
  const plan = items(2);
  for (const m of ['empty', 'offline', 'error']) { mode = m; r.adapter.prefetch(plan); await tick(20); }
  assert.equal(store.map.size, 0); assert.equal(r.states.length, 0);
  const before = r.calls.length; r.adapter.prefetch(plan); await tick(20);
  assert.equal(r.calls.length, before); // items that failed twice are not retried every screen
  mode = 'good'; assert.equal(await r.adapter.play(plan[0]), true); await tick();
  assert.equal(store.map.size, 1);
});

test('without a persistent store prefetch is a no-op, and account change or dispose stops background requests', async () => {
  const none = rig(null, async body => ok(body)); none.adapter.prefetch(items(3)); await tick(10); assert.equal(none.calls.length, 0);
  const store = memoryStore(); const signals = [];
  const r = rig(store, (body, init) => { signals.push(init.signal); return hang(body, init); });
  r.adapter.prefetch(items(4)); await tick();
  assert.equal(signals.length, 2);
  r.adapter.setAccount('other'); assert.ok(signals.every(s => s.aborted));
  r.adapter.prefetch(items(1)); await tick(); assert.equal(signals.length, 3);
  r.adapter.dispose(); assert.equal(signals[2].aborted, true); r.adapter.prefetch(items(1)); await tick(); assert.equal(signals.length, 3);
});

test('a clip the player rejects is removed from the persistent cache', async () => {
  const store = memoryStore(), plan = items(1);
  const r = rig(store, async body => ok(body)); r.adapter.prefetch(plan); await tick(20);
  assert.equal(store.map.size, 1);
  await r.adapter.play(plan[0]); r.players[0].onerror(); await tick(10);
  assert.equal(store.map.size, 0);
});

// ---- component handler ---------------------------------------------------------------------------------------------------------
test('the actual Replay handler plays prefetched clips from the cache without a network request and keeps required-playback gating', async () => {
  const registry = loadCourseModule('lib/busuu/content-registry.ts'), { planLessonPrefetch } = get('audio-plan');
  const pack = registry.getContentPack('B2.C05.L04'), first = pack.screens.findIndex(s => s.renderer === 'dialogue');
  const one = { ...pack, screens: [pack.screens[first]], baseScreenCount: 1 };
  const store = memoryStore();
  const r = rig(store, async body => ok(body), 2, true);
  r.adapter.prefetch(planLessonPrefetch(one, edge, 1, 0)); await tick(40);
  const fetched = r.calls.length; assert.ok(fetched >= 2); assert.equal(r.players.length, 0);
  const state = { phase: 'presentation', index: 0, preview: true, audioReady: false, visited: [], outcomes: {}, slots: [], matches: [] };
  const dispatched = []; let count = 0, effects = 0;
  const Runner = loadCourseModule('components/busuu/LessonRunner.tsx', { react: { ...React,
    useState(initial) { count++; return [count === 1 ? state : count === 6 ? true : count === 4 ? edge : typeof initial === 'function' ? initial() : initial, fn => { if (typeof fn === 'function') dispatched.push(fn(state)); }]; },
    useRef(initial) { return { current: initial === null ? r.adapter : initial }; }, useCallback(fn) { return fn; }, useEffect() { effects++; } } }).default;
  const tree = Runner({ pack: one, preview: true, title: 'Scene', returnHref: '/busuu/B2', onExit() {} });
  const walk = (v, out = []) => { if (!v || typeof v !== 'object') return out; out.push(v); for (const c of [v.props?.children].flat(Infinity)) walk(c, out); return out; };
  const nodes = walk(tree), button = nodes.find(n => n.type === 'button' && String(n.props['aria-label']??n.props.children).includes('Replay audio'));
  // Busuu-style pill: one toggle + speed in the content, a silent live region, and the voice picker as a top-bar icon button (closed by default)
  assert.ok(!nodes.some(n => n.type === 'details'), 'no inline voice disclosure');
  assert.ok(nodes.some(n => n.type === 'button' && n.props['aria-label'] === 'Audio voice settings' && n.props['aria-expanded'] === false));
  assert.ok(nodes.some(n => n.type === 'select' && n.props['aria-label'] === 'Playback speed'));
  const live = nodes.find(n => n.type === 'p' && n.props.role === 'status'); assert.ok(live && String(live.props.children) === '');
  assert.ok(!nodes.some(n => n.props?.role === 'alert' && /audio/i.test(String(n.props.children))));
  assert.ok(button); assert.ok(effects >= 3); // the prefetch effect is registered alongside the existing audio effects
  await button.props.onClick();
  assert.equal(r.calls.length, fetched); // served from the prefetched cache
  assert.equal(r.players.length, one.screens[0].dialogue.turns.length);
  assert.equal(dispatched.at(-1).audioReady, true); // only completed playback satisfies the requirement
  // the prefetch itself never rendered or announced anything: the page text has no dialogue script before answering
  const text = JSON.stringify(tree);
  for (const turn of one.screens[0].dialogue.turns) if (!one.screens[0].dialogue.japaneseVisible) assert.ok(!text.includes(turn.japanese));
});

test('kanji screens: source playback is the readings sequence, the examples sequence is separate, and prefetch plans both', () => {
  const pack = get('content-registry').getContentPack('B2.C02.L02');
  const s = pack.screens.find(x => x.screenId === 'B2.C02.L02.A01.S01');
  assert.equal(s.renderer, 'kanji');
  assert.equal(pack.contentVersion, '1.3.0');
  const rd = get('content-readiness');
  assert.equal(rd.getAudioScript(s), '参る、お墓参り、参加');
  assert.equal(rd.getAudioReading(s), 'まいる、おはかまいり、さんか');
  assert.equal(rd.getScreenAudioGaps(s).length, 0);
  const plan = get('audio-plan');
  const pairs = p => p.items.map(i => [i.text, i.reading]);
  const source = plan.getScreenPlayback(pack, s, edge, 1);
  assert.equal(source.kind, 'words');
  assert.equal(source.gapMs, plan.WORD_GAP_MS);
  assert.equal(plan.WORD_GAP_MS, 800);
  assert.deepEqual(pairs(source), [['まいる', 'まいる'], ['さん', 'さん']], 'okurigana hyphen removed; kana is both text and reading');
  assert.ok(source.items.every(i => i.provider === 'edge' && i.voice === edge.edgeVoice && i.speed === 1));
  const examples = plan.getKanjiExamplesPlayback(s, edge, 1);
  assert.equal(examples.kind, 'words'); assert.equal(examples.gapMs, plan.EXAMPLE_GAP_MS); assert.equal(plan.EXAMPLE_GAP_MS, 500);
  assert.deepEqual(pairs(examples), [['参る', 'まいる'], ['お墓参り', 'おはかまいり'], ['参加', 'さんか']]);
  const prefetch = plan.planLessonPrefetch(pack, edge, 1, 0);
  for (const item of [...source.items, ...examples.items]) assert.ok(prefetch.some(p => p.text === item.text && p.reading === item.reading && p.voice === item.voice), item.text);
  const clips = plan.planLessonClips(pack, edge, 1).filter(c => c.screenId === s.screenId);
  assert.deepEqual(clips.map(c => [c.role, c.item.text]), [['source', 'まいる'], ['source', 'さん'], ['examples', '参る'], ['examples', 'お墓参り'], ['examples', '参加']]);
  assert.ok(!prefetch.some(i => i.text === '参る、参加' || i.text === '参る、お墓参り、参加' || i.text === s.audio.text));
  assert.equal(plan.getScreenPlayback(pack, s, edge, 1, true), null, 'kanji screens have no corrected-sentence feedback');
  assert.equal(plan.getKanjiExamplesPlayback(pack.screens.find(x => x.renderer !== 'kanji'), edge, 1), null);
  const sentence = pack.screens.find(x => x.renderer !== 'kanji' && x.renderer !== 'dialogue' && plan.getScreenPlayback(pack, x, edge, 1));
  assert.equal(plan.getScreenPlayback(pack, sentence, edge, 1).kind, 'single');
});

test('every current kanji screen derives reading clips; a ・ alternative becomes separate clips', () => {
  const reg = get('content-registry'), rd = get('content-readiness');
  const ids = [...new Set(JSON.parse(fs.readFileSync(new URL('../content/busuu/b2-polish/registered-fingerprints.json', import.meta.url))).packs.map(p => p.recordId))];
  let kanji = 0; const odd = [];
  for (const id of ids) for (const s of reg.getContentPack(id).screens.filter(x => x.renderer === 'kanji')) {
    kanji++;
    const clips = rd.getKanjiReadingClips(s);
    assert.equal(clips.length, s.kanji.readings.flatMap(r => r.text.split('・')).length, s.screenId);
    for (const c of clips) { assert.equal(c.text, c.reading); assert.ok(!/[-\s]/.test(c.text)); if (/[・.]/.test(c.text)) odd.push([s.screenId, c.text]); }
  }
  assert.equal(kanji, 55);
  assert.deepEqual(odd, [], 'no clip keeps a ・ alternative');
  const cup = reg.getContentPack('B2.C06.L05').screens.find(x => x.screenId === 'B2.C06.L05.A02.S05');
  assert.equal(cup.kanji.readings.map(r => r.text).join(' / '), 'はい / ばい / ぱい', 'caption text as Busuu shows it');
  assert.deepEqual(rd.getKanjiReadingClips(cup).map(c => c.text), ['はい', 'ばい', 'ぱい']);
});

test('the kanji runner autoplays the readings (not the examples); the example button plays the examples; only one control shows its state', async () => {
  const registry = loadCourseModule('lib/busuu/content-registry.ts');
  const pack = registry.getContentPack('B2.C02.L02');
  const one = { ...pack, screens: [pack.screens[0]], baseScreenCount: 1 };
  const calls = [];
  const fake = { setScreen(id) { calls.push(['screen', id]); }, cancel() { calls.push(['cancel']); }, prefetch() {},
    async playSequence(items, gap) { calls.push(['sequence', items.map(i => i.text), gap]); return true; },
    async play() { throw new Error('single play unexpected'); }, async playDialogue() { throw new Error('dialogue unexpected'); } };
  const state = { phase: 'presentation', index: 0, preview: true, audioReady: false, visited: [], outcomes: {}, slots: [], matches: [] };
  const dispatched = []; let count = 0; const effects = [];
  let audioState = { status: 'idle', message: '' }, kind = 'source';
  const make = () => { count = 0; effects.length = 0; return loadCourseModule('components/busuu/LessonRunner.tsx', { react: { ...React,
    useState(initial) { const n = ++count; return [n === 1 ? state : n === 3 ? audioState : n === 6 ? true : n === 4 ? edge : n === 13 ? kind : typeof initial === 'function' ? initial() : initial, fn => { if (n === 13) kind = fn; else if (typeof fn === 'function') dispatched.push(fn(state)); }]; },
    useRef(initial) { return { current: initial === null ? fake : initial }; }, useCallback(fn) { return fn; }, useEffect(fn) { effects.push(fn); } } }).default; };
  const walk = (v, out = []) => { if (!v || typeof v !== 'object') return out; out.push(v); for (const c of [v.props?.children].flat(Infinity)) walk(c, out); return out; };
  const render = () => walk(make()({ pack: one, preview: true, title: 'Kanji', returnHref: '/busuu/B2', onExit() {} })).find(n => n.props?.audio && n.props?.screen).props.audio;
  let audio = render();
  assert.equal(audio.readings.label, 'Play kanji readings'); assert.equal(audio.examples.label, 'Play examples');
  assert.equal(audio.readings.status, 'idle'); assert.equal(audio.examples.status, 'idle');
  // entering the screen runs the autoplay effect: readings, not examples
  for (const fn of effects.filter(f => String(f).includes('void play()'))) fn();
  await tick();
  assert.deepEqual(calls.filter(c => c[0] === 'sequence'), [['sequence', ['まいる', 'さん'], 800]]);
  assert.equal(dispatched.at(-1)?.audioReady, true, 'a completed readings playback satisfies the audio requirement');
  // the example speaker plays the examples (a separate on-demand playback) and does not mark the screen's audio again
  const before = dispatched.length;
  audio = render(); await audio.examples.onToggle(); await tick();
  assert.deepEqual(calls.filter(c => c[0] === 'sequence').at(-1), ['sequence', ['参る', 'お墓参り', '参加'], 500]);
  assert.equal(dispatched.length, before);
  // each control shows its own state only: while the adapter plays the examples, the readings control stays idle, and vice versa
  audioState = { status: 'playing', message: 'Playing Japanese audio' };
  audio = render();
  assert.deepEqual([audio.examples.status, audio.readings.status, audio.examples.label, audio.readings.label], ['playing', 'idle', 'Pause examples', 'Play kanji readings']);
  await audio.readings.onToggle(); await tick();
  audio = render();
  assert.deepEqual([audio.readings.status, audio.examples.status], ['playing', 'idle']);
  assert.equal(audio.readings.label, 'Pause kanji readings');
});

test('list-style scripts (／ and →) play one clip per item with a gap, feedback too, and prefetch plans the same clips', () => {
  const plan = get('audio-plan'), reg = get('content-registry');
  const find = (record, id) => { const pack = reg.getContentPack(record); return [pack, pack.screens.find(s => s.screenId === id)]; };
  const pairs = p => p.items.map(i => [i.text, i.reading]);
  const [p5, slash] = find('B2.C05.L02', 'B2.C05.L02.A01.S14');
  const src = plan.getScreenPlayback(p5, slash, edge, 1), fb = plan.getScreenPlayback(p5, slash, edge, 1, true);
  assert.equal(src.kind, 'words'); assert.equal(src.gapMs, plan.WORD_GAP_MS);
  assert.deepEqual(pairs(src), [['男性用浴室', 'だんせいようよくしつ'], ['女性用浴室', 'じょせいようよくしつ']]);
  assert.deepEqual(pairs(fb), pairs(src));
  const pre = plan.planLessonPrefetch(p5, edge, 1, 0);
  for (const i of [...src.items, ...fb.items]) assert.ok(pre.some(c => c.text === i.text && c.reading === i.reading), i.text);
  assert.ok(!pre.some(c => c.text.includes('／')));
  const [p10, arrow] = find('B2.C10.L07', 'B2.C10.L07.A01.S01');
  const a = plan.getScreenPlayback(p10, arrow, edge, 1);
  assert.deepEqual(pairs(a), [['待つ', 'まつ'], ['待たせる', 'またせる']]);
  assert.deepEqual(pairs(plan.getScreenPlayback(p10, arrow, edge, 1, true)), pairs(a));
  // beforeAnswer:false keeps no source audio but the feedback list still plays
  const [p9, quiet] = find('B2.C10.L09', 'B2.C10.L09.A01.S07');
  assert.equal(plan.getScreenPlayback(p9, quiet, edge, 1), null);
  assert.deepEqual(pairs(plan.getScreenPlayback(p9, quiet, edge, 1, true)), [['待つ', 'まつ'], ['待たせる', 'またせる']]);
});

test('list splitting falls back to a single clip when counts differ or feedback text differs', () => {
  const { splitAudioList } = get('content-readiness'), plan = get('audio-plan'), reg = get('content-registry');
  assert.equal(splitAudioList('A ／ B ／ C', 'a。b。'), null);
  assert.equal(splitAudioList('待つ → 待たせる', 'まつ'), null);
  assert.equal(splitAudioList('待つ→待たせる', 'まつ、またせる'), null, 'no spaced separator, not a list');
  assert.equal(splitAudioList('待つ → 待たせる', undefined), null);
  assert.deepEqual(splitAudioList('A → B', 'え、びー。'), [{ text: 'A', reading: 'え' }, { text: 'B', reading: 'びー' }]);
  const pack = structuredClone(reg.getContentPack('B2.C10.L07')), s = pack.screens.find(x => x.screenId === 'B2.C10.L07.A01.S01');
  s.audio.reading = 'まつ';
  const single = plan.getScreenPlayback(pack, s, edge, 1);
  assert.equal(single.kind, 'single'); assert.equal(single.item.text, '待つ → 待たせる');
  s.audio.reading = 'まつ、またせる'; s.audio.feedbackText = '待たせる';
  assert.equal(plan.getScreenPlayback(pack, s, edge, 1, true).kind, 'single');
  assert.equal(plan.getScreenPlayback(pack, s, edge, 1).kind, 'words');
});
