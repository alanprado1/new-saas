import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadCourseModule } from './busuu-test-helpers.mjs';
const pack = loadCourseModule('lib/busuu/inventory.ts').getLessonSpec('B2.C01.L01').contentPack;
const runner = loadCourseModule('lib/busuu/attempt.ts');
const owner = 'account-a';
const hash = createHash('sha256').update(JSON.stringify(pack)).digest('hex');
function setup() {
  const entries = new Map();
  const storage = { get length() { return entries.size; }, key: i => [...entries.keys()][i] ?? null, getItem: k => entries.get(k) ?? null, setItem: (k,v) => entries.set(k,v), removeItem: k => entries.delete(k) };
  let attempt = { id: 'attempt-a', user_id: owner, record_id: pack.recordId, content_version: pack.contentVersion,
    content_hash: hash, revision: 0, active: true, completed_at: null, state: runner.initialAttemptState(pack) };
  const seen = new Map(), requests = []; let fail = false, loseAck = false;
  const transport = async (path, body, expectedOwner) => {
    requests.push({ path, body, owner: expectedOwner });
    if (fail && path.includes('?attempt=')) throw new Error('Offline');
    if (path.includes('?attempt=')) {
      const old = seen.get(body.requestId);
      if (old) assert.deepEqual(old, body);
      else {
        assert.equal(body.sequence, attempt.revision + 1);
        const state = runner.evaluateAction(pack, attempt.state, body.action);
        const result = runner.attemptResult(pack, state);
        attempt = { ...attempt, revision: body.sequence, state, result, completed_at: result.completionEligible ? 'saved' : null };
        seen.set(body.requestId, body);
      }
      if (loseAck) { loseAck = false; throw new Error('Acknowledgement lost'); }
    } else if (body.restart) attempt = { ...attempt, id: body.requestId, revision: 0, state: runner.initialAttemptState(pack), completed_at: null };
    return { owner: expectedOwner, attempt: structuredClone(attempt) };
  };
  const Controller = loadCourseModule('lib/busuu/attempt-client.ts').CourseAttemptSession;
  const make = (send = transport, who = owner, writer) => new Controller(pack, who, storage, send, () => {}, writer);
  return { make, entries, requests, get attempt() { return attempt; }, set fail(v) { fail = v; }, set loseAck(v) { loseAck = v; } };
}
test('failed saves retain immediate feedback and stable ordered retries; refresh restores pending responses', async () => {
  const h = setup(); const s = h.make(); await s.open();
  h.fail = true;
  s.dispatch({ type: 'audio_ready', screenId: pack.screens[0].screenId });
  s.dispatch({ type: 'continue', screenId: pack.screens[0].screenId });
  s.dispatch({ type: 'audio_ready', screenId: pack.screens[1].screenId });
  s.dispatch({ type: 'truth', screenId: pack.screens[1].screenId, value: true });
  await s.retry(); assert.equal(s.snapshot().state.phase, 'feedback'); assert.equal(s.snapshot().pending, 4);
  const first = h.requests.find(r => r.path.includes('?attempt='));
  s.dispose();
  const resumed = h.make(); await resumed.open();
  assert.equal(resumed.snapshot().state.phase, 'feedback');
  h.fail = false; await resumed.retry();
  assert.equal(resumed.snapshot().pending, 0); assert.equal(h.attempt.revision, 4);
  const retries = h.requests.filter(r => r.body.requestId === first.body.requestId);
  assert.ok(retries.length >= 2); assert.deepEqual(retries[0], retries.at(-1));
});
test('lost acknowledgement is retried without counting twice and restart creates a distinct attempt', async () => {
  const h = setup(); const s = h.make(); await s.open(); h.loseAck = true;
  s.dispatch({ type: 'audio_ready', screenId: pack.screens[0].screenId });
  await s.retry(); await s.retry(); assert.equal(h.attempt.revision, 1);
  const old = h.attempt.id; await s.restart(); assert.notEqual(h.attempt.id, old); assert.equal(s.snapshot().state.index, 0);
});
test('disposal and owner mismatches cannot apply late responses to another account', async () => {
  const h = setup(); let resolve;
  const slow = h.make(() => new Promise(r => resolve = r)); const pending = slow.open();
  while (!resolve) await new Promise(setImmediate);
  slow.dispose();
  resolve({ owner, attempt: h.attempt }); await pending; assert.equal(slow.snapshot().ready, false);
  const wrong = h.make(async () => ({ owner: 'account-b', attempt: { ...h.attempt, user_id: 'account-b' } }));
  await wrong.open(); assert.equal(wrong.snapshot().ready, false); assert.match(wrong.snapshot().message, /account/i);
  const different = h.make(async () => ({ owner: 'account-b', attempt: { ...h.attempt, user_id: 'account-b' } }), 'account-b');
  await different.open(); assert.equal(different.snapshot().pending, 0);
});
test('independent tabs cannot overwrite one another’s durable pending responses', async () => {
  const h = setup(); const a = h.make(undefined, owner, 'tab-a'), b = h.make(undefined, owner, 'tab-b');
  await a.open(); await b.open(); h.fail = true;
  a.dispatch({type:'audio_ready',screenId:pack.screens[0].screenId});
  a.dispatch({type:'continue',screenId:pack.screens[0].screenId});
  b.dispatch({type:'audio_ready',screenId:pack.screens[0].screenId});
  await a.retry(); await b.retry(); a.dispose(); b.dispose();
  const restoredA = h.make(undefined, owner, 'tab-a'), restoredB = h.make(undefined, owner, 'tab-b');
  await restoredA.open(); await restoredB.open();
  assert.equal(restoredA.snapshot().pending,2); assert.equal(restoredB.snapshot().pending,1);
});
test('a same-version fingerprint mismatch is rejected before responses can be saved', async () => {
  const h = setup(); const s = h.make(async () => ({ owner, attempt: { ...h.attempt, content_hash: 'b'.repeat(64) } }));
  await s.open(); assert.equal(s.snapshot().ready,false); assert.match(s.snapshot().message,/version|content/i);
});
test('restart can recover a content-version conflict during the initial open and retains its key on failure', async () => {
  const h = setup(); let rejected = true; const starts = [];
  const s = h.make(async (path, body, expectedOwner) => {
    starts.push(body);
    if (!body.restart || rejected) throw new Error('Content version changed');
    return { owner: expectedOwner, attempt: { ...h.attempt, id: body.requestId } };
  });
  await s.open(); assert.equal(s.snapshot().ready, false);
  await s.restart(); rejected = false; await s.retry();
  assert.equal(s.snapshot().ready, true); assert.equal(starts[1].restart, true);
  assert.equal(starts[1].requestId, starts[2].requestId);
});
test('a late save acknowledgement cannot change a retired account session', async () => {
  const h = setup(); let resolve;
  const s = h.make(async (path) => path.includes('?attempt=') ? await new Promise(r => resolve=r) : {owner,attempt:structuredClone(h.attempt)});
  await s.open(); s.dispatch({type:'audio_ready',screenId:pack.screens[0].screenId});
  while (!resolve) await new Promise(setImmediate);
  s.dispose(); resolve({owner,attempt:{...h.attempt,revision:1}}); await s.retry();
  assert.equal(s.snapshot().confirmed.revision,0); assert.equal(s.snapshot().pending,1);
  const b = h.make(async () => ({owner:'account-b',attempt:{...h.attempt,user_id:'account-b'}}),'account-b');
  await b.open(); assert.equal(b.snapshot().pending,0);
});
test('restricted browser storage does not prevent server saving and exposes its recovery limit', async () => {
  const h = setup();
  const Controller = loadCourseModule('lib/busuu/attempt-client.ts').CourseAttemptSession;
  const s = new Controller(pack,owner,null,async()=>({owner,attempt:h.attempt}),()=>{});
  await s.open(); assert.equal(s.snapshot().ready,true); assert.match(s.snapshot().storageWarning,/Keep this page open/);
});
test('cloned sessionStorage still creates independent durable writers', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis,'sessionStorage'); const values = new Map();
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});
  try {
    const h=setup(); const a=h.make(); await a.open(); const b=h.make(); await b.open(); h.fail=true;
    a.dispatch({type:'audio_ready',screenId:pack.screens[0].screenId});
    a.dispatch({type:'continue',screenId:pack.screens[0].screenId});
    b.dispatch({type:'audio_ready',screenId:pack.screens[0].screenId}); await a.retry(); await b.retry();
    const queues=[...h.entries.entries()].filter(([key])=>!key.endsWith(':start')).map(([,value])=>JSON.parse(value).events.length);
    assert.deepEqual(queues.sort(),[1,2]); a.dispose(); b.dispose();
  } finally { if(previous) Object.defineProperty(globalThis,'sessionStorage',previous); else delete globalThis.sessionStorage; }
});
