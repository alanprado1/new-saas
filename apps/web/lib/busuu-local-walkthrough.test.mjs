import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { loadCourseModule } from './busuu-test-helpers.mjs';
import { chapterTenResponses, chapterTenActions } from './busuu-chapter-ten-responses.mjs';

const gate = loadCourseModule('lib/busuu/local-walkthrough.ts');
const ON = { NODE_ENV: 'development', BUSUU_LOCAL_WALKTHROUGH: '1' };
const OWNER = gate.LOCAL_WALKTHROUGH_OWNER;

// Runs `body` with process.env temporarily set, restoring it afterwards.
async function withEnv(env, body) {
  const keys = ['NODE_ENV', 'BUSUU_LOCAL_WALKTHROUGH'], saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const k of keys) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  try { return await body(); } finally { for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
}

test('walkthrough gate needs development, the explicit env opt-in AND a loopback host', () => {
  const local = ['http://localhost:3100/busuu/B2', 'http://127.0.0.1:3100/busuu/B2', 'http://[::1]:3100/busuu/B2'];
  for (const url of local) assert.equal(gate.isLocalWalkthroughEnabled([url, new URL(url).host], ON), true, url);
  // Each single failing condition turns the gate off.
  for (const env of [{ NODE_ENV: 'production', BUSUU_LOCAL_WALKTHROUGH: '1' }, { NODE_ENV: 'test', BUSUU_LOCAL_WALKTHROUGH: '1' }, { BUSUU_LOCAL_WALKTHROUGH: '1' },
    { NODE_ENV: 'development' }, { NODE_ENV: 'development', BUSUU_LOCAL_WALKTHROUGH: '0' }, { NODE_ENV: 'development', BUSUU_LOCAL_WALKTHROUGH: 'true' }, {}]) {
    assert.equal(gate.isLocalWalkthroughEnabled(['http://localhost:3100/'], env), false, JSON.stringify(env));
  }
  for (const host of ['example.com', 'localhost.evil.com', 'evil.com:3100', '192.168.1.5:3100', '0.0.0.0:3100', 'localhost.:3100', '127.0.0.2:3100', '[::2]:3100', 'user@evil.com', '']) {
    assert.equal(gate.isLocalWalkthroughEnabled([host], ON), false, host);
  }
  // No host at all, or any non-loopback host among several (URL host vs Host header), fails closed.
  assert.equal(gate.isLocalWalkthroughEnabled([], ON), false);
  assert.equal(gate.isLocalWalkthroughEnabled([null, undefined], ON), false);
  assert.equal(gate.isLocalWalkthroughEnabled(['http://localhost:3100/', 'evil.com'], ON), false);
  assert.equal(gate.isLocalWalkthroughEnabled(['http://evil.com/', 'localhost:3100'], ON), false);
  // Only course pages and the course attempt API are in scope.
  for (const p of ['/busuu', '/busuu/B2', '/busuu/B2/lesson/B2.C01.L01', '/api/course/attempts', '/api/tts', '/api/voices']) assert.equal(gate.isWalkthroughPath(p), true, p);
  for (const p of ['/', '/study', '/busuuX', '/api/tts/x', '/api/voices/x', '/api/generate', '/api/voice', '/api/course', '/api/course/attempts/x', '/login', '/lesson/1']) assert.equal(gate.isWalkthroughPath(p), false, p);
});

test('the process-level gate reads the real environment and the request Host header', async () => {
  const request = (url, host) => new Request(url, host ? { headers: { host } } : undefined);
  await withEnv({ NODE_ENV: 'development', BUSUU_LOCAL_WALKTHROUGH: '1' }, () => {
    assert.equal(gate.isLocalWalkthroughRequest(request('http://localhost:3100/busuu/B2')), true);
    assert.equal(gate.isLocalWalkthroughRequest(request('http://localhost:3100/busuu/B2', 'evil.com')), false);
  });
  for (const env of [{ NODE_ENV: 'test', BUSUU_LOCAL_WALKTHROUGH: '1' }, { NODE_ENV: 'development' }, { NODE_ENV: 'production', BUSUU_LOCAL_WALKTHROUGH: '1' }]) {
    await withEnv(env, () => assert.equal(gate.isLocalWalkthroughRequest(request('http://localhost:3100/busuu/B2')), false, JSON.stringify(env)));
  }
});

