// Real registered packs + actual API/server/client + isolated PostgreSQL. No remote writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '../persistence-validation/runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
import { chapterOneResponses, chapterAction } from '../../../lib/busuu-chapter-one-responses.mjs';
const get = file => loadCourseModule(`lib/busuu/${file}.ts`);
const packs = Object.keys(chapterOneResponses).map(id => get('attempt-server').coursePack(id).pack);
const db = new PGlite(), owner = '10000000-0000-4000-8000-000000000001', stranger = '10000000-0000-4000-8000-000000000002';
let checks = 0, offline = false;
const verify = (value, label) => { assert.ok(value, label); checks++; };
const storageMap = new Map(), storage = { get length() { return storageMap.size; }, key: i => [...storageMap.keys()][i] ?? null,
  getItem: k => storageMap.get(k) ?? null, setItem: (k, v) => storageMap.set(k, v), removeItem: k => storageMap.delete(k) };
const keys = { course_start_attempt: ['p_id','p_user','p_record','p_version','p_hash','p_restart','p_state','p_result'],
  course_save_event: ['p_attempt','p_user','p_request','p_sequence','p_action','p_version','p_hash','p_state','p_result','p_complete'] };
const adapter = {
  auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
  async rpc(name, input) {
    try { const r = await db.query(`select public.${name}(${keys[name].map((_, i) => '$' + (i + 1)).join(',')}) as attempt`, keys[name].map(k => input[k])); return { data: r.rows[0].attempt, error: null }; }
    catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
  },
  from(table) {
    let columns = '*'; const clauses = [], args = [];
    const q = { select(c) { columns = c; return q; }, eq(k, v) { args.push(v); clauses.push(`${k}=$${args.length}`); return q; },
      async maybeSingle() { const r = await db.query(`select ${columns} from public.${table} where ${clauses.join(' and ')}`, args); return { data: r.rows[0] ?? null, error: null }; } };
    return q;
  },
};
const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'isolated-test-only';
const route = loadCourseModule('app/api/course/attempts/route.ts', {
  '@/utils/supabase/server': { createClient: async () => adapter }, '@supabase/supabase-js': { createClient: () => adapter },
});
const transport = async (url, body, expectedOwner) => {
  if (offline && url.includes('?attempt=')) throw new Error('Isolated offline boundary');
  const response = await route.POST(new Request(`http://localhost${url}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Course-Owner': expectedOwner, Origin: 'http://localhost' }, body: JSON.stringify(body) }));
  const data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
};
const sessionFor = p => new (get('attempt-client').CourseAttemptSession)(p, owner, storage, transport, () => {}, p.recordId);
const send = async (session, pack, action) => {
  session.dispatch({ ...action, screenId: pack.screens[session.snapshot().state.index].screenId }); await session.retry();
};
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    insert into auth.users values ('${owner}'),('${stranger}');`);
  for (const name of ['20261004011140_course_attempts.sql', '20261004011331_course_attempt_events_owner_index.sql'])
    await db.exec(fs.readFileSync(new URL(`../../../../../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  await db.exec('set role service_role');
  for (const pack of packs) {
    let session = sessionFor(pack); await session.open(); verify(session.snapshot().ready, `${pack.recordId}: actual API starts registered pack`);
    const reopen = async label => { const before = structuredClone(session.snapshot().state); session.dispose(); session = sessionFor(pack); await session.open();
      assert.deepEqual(session.snapshot().state, before); checks++; verify(session.snapshot().ready, label); };
    for (const [i, screen] of pack.screens.entries()) {
      verify(session.snapshot().state.index === i, 'saved sequence');
      if (!session.snapshot().state.audioReady) await send(session, pack, { type: 'audio_ready' });
      const responses = chapterOneResponses[pack.recordId][i];
      for (const [j, value] of responses.entries()) {
        // Actual CP intentionally finishes with one reversed lexical response to separate accuracy/completion.
        const selected = pack.recordId.endsWith('CP') && i === 11 ? ['culture', 'interest'][j] : value;
        if (screen.renderer === 'ordering' && j === 0) offline = true;
        await send(session, pack, chapterAction(screen, selected, j));
        if (offline) { verify(session.snapshot().status === 'error', 'failed save retains response'); await reopen('outbox restores partial order'); offline = false; await session.retry(); }
        if (['ordering', 'gaps'].includes(screen.renderer) && j === 0 && responses.length > 1) {
          await reopen('partial tokens restored');
          await send(session, pack, { type: 'remove_token', slot: 0 }); await reopen('removal restored');
          await send(session, pack, { type: 'token', id: selected });
        }
      }
      if (screen.answer) { verify(session.snapshot().state.phase === 'feedback', 'final response opens feedback'); await reopen('feedback restored'); }
      verify(!session.snapshot().confirmed.completed_at, 'no completion before final core continue');
      await send(session, pack, { type: 'continue' });
    }
    await reopen('result restored'); const complete = session.snapshot().confirmed;
    verify(complete.completed_at && complete.result.completionEligible, 'core completion saved');
    verify(complete.result.percent === (pack.recordId.endsWith('CP') ? 93 : 100), 'accuracy separate from completion');
    verify(complete.state.visited.length === pack.baseScreenCount, 'optional writing not visited');
    const beforeEvents = complete.revision;
    if (pack.completion) {
      const response = await route.POST(new Request(`http://localhost/api/course/attempts?attempt=${complete.id}`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Course-Owner': owner }, body: JSON.stringify({ requestId: crypto.randomUUID(), sequence: beforeEvents + 1,
          contentVersion: pack.contentVersion, contentHash: complete.content_hash, action: { type: 'token', screenId: pack.completion.optionalSurfaces[0].screenId, id: 'fake' } }) }));
      verify(response.status === 409, 'optional surface cannot write completion events');
    }
    await session.restart(); verify(session.snapshot().confirmed.id !== complete.id && session.snapshot().state.index === 0, 'restart creates a distinct attempt');
    verify(!(await db.query('select active from public.course_attempts where id=$1', [complete.id])).rows[0].active, 'prior attempt retained and retired'); session.dispose();
  }
  const server = get('attempt-server');
  for (const [id, version] of [['B2.C01.L01', '1.0.0'], ['B2.C01.L02', '1.1.0'], ['B2.C01.L03', '1.1.0']]) {
    const { pack, hash } = server.coursePack(id, version), state = get('attempt').initialAttemptState(pack);
    const initial = await server.startAttempt(adapter, owner, { requestId: crypto.randomUUID(), recordId: id, contentVersion: version, contentHash: hash, restart: false });
    assert.deepEqual(initial.state, state); checks++;
    const resumed = await server.startAttempt(adapter, owner, { requestId: crypto.randomUUID(), recordId: id, contentVersion: version, contentHash: hash, restart: false });
    verify(initial.id === resumed.id, 'released attempts resume exact version');
  }
  const rows = (await db.query('select * from public.course_attempts order by completed_at desc nulls last')).rows;
  const progress = get('progress').savedCourseProgress([...rows, ...rows]);
  verify(get('progress').chapterCompletion(get('inventory').getLevelInventory('B2').chapters[0], progress) === 50, 'three new completions counted uniquely');
  verify(progress['B2.C01.CP'].accuracy === 93, 'checkpoint map accuracy independent');
  const eventRows = (await db.query('select attempt_id,count(*)::int n from public.course_attempt_events group by attempt_id')).rows;
  verify(eventRows.every(e => e.n === rows.find(r => r.id === e.attempt_id).revision), 'outbox retries are idempotent');
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${stranger}',false);`);
  verify((await db.query('select count(*)::int n from public.course_attempts')).rows[0].n === 0, 'foreign account sees no attempts');
  verify((await db.query('select count(*)::int n from public.course_attempt_events')).rows[0].n === 0, 'foreign account sees no events');
} finally {
  if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  await db.close();
}
console.log(`${checks} isolated chapter-one PostgreSQL/API/client assertions passed. Real registered content; no live database writes.`);
