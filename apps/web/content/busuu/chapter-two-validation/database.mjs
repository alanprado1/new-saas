// Real registered chapter 2 packs, actual API/server/client and isolated PostgreSQL.
// No remote database actions or learner data. Includes typed drafts and old-version compatibility.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '../persistence-validation/runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
import { chapterTwoResponses, chapterTwoAction } from '../../../lib/busuu-chapter-two-responses.mjs';
const get = file => loadCourseModule(`lib/busuu/${file}.ts`);
const packs = Object.keys(chapterTwoResponses).map(id => get('attempt-server').coursePack(id).pack);
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
const post = (url, body, expectedOwner = owner) => route.POST(new Request(`http://localhost${url}`, { method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Course-Owner': expectedOwner, Origin: 'http://localhost' }, body: JSON.stringify(body) }));
const transport = async (url, body, expectedOwner) => {
  if (offline && url.includes('?attempt=')) throw new Error('Isolated offline boundary');
  const response = await post(url, body, expectedOwner), data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
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
    let session = sessionFor(pack); await session.open(); verify(session.snapshot().ready, `${pack.recordId}: API starts registered pack`);
    const reopen = async label => { const before = structuredClone(session.snapshot().state); session.dispose(); session = sessionFor(pack); await session.open();
      assert.deepEqual(session.snapshot().state, before); checks++; verify(session.snapshot().ready, label); };
    const invalid = async (action, status) => {
      const a = session.snapshot().confirmed, revision = a.revision;
      const response = await post(`/api/course/attempts?attempt=${a.id}`, { requestId: crypto.randomUUID(), sequence: revision + 1,
        contentVersion: pack.contentVersion, contentHash: a.content_hash, action });
      verify(response.status === status, `API rejects ${JSON.stringify(action)}`);
      verify((await db.query('select revision from public.course_attempts where id=$1', [a.id])).rows[0].revision === revision, 'invalid response writes no revision');
    };
    for (const [i, screen] of pack.screens.entries()) {
      verify(session.snapshot().state.index === i, 'saved canonical sequence');
      if (screen.screenId.includes('.A02.S01')) await reopen('internal activity boundary resumes');
      if (screen.renderer === 'typed') {
        await invalid({ type: 'typed_check', screenId: screen.screenId }, 409);
        await invalid({ type: 'typed_draft', screenId: screen.screenId, text: 3 }, 400);
        await invalid({ type: 'typed_draft', screenId: screen.screenId, text: 'a'.repeat(101) }, 400);
        await invalid({ type: 'typed_check', screenId: screen.screenId, correct: true }, 400);
        // Drafts save before playback and remain ungraded. Lost network keeps an outbox draft.
        offline = true; await send(session, pack, { type: 'typed_draft', text: 'こ' });
        verify(session.snapshot().status === 'error', 'typed offline save retains draft');
        await reopen('typed outbox draft resumes before checking'); offline = false; await session.retry();
        verify(session.snapshot().confirmed.state.typedDraft === 'こ', 'server confirms partial typed draft');
        verify(session.snapshot().confirmed.state.outcomes[i] === undefined, 'draft never grades');
        await send(session, pack, { type: 'typed_draft', text: '' }); await reopen('cleared draft restores');
      }
      if (!session.snapshot().state.audioReady) await send(session, pack, { type: 'audio_ready' });
      const responses = chapterTwoResponses[pack.recordId][i];
      for (const [j, value] of responses.entries()) {
        // CP deliberately records one wrong checked reading; completion must still save at 95% accuracy.
        const selected = pack.recordId.endsWith('CP') && i === 0 ? 'こわがり' : value;
        await send(session, pack, chapterTwoAction(screen, selected, j, session.snapshot().state));
        if (['ordering','gaps'].includes(screen.renderer) && j === 0 && responses.length > 1) {
          await reopen('partial physical tokens restore');
          await send(session, pack, { type: 'remove_token', slot: 0 }); await reopen('removed physical token restores');
          await send(session, pack, chapterTwoAction(screen, selected, j, session.snapshot().state));
        }
      }
      if (screen.renderer === 'typed') { await reopen('full ungraded draft restores'); await send(session, pack, { type: 'typed_check' }); }
      if (screen.answer) {
        verify(session.snapshot().state.phase === 'feedback', 'only final response or Check grades'); await reopen('graded feedback restores');
        if (screen.renderer === 'typed') await invalid({ type: 'typed_draft', screenId: screen.screenId, text: 'changed' }, 409);
      }
      verify(!session.snapshot().confirmed.completed_at, 'no completion before final core Continue');
      await send(session, pack, { type: 'continue' });
    }
    await reopen('saved result restores'); const complete = session.snapshot().confirmed;
    verify(complete.completed_at && complete.result.completionEligible, 'required core completion saved');
    verify(complete.result.percent === (pack.recordId.endsWith('CP') ? 95 : 100), 'accuracy independent of completion');
    verify(complete.state.visited.length === pack.baseScreenCount, 'only required screens counted');
    for (const surface of pack.completion?.optionalSurfaces ?? []) await invalid({ type: 'typed_draft', screenId: surface.screenId, text: '私の性格' }, 409);
    await session.restart(); verify(session.snapshot().confirmed.id !== complete.id && session.snapshot().state.index === 0, 'restart creates distinct attempt');
    verify(!(await db.query('select active from public.course_attempts where id=$1', [complete.id])).rows[0].active, 'predecessor retained and retired'); session.dispose();
  }
  const server = get('attempt-server');
  for (const [id, version] of [['B2.C01.L01','1.0.0'], ['B2.C01.L02','1.1.0'], ['B2.C01.L03','1.1.0'], ['B2.C01.L04','1.0.0'], ['B2.C01.L05','1.0.0'], ['B2.C01.CP','1.0.0']]) {
    const { pack, hash } = server.coursePack(id, version);
    const initial = await server.startAttempt(adapter, owner, { requestId: crypto.randomUUID(), recordId: id, contentVersion: version, contentHash: hash, restart: false });
    assert.deepEqual(initial.state, get('attempt').initialAttemptState(pack)); checks++; verify(!Object.hasOwn(initial.state, 'typedDraft'), 'old state shape unchanged');
    const action = { type: 'audio_ready', screenId: pack.screens[0].screenId };
    const saved = await server.saveAttemptEvent(adapter, owner, initial.id, { requestId: crypto.randomUUID(), sequence: 1, contentVersion: version, contentHash: hash, action });
    const resumed = await server.startAttempt(adapter, owner, { requestId: crypto.randomUUID(), recordId: id, contentVersion: version, contentHash: hash, restart: false });
    verify(resumed.id === initial.id && resumed.revision === 1, 'released exact version resumes'); assert.deepEqual(resumed.state, saved.state); checks++;
  }
  const rows = (await db.query('select * from public.course_attempts')).rows, progress = get('progress').savedCourseProgress([...rows, ...rows]);
  verify(get('progress').chapterCompletion(get('inventory').getLevelInventory('B2').chapters[1], progress) === 100, 'eight unique completions give chapter 100%');
  verify(progress['B2.C02.CP'].accuracy === 95, 'checkpoint accuracy distinct');
  const eventRows = (await db.query('select attempt_id,count(*)::int n from public.course_attempt_events group by attempt_id')).rows;
  verify(eventRows.every(e => e.n === rows.find(r => r.id === e.attempt_id).revision), 'retry is idempotent');
  const a = rows.find(r => r.record_id === 'B2.C02.CP' && r.active);
  const foreign = await post(`/api/course/attempts?attempt=${a.id}`, {}, stranger); verify(foreign.status === 409, 'API rejects account mismatch');
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${stranger}',false);`);
  verify((await db.query('select count(*)::int n from public.course_attempts')).rows[0].n === 0, 'foreign account sees no attempts');
  verify((await db.query('select count(*)::int n from public.course_attempt_events')).rows[0].n === 0, 'foreign account sees no events');
} finally {
  if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  await db.close();
}
console.log(`${checks} isolated chapter-two PostgreSQL/API/client assertions passed. Actual packs, typed drafts, multi-activity resume, completion, ownership and old versions; no live database writes.`);