// ---- proxy ----------------------------------------------------------------------------------
function loadProxy(user = null) {
  const calls = { updateSession: 0 };
  const response = () => { const r = new Response(null); return Object.assign(r, { cookies: { getAll: () => [], set() {} } }); };
  const proxy = loadCourseModule('proxy.ts', { '@/utils/supabase/middleware': { updateSession: async () => { calls.updateSession++; return { supabaseResponse: response(), user }; } } }).proxy;
  return { proxy, calls };
}
const req = (path, host = 'localhost:3100') => new NextRequest(`http://${host}${path}`);

test('with the gate off, /busuu and the course API keep requiring a Supabase session', async () => {
  // Every single-condition failure, including all conditions except one being true.
  const cases = [{ NODE_ENV: 'test', BUSUU_LOCAL_WALKTHROUGH: '1' }, { NODE_ENV: 'production', BUSUU_LOCAL_WALKTHROUGH: '1' }, { NODE_ENV: 'development' }, {}];
  for (const env of cases) await withEnv(env, async () => {
    const { proxy, calls } = loadProxy();
    const page = await proxy(req('/busuu/B2'));
    assert.equal(page.status, 307); assert.equal(new URL(page.headers.get('location')).pathname, '/login');
    assert.equal(new URL(page.headers.get('location')).searchParams.get('next'), '/busuu/B2');
    const api = await proxy(req('/api/course/attempts'));
    assert.equal(api.status, 401); assert.deepEqual(await api.json(), { error: 'Unauthorized. Invalid or expired session.' });
    assert.equal(calls.updateSession, 2, `session checked for both: ${JSON.stringify(env)}`);
  });
  // Dev + opt-in but a non-loopback host also stays protected.
  await withEnv(ON, async () => {
    const { proxy } = loadProxy();
    assert.equal((await proxy(req('/busuu/B2', 'example.com'))).status, 307);
    assert.equal((await proxy(req('/api/course/attempts', 'example.com'))).status, 401);
  });
  // A signed-in session is unaffected with the gate off.
  const { proxy } = loadProxy({ id: 'real-user' });
  assert.equal((await proxy(req('/busuu/B2'))).status, 200);
});

test('with the gate on, only course pages and the course API skip auth; the rest stays protected', async () => {
  await withEnv(ON, async () => {
    const { proxy, calls } = loadProxy();
    for (const p of ['/busuu', '/busuu/B2', '/busuu/B2/lesson/B2.C01.L01', '/api/course/attempts', '/api/tts', '/api/voices']) {
      const response = await proxy(req(p));
      assert.equal(response.status, 200, p); assert.equal(response.headers.get('location'), null, p);
    }
    assert.equal(calls.updateSession, 0, 'Supabase session code is never reached for course flows');
    for (const p of ['/', '/study', '/api/generate', '/api/avatar', '/api/voice']) {
      const response = await proxy(req(p));
      assert.equal(response.status, p.startsWith('/api') ? 401 : 307, p);
    }
    assert.equal(calls.updateSession, 5);
  });
});

// ---- course API + persistence ---------------------------------------------------------------
function loadRoute() {
  const touched = [];
  const trap = name => () => { touched.push(name); throw new Error(`${name} must not be used in walkthrough mode`); };
  const route = loadCourseModule('app/api/course/attempts/route.ts', {
    '@/utils/supabase/server': { createClient: trap('supabase server client') },
    '@supabase/supabase-js': { createClient: trap('supabase admin client') },
  });
  return { route, touched };
}

test('with the gate off the course API is still unauthorized and never touches memory storage', async () => {
  const unauthorized = { auth: { getUser: async () => ({ data: { user: null }, error: null }) } };
  const route = loadCourseModule('app/api/course/attempts/route.ts', { '@/utils/supabase/server': { createClient: async () => unauthorized }, '@supabase/supabase-js': { createClient: () => { throw new Error('no admin'); } } });
  await withEnv({ NODE_ENV: 'test', BUSUU_LOCAL_WALKTHROUGH: '1' }, async () => {
    const headers = { 'X-Course-Owner': OWNER, 'Content-Type': 'application/json' };
    assert.equal((await route.GET(new Request('http://localhost:3100/api/course/attempts', { headers }))).status, 401);
    assert.equal((await route.POST(new Request('http://localhost:3100/api/course/attempts', { method: 'POST', headers, body: '{}' }))).status, 401);
  });
});

