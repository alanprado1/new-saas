// Isolated PostgreSQL only. Synthetic fixture copy never reaches runtime content or live Supabase.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '../persistence-validation/runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
import { completeExpansionFixture, correctActions } from '../../../lib/busuu-expansion-fixtures.mjs';
const packs = [completeExpansionFixture('l02'), completeExpansionFixture('l03')];
const overrides = Object.fromEntries(packs.map(p => [`@/content/busuu/b2-c01-${p.recordId.slice(-3).toLowerCase()}.v1.json`, p]));
const server = loadCourseModule('lib/busuu/attempt-server.ts', overrides);
const { CourseAttemptSession } = loadCourseModule('lib/busuu/attempt-client.ts', overrides);
const { savedCourseProgress, chapterCompletion } = loadCourseModule('lib/busuu/progress.ts');
const { inventory } = loadCourseModule('lib/busuu/inventory.ts');
const db = new PGlite(), owner = '10000000-0000-4000-8000-000000000001';
const storageMap = new Map();
const storage = { getItem: k => storageMap.get(k) ?? null, setItem: (k, v) => storageMap.set(k, v), removeItem: k => storageMap.delete(k),
  key: i => [...storageMap.keys()][i] ?? null, get length() { return storageMap.size; } };
let checks = 0, offline = false;
const verify = (ok, label) => { assert.ok(ok, label); checks++; };
const rpcKeys = {
  course_start_attempt: ['p_id', 'p_user', 'p_record', 'p_version', 'p_hash', 'p_restart', 'p_state', 'p_result'],
  course_save_event: ['p_attempt', 'p_user', 'p_request', 'p_sequence', 'p_action', 'p_version', 'p_hash', 'p_state', 'p_result', 'p_complete'],
};
const adapter = {
  async rpc(name, input) {
    try { const keys = rpcKeys[name]; const r = await db.query(`select public.${name}(${keys.map((_, i) => '$' + (i + 1)).join(',')}) as attempt`, keys.map(k => input[k])); return { data: r.rows[0].attempt, error: null }; }
    catch (e) { return { data: null, error: { code: e.code, message: e.message } }; }
  },
  from(table) {
    let columns = '*'; const where = [], args = [];
    const q = { select(c) { columns = c; return q; }, eq(k, v) { args.push(v); where.push(`${k}=$${args.length}`); return q; },
      async maybeSingle() { const r = await db.query(`select ${columns} from public.${table} where ${where.join(' and ')}`, args); return { data: r.rows[0] ?? null, error: null }; } };
    return q;
  },
};
const transport = async (url, body, expectedOwner) => {
  assert.equal(expectedOwner, owner);
  if (offline && url.includes('?attempt=')) throw new Error('Fixture connection unavailable');
  const id = new URL(url, 'http://local').searchParams.get('attempt');
  const attempt = id ? await server.saveAttemptEvent(adapter, owner, id, body) : await server.startAttempt(adapter, owner, body);
  return { owner, attempt };
};
const session = (pack, writer) => new CourseAttemptSession(pack, owner, storage, transport, () => {}, writer);
const send = async (s, action) => {
  s.dispatch({ ...action, screenId: packs.find(p => p.recordId === s.snapshot().confirmed.record_id).screens[s.snapshot().state.index].screenId });
  await s.retry();
};
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    insert into auth.users values ('${owner}');`);
  for (const name of ['20261004011140_course_attempts.sql', '20261004011331_course_attempt_events_owner_index.sql']) {
    await db.exec(fs.readFileSync(new URL(`../../../../../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  }
  await db.exec('set role service_role');
  const sessions = packs.map((p, i) => session(p, `writer-${i}`));
  for (const s of sessions) await s.open();
  verify(sessions.every(s => s.snapshot().ready), 'both fixture packs open through real persistence');
  verify(sessions[0].snapshot().confirmed.id !== sessions[1].snapshot().confirmed.id, 'same owner/version, separate lesson attempts');
  verify(sessions[0].snapshot().confirmed.content_hash !== sessions[1].snapshot().confirmed.content_hash, 'lesson fingerprints are distinct');
  for (const [li, pack] of packs.entries()) {
    let s = sessions[li];
    while (s.snapshot().state.phase !== 'result') {
      const i = s.snapshot().state.index, screen = pack.screens[i];
      if (!s.snapshot().state.audioReady) await send(s, { type: 'audio_ready' });
      for (const [ai, action] of correctActions(screen).entries()) {
        const savePartial = (screen.renderer === 'pairs' && ai === 0) || (screen.answer?.kind === 'ordered_slots' && screen.answer.slots.length === 2 && ai === 0);
        if (savePartial) offline = true;
        await send(s, action);
        if (savePartial) {
          verify(s.snapshot().pending > 0 && s.snapshot().status === 'error', 'partial response retained after failed save');
          const before = JSON.stringify(s.snapshot().state); s.dispose();
          s = session(pack, `resumed-${li}-${i}`); await s.open();
          verify(JSON.stringify(s.snapshot().state) === before, 'partial matching/slot restored from saved state and outbox');
          offline = false; await s.retry();
          verify(s.snapshot().pending === 0, 'same retained request saves successfully');
        }
      }
      if (screen.answer) {
        verify(s.snapshot().state.phase === 'feedback', 'feedback persisted on the existing base screen');
        const before = JSON.stringify(s.snapshot().state); s.dispose(); s = session(pack, `feedback-${li}-${i}`); await s.open();
        verify(JSON.stringify(s.snapshot().state) === before, 'feedback resumes through actual PostgreSQL reads');
      }
      await send(s, { type: 'continue' });
    }
    sessions[li] = s;
    verify(s.snapshot().confirmed.completed_at && s.snapshot().confirmed.result.percent === 100, 'server confirms fixture completion');
    verify(s.snapshot().state.visited.length === (li === 0 ? 9 : 10), 'recorded base screen count preserved');
    verify(s.snapshot().confirmed.result.graded === (li === 0 ? 7 : 6), 'only practice screens contribute to accuracy');
    const reopened = session(pack, `result-${li}`); await reopened.open();
    verify(reopened.snapshot().confirmed.completed_at && reopened.snapshot().state.phase === 'result', 'completion resumes');
    reopened.dispose();
  }
  const rows = (await db.query('select * from public.course_attempts order by completed_at desc')).rows;
  verify(chapterCompletion(inventory.levels[3].chapters[0], savedCourseProgress(rows)) === 33, 'two of six chapter entries; accuracy is separate');
  verify(chapterCompletion(inventory.levels[3].chapters[0], savedCourseProgress([...rows, ...rows])) === 33, 'duplicate attempts do not double count progress');
  const l02Id = sessions[0].snapshot().confirmed.id, l03Id = sessions[1].snapshot().confirmed.id;
  await sessions[0].restart();
  verify(sessions[0].snapshot().confirmed.id !== l02Id && sessions[0].snapshot().state.index === 0, 'restart creates a distinct L02 attempt');
  verify((await db.query('select active from public.course_attempts where id=$1', [l03Id])).rows[0].active, 'L02 restart does not retire L03');
  verify(savedCourseProgress(rows)['B2.C01.L03'].accuracy === 100, 'L03 completion isolated');
  const a = sessions[0].snapshot().confirmed, hash = a.content_hash;
  await assert.rejects(server.saveAttemptEvent(adapter, owner, a.id, { requestId: crypto.randomUUID(), sequence: 1, contentVersion: a.content_version, contentHash: hash, action: { type: 'audio_ready', screenId: packs[1].screens[0].screenId } }), /invalid/i); checks++;
  await assert.rejects(server.saveAttemptEvent(adapter, owner, a.id, { requestId: crypto.randomUUID(), sequence: 1, contentVersion: a.content_version, contentHash: 'b'.repeat(64), action: { type: 'audio_ready', screenId: packs[0].screens[0].screenId } }), /version/i); checks++;
  await assert.rejects(server.startAttempt(adapter, owner, { requestId: crypto.randomUUID(), recordId: packs[0].recordId, contentVersion: '999.0.0', contentHash: hash, restart: true }), /version/i); checks++;
  const real = loadCourseModule('lib/busuu/attempt-server.ts');
  for (const p of packs) {
    const { hash } = real.coursePack(p.recordId);
    await assert.rejects(real.startAttempt(adapter, owner, { requestId: crypto.randomUUID(), recordId: p.recordId, contentVersion: p.contentVersion, contentHash: hash, restart: false }), /cannot create a saved attempt/i); checks++;
  }
  verify((await db.query('select count(*)::int n from public.course_attempts')).rows[0].n === 3, 'runtime previews add no rows');
  const events = (await db.query('select attempt_id,count(*)::int n from public.course_attempt_events group by attempt_id')).rows;
  verify(events.every(e => e.n === rows.find(r => r.id === e.attempt_id).revision), 'retries produce one event per sequence');
  sessions.forEach(s => s.dispose());
} finally { await db.close(); }
console.log(`${checks} isolated expansion PostgreSQL checks passed. L02/L03 text and answers are TEST FIXTURES; runtime packs remain non-scoring previews. No live database connection or writes.`);
