// Real registered chapter 3 packs, actual API/server/client and isolated PostgreSQL.
// No remote database actions or learner data. Includes typed drafts and old-version compatibility.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '../persistence-validation/runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
import { chapterThreeResponses, chapterThreeAction } from '../../../lib/busuu-chapter-three-responses.mjs';
const get = file => loadCourseModule(`lib/busuu/${file}.ts`);
const packs = Object.keys(chapterThreeResponses).map(id => get('attempt-server').coursePack(id).pack);
const baseline = JSON.parse(fs.readFileSync(new URL('./prior-fingerprints.json', import.meta.url)));
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
    const wrongIndex = pack.recordId === 'B2.C03.L02' ? 7 : pack.recordId.endsWith('CP') ? 9 : null;
    let originalOutcomes;
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
      const responses = chapterThreeResponses[pack.recordId][i];
      for (const [j, value] of responses.entries()) {
        // Independent wrong responses exercise immutable first-attempt accuracy, separate from end retry.
        const selected = i === wrongIndex ? screen.renderer === 'typed' ? 'たいです' : screen.answer.options.find(c => c.id !== value).id : value;
        await send(session, pack, chapterThreeAction(screen, selected, j, session.snapshot().state));
        if (['ordering','gaps'].includes(screen.renderer) && j === 0 && responses.length > 1) {
          await invalid({ type: 'token', screenId: screen.screenId, id: session.snapshot().state.slots[0] }, 409);
          await reopen('partial physical tokens restore');
          await send(session, pack, { type: 'remove_token', slot: 0 }); await reopen('removed physical token restores');
          await send(session, pack, chapterThreeAction(screen, selected, j, session.snapshot().state));
        }
      }
      if (screen.renderer === 'typed') { await reopen('full ungraded draft restores'); await send(session, pack, { type: 'typed_check' }); }
      if (screen.answer) {
        verify(session.snapshot().state.phase === 'feedback', 'only final response or Check grades'); await reopen('graded feedback restores');
        verify(session.snapshot().state.outcomes[i].correct === (i !== wrongIndex), `${screen.screenId}: independently reviewed response grades`);
        if (screen.renderer === 'typed') await invalid({ type: 'typed_draft', screenId: screen.screenId, text: 'changed' }, 409);
      }
      verify(!session.snapshot().confirmed.completed_at, 'no completion before final core Continue');
      await send(session, pack, { type: 'continue' });
    }
    if (pack.retryPolicy) {
      verify(session.snapshot().state.phase !== 'result', 'base traversal waits for configured wrong-answer retry');
      verify(!session.snapshot().confirmed.completed_at, 'base last Continue cannot save completion while retry pending');
      originalOutcomes = structuredClone(session.snapshot().state.outcomes);
      assert.deepEqual(session.snapshot().state.retry.queue, [7]); checks++;
      verify(session.snapshot().state.index === 7 && session.snapshot().state.retry.position === 0, 'retry re-enters only configured failed listening');
      await reopen('end retry prompt resumes');
      await invalid({ type: 'continue', screenId: pack.screens[7].screenId }, 409);
      await invalid({ type: 'choice', screenId: pack.screens[8].screenId, id: 'o0' }, 409);
      await invalid({ type: 'choice', screenId: pack.screens[7].screenId, id: 'o0', correct: true }, 400);
      if (!session.snapshot().state.audioReady) await send(session, pack, { type: 'audio_ready' });
      offline = true;
      await send(session, pack, chapterThreeAction(pack.screens[7], chapterThreeResponses[pack.recordId][7][0], 0, session.snapshot().state));
      verify(session.snapshot().status === 'error', 'retry answer retained in offline outbox');
      await reopen('offline retry feedback/outbox survives reload'); offline = false; await session.retry();
      verify(session.snapshot().state.phase === 'feedback' && session.snapshot().state.retry.outcomes[7].correct, 'retry right answer saves separate mastery');
      assert.deepEqual(session.snapshot().state.outcomes, originalOutcomes); checks++;
      await reopen('retry feedback resumes');
      await invalid({ type: 'choice', screenId: pack.screens[7].screenId, id: 'o0' }, 409);
      await send(session, pack, { type: 'continue' });
      assert.deepEqual(session.snapshot().state.outcomes, originalOutcomes); checks++;
    }
    await reopen('saved result restores'); const complete = session.snapshot().confirmed;
    verify(complete.completed_at && complete.result.completionEligible, 'required core completion saved');
    const graded = pack.screens.filter(s => s.answer).length;
    verify(complete.result.percent === (wrongIndex === null ? 100 : Math.round((graded - 1) / graded * 100)), 'first-attempt accuracy independent of completion/retry mastery');
    verify(Object.hasOwn(complete.result, 'retry') === Boolean(pack.retryPolicy), 'retry report exists only on configured packs');
    if (pack.retryPolicy) { assert.deepEqual(complete.result.retry, { attempted: 1, correct: 1, total: 1, complete: true }); checks++; }
    verify(complete.state.visited.length === pack.baseScreenCount, 'only required screens counted');
    for (const surface of pack.completion?.optionalSurfaces ?? []) await invalid({ type: 'typed_draft', screenId: surface.screenId, text: '私の性格' }, 409);
    await session.restart(); verify(session.snapshot().confirmed.id !== complete.id && session.snapshot().state.index === 0, 'restart creates distinct attempt');
    verify(!session.snapshot().state.retry?.queue.length && !Object.keys(session.snapshot().state.outcomes).length, 'restart clears retry and first outcomes');
    verify(!(await db.query('select active from public.course_attempts where id=$1', [complete.id])).rows[0].active, 'predecessor retained and retired');
    if (pack.retryPolicy) {
      // One retry is a remediation opportunity, not a correctness gate or indefinite loop.
      for (const [i, screen] of pack.screens.entries()) {
        if (!session.snapshot().state.audioReady) await send(session, pack, { type: 'audio_ready' });
        for (const [j, value] of chapterThreeResponses[pack.recordId][i].entries())
          await send(session, pack, chapterThreeAction(screen, i === 7 ? screen.answer.options.find(c => c.id !== value).id : value, j, session.snapshot().state));
        await send(session, pack, { type: 'continue' });
      }
      await reopen('second wrong-first attempt resumes retry');
      if (!session.snapshot().state.audioReady) await send(session, pack, { type: 'audio_ready' });
      const wrong = pack.screens[7].answer.options.find(c => c.id !== chapterThreeResponses[pack.recordId][7][0]).id;
      await send(session, pack, { type: 'choice', id: wrong }); await reopen('wrong retry feedback resumes');
      verify(session.snapshot().state.retry.outcomes[7].correct === false && session.snapshot().state.outcomes[7].correct === false, 'wrong retry preserves separate false outcomes');
      await send(session, pack, { type: 'continue' }); await reopen('wrong retry result resumes');
      verify(session.snapshot().confirmed.completed_at && session.snapshot().state.phase === 'result', 'single wrong retry still finishes core');
      assert.deepEqual(session.snapshot().confirmed.result.retry, { attempted: 1, correct: 0, total: 1, complete: true }); checks++;
      verify(session.snapshot().confirmed.result.percent === complete.result.percent, 'right/wrong retry cannot change base accuracy');
      await invalid({ type: 'continue', screenId: pack.screens[7].screenId }, 409);
      // All-correct path needs no remediation state and retains the same nine-screen count.
      let state = get('attempt').initialAttemptState(pack);
      const evaluate = action => { state = get('attempt').evaluateAction(pack, state, { ...action, screenId: pack.screens[state.index].screenId }); };
      for (const [i, screen] of pack.screens.entries()) {
        if (!state.audioReady) evaluate({ type: 'audio_ready' });
        for (const [j, value] of chapterThreeResponses[pack.recordId][i].entries()) evaluate(chapterThreeAction(screen, value, j, state));
        evaluate({ type: 'continue' });
      }
      verify(state.phase === 'result' && !Object.hasOwn(state, 'retry') && state.visited.length === 9, 'correct listening skips retry without extra counted surfaces');
      assert.deepEqual(get('attempt').attemptResult(pack, state).retry, { attempted: 0, correct: 0, total: 0, complete: true }); checks++;
    }
    session.dispose();
  }
  const server = get('attempt-server');
  for (const { recordId: id, contentVersion: version, file, persistenceFingerprint, fileHash } of baseline.packs) {
    const { pack, hash } = server.coursePack(id, version);
    verify(hash === persistenceFingerprint, 'all old exact registered fingerprints preserved');
    verify(createHash('sha256').update(fs.readFileSync(new URL(`../${file}`, import.meta.url))).digest('hex') === fileHash, 'all old pack bytes preserved');
    // Preview-only released versions cannot create attempts; readiness and fingerprints remain verified.
    if (!get('content-readiness').getPackReadiness(pack).playable) continue;
    const initial = await server.startAttempt(adapter, owner, { requestId: crypto.randomUUID(), recordId: id, contentVersion: version, contentHash: hash, restart: false });
    assert.deepEqual(initial.state, get('attempt').initialAttemptState(pack)); checks++;
    verify(Object.hasOwn(initial.state, 'typedDraft') === (pack.screens[0].renderer === 'typed'), 'old typed field remains occurrence conditional');
    verify(!Object.hasOwn(initial.state, 'retry') && !Object.hasOwn(initial.result, 'retry'), 'old saved state/result gains no retry field');
    const action = initial.state.audioReady && pack.screens[0].renderer === 'typed'
      ? { type: 'typed_draft', screenId: pack.screens[0].screenId, text: 'こ' }
      : { type: 'audio_ready', screenId: pack.screens[0].screenId };
    const saved = await server.saveAttemptEvent(adapter, owner, initial.id, { requestId: crypto.randomUUID(), sequence: 1, contentVersion: version, contentHash: hash, action });
    const resumed = await server.startAttempt(adapter, owner, { requestId: crypto.randomUUID(), recordId: id, contentVersion: version, contentHash: hash, restart: false });
    verify(resumed.id === initial.id && resumed.revision === 1, 'released exact version resumes'); assert.deepEqual(resumed.state, saved.state); checks++;
  }
  const rows = (await db.query('select * from public.course_attempts')).rows, progress = get('progress').savedCourseProgress([...rows, ...rows]);
  verify(get('progress').chapterCompletion(get('inventory').getLevelInventory('B2').chapters[2], progress) === 100, 'seven unique completions give chapter 100%');
  verify(progress['B2.C03.CP'].accuracy === 95, 'checkpoint accuracy distinct');
  const eventRows = (await db.query('select attempt_id,count(*)::int n from public.course_attempt_events group by attempt_id')).rows;
  verify(eventRows.every(e => e.n === rows.find(r => r.id === e.attempt_id).revision), 'retry is idempotent');
  const a = rows.find(r => r.record_id === 'B2.C03.CP' && r.active);
  const foreign = await post(`/api/course/attempts?attempt=${a.id}`, {}, stranger); verify(foreign.status === 409, 'API rejects account mismatch');
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${stranger}',false);`);
  verify((await db.query('select count(*)::int n from public.course_attempts')).rows[0].n === 0, 'foreign account sees no attempts');
  verify((await db.query('select count(*)::int n from public.course_attempt_events')).rows[0].n === 0, 'foreign account sees no events');
} finally {
  if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  await db.close();
}
console.log(`${checks} isolated chapter-three PostgreSQL/API/client assertions passed. Actual packs, immutable base accuracy, end retry, typed drafts, multi-activity/repeated-token resume, completion, ownership and all 16 prior fingerprints; no live database writes.`);