test('with the gate on a registered lesson saves, completes, reloads and reports map progress through memory storage', async () => {
  const server = loadCourseModule('lib/busuu/attempt-server.ts'), Client = loadCourseModule('lib/busuu/attempt-client.ts').CourseAttemptSession;
  const progress = loadCourseModule('lib/busuu/progress.ts');
  const id = Object.keys(chapterTenResponses).find(key => !server.coursePack(key).pack.retryPolicy);
  const pack = server.coursePack(id).pack;
  const { route, touched } = loadRoute();
  const storageMap = new Map(), storage = { get length() { return storageMap.size; }, key: i => [...storageMap.keys()][i] ?? null, getItem: k => storageMap.get(k) ?? null, setItem: (k, v) => storageMap.set(k, v), removeItem: k => storageMap.delete(k) };
  const transport = async (url, body, owner) => {
    const response = await route.POST(new Request(`http://localhost:3100${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Course-Owner': owner, Origin: 'http://localhost:3100' }, body: JSON.stringify(body) }));
    const result = await response.json(); if (!response.ok) throw Error(result.error); return result;
  };
  await withEnv(ON, async () => {
    gate.resetLocalWalkthroughStore();
    const make = () => new Client(pack, OWNER, storage, transport, () => {}, 'walkthrough');
    let session = make(); await session.open();
    assert.ok(session.snapshot().ready); assert.equal(session.snapshot().confirmed.user_id, OWNER);
    const send = async action => { session.dispatch({ ...action, screenId: pack.screens[session.snapshot().state.index].screenId }); await session.retry(); assert.equal(session.snapshot().status, 'saved'); };
    for (const [i, screen] of pack.screens.entries()) {
      if (!session.snapshot().state.audioReady) await send({ type: 'audio_ready' });
      for (const [j, value] of chapterTenResponses[id][i].entries()) for (const action of chapterTenActions(screen, value, j, session.snapshot().state)) await send(action);
      if (screen.renderer === 'typed') await send({ type: 'typed_check' });
      if (screen.renderer === 'multi_choice') await send({ type: 'selection_check' });
      if (i === 0) { // reload/resume mid-lesson from memory storage
        const before = structuredClone(session.snapshot().state); session.dispose(); session = make(); await session.open();
        assert.deepEqual(session.snapshot().state, before, 'resume from saved attempt');
      }
      await send({ type: 'continue' });
    }
    const saved = session.snapshot().confirmed;
    assert.ok(saved.completed_at && saved.result.completionEligible, 'completion saved');
    // Reload shows the completed attempt, and the map endpoint reports it for the synthetic owner only.
    const listing = await (await route.GET(new Request('http://localhost:3100/api/course/attempts', { headers: { 'X-Course-Owner': OWNER } }))).json();
    assert.equal(listing.owner, OWNER); assert.equal(listing.attempts.length, 1); assert.equal(listing.attempts[0].id, saved.id);
    assert.deepEqual(Object.keys(progress.savedCourseProgress(listing.attempts)), [id]);
    // A different claimed owner is rejected before any storage access; foreign Origin is still refused.
    assert.equal((await route.GET(new Request('http://localhost:3100/api/course/attempts', { headers: { 'X-Course-Owner': 'someone-else' } }))).status, 409);
    assert.equal((await route.POST(new Request('http://localhost:3100/api/course/attempts', { method: 'POST', headers: { 'X-Course-Owner': OWNER, Origin: 'https://evil.example' }, body: '{}' }))).status, 403);
    // The store is process memory: resetting it (like restarting the dev server) forgets progress.
    gate.resetLocalWalkthroughStore();
    assert.equal((await (await route.GET(new Request('http://localhost:3100/api/course/attempts', { headers: { 'X-Course-Owner': OWNER } }))).json()).attempts.length, 0);
    session.dispose();
  });
  assert.deepEqual(touched, [], 'no Supabase client was constructed for course flows');
});

test('memory storage keeps the RPC contract: restart deactivates, stale sequence and unknown attempts conflict', async () => {
  gate.resetLocalWalkthroughStore();
  const db = gate.getLocalWalkthroughDb();
  const start = (id, restart = false) => db.rpc('course_start_attempt', { p_id: id, p_user: OWNER, p_record: 'B2.C01.L01', p_version: 'v', p_hash: 'h', p_restart: restart, p_state: { index: 0 }, p_result: {} });
  const a = (await start('a')).data, again = (await start('b')).data;
  assert.equal(again.id, 'a', 'unrestarted start returns the active attempt');
  const b = (await start('b', true)).data;
  assert.notEqual(b.id, a.id); assert.equal((await db.from('course_attempts').select('*').eq('id', 'a').maybeSingle()).data.active, false);
  const save = (attempt, sequence, request = 'r') => db.rpc('course_save_event', { p_attempt: attempt, p_user: OWNER, p_request: request, p_sequence: sequence, p_action: { type: 'x' }, p_version: 'v', p_hash: 'h', p_state: { index: sequence }, p_result: {}, p_complete: false });
  assert.equal((await save('a', 1)).error.code, 'P0001', 'restarted attempt rejects saves');
  assert.equal((await save('missing', 1)).error.code, 'P0001');
  assert.equal((await save('b', 2)).error.code, 'P0001', 'sequence must follow revision');
  assert.equal((await save('b', 1)).data.revision, 1);
  assert.equal((await save('b', 1)).data.revision, 1, 'identical duplicate request is idempotent');
  gate.resetLocalWalkthroughStore();
});

// ---- TTS and voice list ---------------------------------------------------------------------
function loadAudioRoutes() {
  const calls = { supabase: 0 };
  const unauthorized = { auth: { getUser: async () => { calls.supabase++; return { data: { user: null }, error: null }; } } };
  const overrides = { '@/utils/supabase/server': { createClient: async () => unauthorized } };
  return { tts: loadCourseModule('app/api/tts/route.ts', overrides), voices: loadCourseModule('app/api/voices/route.ts', overrides), calls };
}
const ttsRequest = (body, host = 'localhost:3100') => new NextRequest(`http://${host}/api/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const voicesRequest = (host = 'localhost:3100') => new NextRequest(`http://${host}/api/voices`);

test('with the gate off /api/tts and /api/voices still require a Supabase user', async () => {
  const { tts, voices, calls } = loadAudioRoutes();
  const cases = [{ NODE_ENV: 'test', BUSUU_LOCAL_WALKTHROUGH: '1' }, { NODE_ENV: 'production', BUSUU_LOCAL_WALKTHROUGH: '1' }, { NODE_ENV: 'development' }, {}];
  let expected = 0;
  for (const env of cases) await withEnv(env, async () => {
    assert.equal((await tts.POST(ttsRequest({ text: 'こんにちは' }))).status, 401, JSON.stringify(env));
    assert.equal((await voices.GET(voicesRequest())).status, 401, JSON.stringify(env));
    assert.equal((await voices.GET()).status, 401, 'no request object');
    expected += 3; assert.equal(calls.supabase, expected);
  });
  // Dev + opt-in but a non-loopback host is also still unauthorized.
  await withEnv(ON, async () => {
    assert.equal((await tts.POST(ttsRequest({ text: 'x' }, 'example.com'))).status, 401);
    assert.equal((await voices.GET(voicesRequest('example.com'))).status, 401);
  });
});

test('with the gate on /api/tts and /api/voices skip Supabase and keep their input validation', async () => {
  const { tts, voices, calls } = loadAudioRoutes();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline in test'); }; // VoiceVox probes fail, so the fallback list is returned
  try {
    await withEnv(ON, async () => {
      assert.equal((await tts.POST(ttsRequest({}))).status, 400, 'empty text still rejected');
      assert.equal((await tts.POST(ttsRequest({ text: '' }))).status, 400);
      const list = await voices.GET(voicesRequest());
      assert.equal(list.status, 200); assert.ok(Array.isArray(await list.json()));
    });
  } finally { globalThis.fetch = realFetch; }
  assert.equal(calls.supabase, 0, 'Supabase auth never consulted in walkthrough mode');
});
