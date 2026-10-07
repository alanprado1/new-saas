import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from './runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';

const sql = ['20261004011140_course_attempts.sql','20261004011331_course_attempt_events_owner_index.sql'].map(name => fs.readFileSync(new URL(`../../../../../supabase/migrations/${name}`, import.meta.url), 'utf8')).join('\n');
let db = new PGlite();
const a = '10000000-0000-4000-8000-000000000001', b = '10000000-0000-4000-8000-000000000002';
const id = '20000000-0000-4000-8000-000000000001';
const { startAttempt, saveAttemptEvent, coursePack } = loadCourseModule('lib/busuu/attempt-server.ts');
const { savedCourseProgress } = loadCourseModule('lib/busuu/progress.ts');
const { pack, hash } = coursePack('B2.C01.L01');
// Executes the real server evaluator and migration functions against isolated PostgreSQL.
const functions = {
  course_start_attempt: ['p_id','p_user','p_record','p_version','p_hash','p_restart','p_state','p_result'],
  course_save_event: ['p_attempt','p_user','p_request','p_sequence','p_action','p_version','p_hash','p_state','p_result','p_complete'],
};
const adapter = {
  async rpc(name, args) {
    try {
      const keys = functions[name];
      const response = await db.query(`select public.${name}(${keys.map((_,i) => '$' + (i + 1)).join(',')}) as attempt`, keys.map(k => args[k]));
      return { data: response.rows[0].attempt, error: null };
    } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
  },
  from(table) {
    const conditions = [], args = []; let columns = '*';
    const q = {
      select(c) { columns = c; return q; },
      eq(k, v) { args.push(v); conditions.push(`${k} = $${args.length}`); return q; },
      async maybeSingle() {
        try {
          const response = await db.query(`select ${columns} from public.${table} where ${conditions.join(' and ')}`, args);
          return { data: response.rows[0] ?? null, error: null };
        } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
      },
    }; return q;
  },
};
let checks = 0;
const verify = (value, message) => { assert.ok(value, message); checks++; };
async function denied(sql, args = []) { await assert.rejects(db.query(sql, args), /permission denied/); checks++; }
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${a}'),('${b}');
    create table public.user_card_progress (user_id uuid, card_id text, repetition integer);
    insert into public.user_card_progress values ('${a}', 'retained', 7);`);
  await db.exec(sql);
  assert.equal((await db.query("select count(*)::int n from public.course_attempts")).rows[0].n, 0);
  await db.exec('set role service_role');
  const start = { requestId: id, recordId: pack.recordId, contentVersion: pack.contentVersion, contentHash: hash, restart: false };
  let attempt = await startAttempt(adapter, a, start);
  verify(attempt.user_id === a && attempt.revision === 0, 'account-owned start written and read');
  verify((await startAttempt(adapter, a, start)).id === id, 'start retry uses same attempt');
  await assert.rejects(startAttempt(adapter,a,{...start,restart:true}), /conflict/i); checks++;
  verify((await startAttempt(adapter, a, { ...start, requestId: crypto.randomUUID() })).id === id, 'normal launch resumes active attempt');
  await assert.rejects(startAttempt(adapter,a,{...start,contentVersion:'999'}), /version/); checks++;
  const event = (action, sequence = attempt.revision + 1) => ({ requestId: crypto.randomUUID(), sequence, contentVersion: pack.contentVersion, contentHash: hash, action });
  await assert.rejects(startAttempt(adapter,a,{...start,requestId:crypto.randomUUID(),contentHash:'b'.repeat(64)}), /version/); checks++;
  const send = async (type, fields = {}) => {
    if (type === 'audio_ready' && attempt.state.audioReady) return;
    const e = event({ type, screenId: pack.screens[attempt.state.index].screenId, ...fields });
    attempt = await saveAttemptEvent(adapter, a, id, e); return e;
  };
  await assert.rejects(send('continue'), /order/); checks++;
  await assert.rejects(send('audio_ready',{score:100}), /fields/); checks++;
  const first = await send('audio_ready');
  verify((await saveAttemptEvent(adapter,a,id,first)).revision === 1, 'lost acknowledgement retry does not increment');
  await assert.rejects(saveAttemptEvent(adapter,a,id,{...first,action:{type:'continue',screenId:pack.screens[0].screenId}}), /duplicate/); checks++;
  await assert.rejects(saveAttemptEvent(adapter,a,id,event({type:'continue',screenId:pack.screens[0].screenId},9)), /order/); checks++;
  await assert.rejects(saveAttemptEvent(adapter,b,id,event({type:'continue',screenId:pack.screens[0].screenId})), /not found/); checks++;
  await send('continue'); await send('audio_ready'); await send('truth', {value:false});
  verify(attempt.state.phase === 'feedback' && attempt.state.outcomes[1].correct === false && !attempt.completed_at, 'wrong response saved as wrong without completion');
  const resumedFeedback = await startAttempt(adapter,a,{...start,requestId:crypto.randomUUID()});
  verify(resumedFeedback.state.phase === 'feedback', 'resume restores acknowledged feedback');
  await send('continue'); await send('audio_ready');
  const pairs = pack.screens[2].answer.pairs;
  await send('pair',{side:'left',id:pairs[0].leftId});
  verify((await startAttempt(adapter,a,{...start,requestId:crypto.randomUUID()})).state.endpoint.id === pairs[0].leftId, 'partial matching endpoint survives reload');
  await send('pair',{side:'right',id:pairs[1].rightId});
  for (const pair of pairs) { await send('pair',{side:'left',id:pair.leftId}); await send('pair',{side:'right',id:pair.rightId}); }
  await send('continue'); await send('audio_ready');
  await assert.rejects(send('token',{id:'invented'}), /order/); checks++;
  await send('token',{id:pack.screens[3].answer.slots[0].acceptedTokenIds[0]});
  await send('continue'); await send('audio_ready'); await send('choice',{id:pack.screens[4].answer.acceptedOptionIds[0]});
  await send('continue'); await send('audio_ready');
  const token = pack.screens[5].answer.slots[0].acceptedTokenIds[0];
  await send('token',{id:token});
  verify((await startAttempt(adapter,a,{...start,requestId:crypto.randomUUID()})).state.slots[0] === token, 'partial token survives reload');
  await send('remove_token',{slot:0}); await send('token',{id:token}); await send('token',{id:pack.screens[5].answer.slots[1].acceptedTokenIds[0]});
  verify(!attempt.completed_at, 'final feedback is unfinished until ordered Continue');
  const final = await send('continue');
  verify(attempt.completed_at && attempt.result.percent === 60, 'real database acknowledges completion separately from 60% accuracy');
  verify((await saveAttemptEvent(adapter,a,id,final)).revision === attempt.revision, 'completion retry does not double-count');
  const count = (await db.query('select count(*)::int n from public.course_attempt_events where attempt_id=$1',[id])).rows[0].n;
  verify(count === attempt.revision, 'one row per consecutive event');
  await db.exec('reset role');
  // Export and reopen the database, independent of the previous engine/session memory.
  const dump = await db.dumpDataDir(); await db.close(); db = new PGlite({loadDataDir:dump});
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${a}',false)`);
  const persisted = (await db.query('select * from public.course_attempts')).rows;
  verify(persisted.length === 1 && persisted[0].completed_at, 'completion survives database reopen');
  verify(savedCourseProgress(persisted)[pack.recordId].accuracy === 60, 'reopened saved completion appears in map projection');
  await denied('update public.course_attempts set result=$1 where id=$2',[{percent:100},id]);
  await denied('insert into public.course_attempt_events(attempt_id,user_id,sequence,request_id,action) values($1,$2,999,$3,$4)',[id,a,crypto.randomUUID(),{}]);
  await denied('delete from public.course_attempts');
  await denied('select public.course_start_attempt($1,$2,$3,$4,$5,false,$6,$7)',[crypto.randomUUID(),a,pack.recordId,pack.contentVersion,'a'.repeat(64),{},{}]);
  await denied('select public.course_save_event($1,$2,$3,1,$4,$5,$6,$7,$8,true)',[id,a,crypto.randomUUID(),{},pack.contentVersion,'a'.repeat(64),{},{}]);
  await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
  verify((await db.query('select * from public.course_attempts')).rows.length === 0, 'cross-account attempt reads denied by RLS');
  verify((await db.query('select * from public.course_attempt_events')).rows.length === 0, 'cross-account event reads denied by RLS');
  await db.exec('reset role; set role anon');
  await denied('select * from public.course_attempts');
  await denied('select * from public.course_attempt_events');
  await db.exec('reset role; set role service_role');
  const restart = {...start,requestId:crypto.randomUUID(),restart:true};
  const fresh = await startAttempt(adapter,a,restart);
  verify(fresh.id !== id && fresh.revision === 0, 'restart creates distinct attempt');
  verify((await startAttempt(adapter,a,restart)).id === fresh.id, 'restart lost acknowledgement uses same new attempt');
  await assert.rejects(saveAttemptEvent(adapter,a,id,final), /restarted/); checks++;
  const competing = [0,1].map(()=>({...first,requestId:crypto.randomUUID(),sequence:1}));
  const race = await Promise.allSettled(competing.map(e=>saveAttemptEvent(adapter,a,fresh.id,e)));
  verify(race.filter(r=>r.status==='fulfilled').length===1 && race.filter(r=>r.status==='rejected').length===1, 'concurrent different requests at one revision commit only once');
  verify((await db.query('select revision from public.course_attempts where id=$1',[fresh.id])).rows[0].revision===1, 'concurrent CAS keeps consecutive revision');
  await assert.rejects(db.query('select public.course_save_event($1,$2,$3,2,$4,$5,$6,null,$7,false)',[fresh.id,a,crypto.randomUUID(),{type:'continue',screenId:pack.screens[0].screenId},pack.contentVersion,hash,{}]), /null value/); checks++;
  verify((await db.query('select count(*)::int n from public.course_attempt_events where attempt_id=$1',[fresh.id])).rows[0].n===1, 'failed transaction rolls back event and attempt together');
  const versionConflict = {...fresh,content_hash:'b'.repeat(64)};
  await db.query('update public.course_attempts set content_hash=$1 where id=$2',[versionConflict.content_hash,fresh.id]);
  await assert.rejects(saveAttemptEvent(adapter,a,fresh.id,{...first,sequence:1}), /version/); checks++;
  await db.exec('reset role');
  verify((await db.query('select repetition from public.user_card_progress')).rows[0].repetition === 7, 'existing Study/SRS sentinel unchanged');
  const functionsSafe = (await db.query("select prosecdef, proconfig from pg_proc where proname in ('course_start_attempt','course_save_event')")).rows;
  verify(functionsSafe.every(f=>!f.prosecdef && f.proconfig.includes('search_path=""')), 'no definer privileges; fixed function search path');
} finally { await db.close(); }
console.log(`${checks} isolated PostgreSQL checks passed: real server evaluation, writes/reads, duplicates/conflicts, partial resume, completion after reopen/map, restart, content mismatch, RLS/client mutation denials and retained Study/SRS data. This test does not connect to live Supabase.`);
