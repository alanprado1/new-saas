// Real registered saved paths for a sample of the polished versions (one record per chapter), plus the same record at its PREVIOUS version.
// Uses the actual registered API route, client session and evaluator; only the established course RPC storage is a disposable in-memory adapter
// (no database, no owner progress). A memory adapter is not PostgreSQL/RLS evidence; those baselines are reused because no event/state/schema changed.
// Responses are derived from each pack's own answer key. That is acceptable here because the answer keys are proven identical to the predecessor
// (pack-text-checks.mjs) and the predecessor's independent literal responses are exercised by the chapter test files against the same registry.
import assert from 'node:assert/strict';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';

export const SAMPLE_RECORDS = ['B2.C01.L01', 'B2.C02.L06', 'B2.C03.L04', 'B2.C04.L03', 'B2.C05.L02', 'B2.C06.L04', 'B2.C07.L03', 'B2.C08.L03', 'B2.C09.L03', 'B2.C10.L05'];

export function correctActions(screen) {
  const a = screen.answer;
  if (!a) return [];
  if (a.kind === 'truth') return [{ type: 'truth', value: a.accepted }];
  if (a.kind === 'choice') return [{ type: 'choice', id: a.acceptedOptionIds[0] }];
  if (a.kind === 'multi_choice') return [...a.acceptedOptionIds.map(id => ({ type: 'toggle_option', id })), { type: 'selection_check' }];
  if (a.kind === 'typed') return [{ type: 'typed_draft', text: a.acceptedForms[0] }, { type: 'typed_check' }];
  if (a.kind === 'pairs') return a.pairs.flatMap(p => [{ type: 'pair', side: 'left', id: p.leftId }, { type: 'pair', side: 'right', id: p.rightId }]);
  if (a.kind === 'ordered_slots') { const used = new Set(); return a.slots.map(slot => { const id = slot.acceptedTokenIds.find(t => !used.has(t)); used.add(id); return { type: 'token', id }; }); }
  if (a.kind === 'ordered_tokens') return a.acceptedOrders[0].map(id => ({ type: 'token', id }));
  throw new Error(`${screen.screenId}: unsupported answer kind ${a.kind}`);
}

export async function runSavedPaths(records = SAMPLE_RECORDS) {
  const server = loadCourseModule('lib/busuu/attempt-server.ts');
  const registry = loadCourseModule('lib/busuu/content-registry.ts');
  const Client = loadCourseModule('lib/busuu/attempt-client.ts').CourseAttemptSession;
  const owner = '10000000-0000-4000-8000-000000000011', rows = [], events = [];
  const storageMap = new Map(), storage = { get length() { return storageMap.size; }, key: i => [...storageMap.keys()][i] ?? null, getItem: k => storageMap.get(k) ?? null, setItem: (k, v) => storageMap.set(k, v), removeItem: k => storageMap.delete(k) };
  const clone = structuredClone;
  const adapter = {
    auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
    async rpc(name, p) {
      let row;
      if (name === 'course_start_attempt') {
        row = rows.find(r => r.user_id === p.p_user && r.record_id === p.p_record && r.content_version === p.p_version && r.active);
        if (p.p_restart && row) { row.active = false; row = null; }
        if (!row) { row = { id: p.p_id, user_id: p.p_user, record_id: p.p_record, content_version: p.p_version, content_hash: p.p_hash, revision: 0, state: clone(p.p_state), result: clone(p.p_result), completed_at: null, active: true }; rows.push(row); }
      } else if (name === 'course_save_event') {
        row = rows.find(r => r.id === p.p_attempt && r.user_id === p.p_user); assert.ok(row && row.revision + 1 === p.p_sequence, 'established RPC sequence');
        events.push({ attempt_id: row.id, user_id: p.p_user, request_id: p.p_request, sequence: p.p_sequence, action: clone(p.p_action) });
        Object.assign(row, { state: clone(p.p_state), result: clone(p.p_result), revision: p.p_sequence, completed_at: p.p_complete ? '2026-10-08T00:00:00Z' : null });
      } else throw Error(`Unexpected RPC ${name}`);
      return { data: clone(row), error: null };
    },
    from(table) { const filters = []; const q = { select() { return q; }, eq(k, v) { filters.push(r => r[k] === v); return q; }, async maybeSingle() { const values = table === 'course_attempts' ? rows : events; return { data: clone(values.find(r => filters.every(f => f(r))) ?? null), error: null }; } }; return q; },
  };
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY; process.env.SUPABASE_SERVICE_ROLE_KEY = 'disposable-memory-contract';
  const route = loadCourseModule('app/api/course/attempts/route.ts', { '@/utils/supabase/server': { createClient: async () => adapter }, '@supabase/supabase-js': { createClient: () => adapter } });
  const transport = async (url, body, expectedOwner) => {
    const response = await route.POST(new Request(`http://localhost${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Course-Owner': expectedOwner, Origin: 'http://localhost' }, body: JSON.stringify(body) }));
    const result = await response.json(); if (!response.ok) throw Error(result.error); return result;
  };
  let assertions = 0;
  const equal = (x, y, label) => { assert.deepEqual(x, y, label); assertions++; }, verify = (v, label) => { assert.ok(v, label); assertions++; };
  const report = [];
  try {
    for (const recordId of records) {
      const current = registry.getContentPack(recordId);
      const previous = registry.getContentPack(recordId, previousVersionOf(registry, recordId, current.contentVersion));
      for (const pack of [current, previous]) {
        const { pack: served, hash } = server.coursePack(recordId, pack.contentVersion); equal(served.contentVersion, pack.contentVersion, `${recordId} exact version resolves`);
        const session = new Client(pack, owner, storage, transport, () => {}, `${recordId}:${pack.contentVersion}`); await session.open();
        verify(session.snapshot().ready, `${recordId}@${pack.contentVersion} registered saved start`);
        equal(session.snapshot().confirmed.content_version, pack.contentVersion, 'saved attempt records its exact content version');
        equal(session.snapshot().confirmed.content_hash, hash, 'saved attempt records the persistence fingerprint');
        let live = session;
        const reopen = async () => { const before = clone(live.snapshot().state); live.dispose(); const next = new Client(pack, owner, storage, transport, () => {}, `${recordId}:${pack.contentVersion}`); await next.open(); equal(next.snapshot().state, before, 'account-owned saved reload'); return next; };
        const sendLive = async a => { live.dispatch({ ...a, screenId: pack.screens[live.snapshot().state.index].screenId }); await live.retry(); verify(live.snapshot().status === 'saved', 'acknowledged response'); };
        for (const [i, screen] of pack.screens.entries()) {
          equal(live.snapshot().state.index, i, 'canonical base order');
          if (i === Math.floor(pack.screens.length / 2)) live = await reopen();
          if (!live.snapshot().state.audioReady) await sendLive({ type: 'audio_ready' });
          for (const action of correctActions(screen)) await sendLive(action);
          if (screen.answer) equal(live.snapshot().state.outcomes[i]?.correct, true, `${screen.screenId} correct response graded correct`);
          if (i === pack.baseScreenCount - 1) verify(!live.snapshot().confirmed.completed_at, 'completion waits for Continue');
          await sendLive({ type: 'continue' });
          verify(!live.snapshot().state.retry, 'no retry after correct responses');
        }
        live = await reopen();
        const saved = live.snapshot().confirmed, graded = pack.screens.filter(s => s.answer).length;
        verify(saved.user_id === owner && saved.completed_at && saved.result.completionEligible, 'completion saved to owner');
        equal(saved.result.percent, 100, 'all-correct accuracy'); equal(saved.content_version, pack.contentVersion, 'completion recorded against its own version');
        equal(new Set(saved.state.visited).size, pack.baseScreenCount, 'unique required surfaces');
        report.push({ recordId, contentVersion: pack.contentVersion, current: pack === current, requiredScreens: pack.baseScreenCount, gradedScreens: graded, accuracy: saved.result.percent, saved: true, reloaded: true });
        live.dispose();
      }
    }
    const progress = loadCourseModule('lib/busuu/progress.ts');
    const completed = progress.savedCourseProgress([...rows, ...rows]);
    equal(Object.keys(completed).length, records.length, 'unique map entries despite old-version and current-version attempts for the same record');
    return { assertions, storage: 'disposable memory RPC adapter; actual registered API/client/evaluator', liveDatabaseWrites: false, records: report };
  } finally { if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey; }
}

function previousVersionOf(registry, recordId, currentVersion) {
  const [a, b] = currentVersion.split('.').map(Number);
  // the predecessor is the registered version immediately below `current` in registration order
  for (let minor = b - 1; minor >= 0; minor--) { const v = `${a}.${minor}.0`; if (registry.getContentPack(recordId, v)) return v; }
  throw new Error(`${recordId}: no earlier version`);
}
