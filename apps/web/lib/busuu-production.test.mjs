import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from './busuu-test-helpers.mjs';

const get = file => loadCourseModule(`lib/busuu/${file}.ts`);
// Hand-reviewed responses; independent of the production accepted-answer mappings.
const responses = {
  'B2.C01.L02': [[], ['where'], [], ['self', 'humble', 'other', 'respectful'], ['respectful-stem'], ['respectful-question'], ['where', 'respectful-stem'], ['hotel'], ['humble-stem']],
  'B2.C01.L03': [[], ['interest'], [], [false], ['history', 'tradition'], [], ['culture'], ['nature'], [], ['interest', 'request']],
};

const actionFor = (s, value, index) => s.renderer === 'pairs' ? { type: 'pair', side: index % 2 ? 'right' : 'left', id: value }
  : s.renderer === 'truth' ? { type: 'truth', value } : { type: s.renderer === 'choice' ? 'choice' : 'token', id: value };

test('registered production lessons preserve their occurrences and can finish with reviewed answers', () => {
  for (const [id, total, graded] of [['B2.C01.L02', 9, 7], ['B2.C01.L03', 10, 6]]) {
    const spec = get('inventory').getLessonSpec(id), pack = get('attempt-server').coursePack(id, '1.1.0').pack; // the released production version; later text-polish versions are checked in busuu-pack-text-polish.test.mjs
    assert.equal(get('readiness').getLessonReadiness(spec).scoredLaunchReady, true);
    assert.equal(pack.contentVersion, '1.1.0');
    const old = get('content-registry').getContentPack(id, '1.0.0');
    assert.deepEqual(pack.screens.map(s => s.sourceContract), old.screens.map(s => s.sourceContract));
    assert.deepEqual(get('content-readiness').getPackReadiness(pack).textGaps, []);
    const m = get('attempt'); let state = m.initialAttemptState(pack);
    for (const [i, s] of pack.screens.entries()) {
      const apply = action => { state = m.evaluateAction(pack, state, { ...action, screenId: s.screenId }); };
      assert.equal(state.index, i);
      if (!state.audioReady) apply({ type: 'audio_ready' }); // legacy stream: playback recorded before answering
      for (const [j, value] of responses[id][i].entries()) {
        apply(actionFor(s, value, j));
        // JSON is the persistence boundary: partial slots, pairs and feedback survive reopening.
        state = JSON.parse(JSON.stringify(state));
        if (s.renderer === 'gaps' && j === 0 && responses[id][i].length === 2) {
          assert.equal(state.phase, 'response'); assert.equal(state.outcomes[i], undefined);
          apply({ type: 'remove_token', slot: 0 }); apply({ type: 'token', id: value });
        }
        if (s.renderer === 'pairs' && j < 3) assert.equal(state.phase, 'response');
      }
      if (s.answer) { assert.equal(state.phase, 'feedback'); assert.equal(state.outcomes[i].correct, true); }
      apply({ type: 'continue' });
    }
    assert.equal(state.visited.length, total);
    assert.deepEqual(m.attemptResult(pack, state), { correct: graded, graded, percent: 100, completionEligible: true });
  }
});

// Only the remote database transport is replaced. SQL transaction/ownership semantics have
// the existing 61 expansion + 42 L01 PostgreSQL assertions as their unchanged baseline.
// Exercise actual registered server start/save/evaluation and the real client outbox here.
function savedSessions() {
  const server = get('attempt-server'), Controller = get('attempt-client').CourseAttemptSession;
  const owner = '10000000-0000-4000-8000-000000000001';
  const attempts = new Map(), events = new Map(), entries = new Map(); let offline = false;
  const storage = { get length() { return entries.size; }, key: i => [...entries.keys()][i] ?? null,
    getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v), removeItem: k => entries.delete(k) };
  const db = {
    from(table) {
      const filters = {};
      const query = { select: () => query, eq: (key, value) => { filters[key] = value; return query; },
        maybeSingle: async () => ({ error: null, data: structuredClone(table === 'course_attempts'
          ? [...attempts.values()].find(a => a.id === filters.id && a.user_id === filters.user_id) ?? null
          : events.get(`${filters.attempt_id}:${filters.request_id}`) ?? null) }) };
      return query;
    },
    async rpc(name, p) {
      let attempt;
      if (name === 'course_start_attempt') {
        const old = [...attempts.values()].find(a => a.active && a.user_id === p.p_user && a.record_id === p.p_record && a.content_version === p.p_version && a.content_hash === p.p_hash);
        if (old && !p.p_restart) return { error: null, data: structuredClone(old) };
        if (old) old.active = false;
        attempt = { id: p.p_id, user_id: p.p_user, record_id: p.p_record, content_version: p.p_version,
          content_hash: p.p_hash, revision: 0, active: true, completed_at: null, state: p.p_state, result: p.p_result };
      } else {
        assert.equal(name, 'course_save_event');
        attempt = { ...attempts.get(p.p_attempt), revision: p.p_sequence, state: p.p_state, result: p.p_result,
          completed_at: p.p_complete ? '2026-10-04T00:00:00Z' : null };
        events.set(`${p.p_attempt}:${p.p_request}`, { sequence: p.p_sequence, action: p.p_action });
      }
      attempts.set(attempt.id, structuredClone(attempt));
      return { error: null, data: structuredClone(attempt) };
    },
  };
  const transport = async (path, body, who) => {
    const id = new URL(path, 'http://localhost').searchParams.get('attempt');
    if (id && offline) throw new Error('Offline test boundary');
    return { owner: who, attempt: id ? await server.saveAttemptEvent(db, who, id, body) : await server.startAttempt(db, who, body) };
  };
  return { attempts, make: pack => new Controller(pack, owner, storage, transport, () => {}, pack.recordId),
    set offline(value) { offline = value; } };
}

test('registered production saves resume partial responses, retry, confirm completion, restart and update the map', async () => {
  const h = savedSessions();
  for (const id of Object.keys(responses)) {
    const pack = get('content-registry').getContentPack(id); let session = h.make(pack); await session.open();
    assert.equal(session.snapshot().ready, true);
    const reopen = async () => {
      const before = structuredClone(session.snapshot().state); session.dispose(); session = h.make(pack); await session.open();
      assert.equal(session.snapshot().ready, true); assert.deepEqual(session.snapshot().state, before);
    };
    const send = async action => {
      const s = pack.screens[session.snapshot().state.index];
      session.dispatch({ ...action, screenId: s.screenId }); await session.retry();
    };
    for (const [i, s] of pack.screens.entries()) {
      assert.equal(session.snapshot().state.index, i);
      if (!session.snapshot().state.audioReady) await send({ type: 'audio_ready' });
      for (const [j, value] of responses[id][i].entries()) {
        if (i === 1) h.offline = true;
        await send(actionFor(s, value, j));
        if (i === 1) {
          assert.equal(session.snapshot().status, 'error'); await reopen();
          h.offline = false; await session.retry(); assert.equal(session.snapshot().pending, 0);
        }
        if ((s.renderer === 'pairs' && j <= 1) || (s.renderer === 'gaps' && responses[id][i].length === 2 && j === 0)) await reopen();
      }
      if (s.answer) {
        assert.equal(session.snapshot().state.phase, 'feedback');
        assert.equal(session.snapshot().confirmed.completed_at, null);
        if (i === 1) await reopen();
      }
      await send({ type: 'continue' });
    }
    await reopen(); const completed = session.snapshot().confirmed;
    assert.ok(completed.completed_at); assert.equal(completed.result.percent, 100);
    assert.equal(session.snapshot().pending, 0); assert.equal(session.snapshot().status, 'saved');
    await session.restart();
    assert.notEqual(session.snapshot().confirmed.id, completed.id);
    assert.equal(session.snapshot().state.index, 0); assert.equal(session.snapshot().confirmed.completed_at, null);
    assert.equal(h.attempts.get(completed.id).active, false);
    session.dispose();
  }
  const progress = get('progress').savedCourseProgress([...h.attempts.values()]);
  assert.deepEqual(progress, { 'B2.C01.L02': { accuracy: 100 }, 'B2.C01.L03': { accuracy: 100 } });
  assert.equal(get('progress').chapterCompletion(get('inventory').getLevelInventory('B2').chapters[0], progress), 33);
});

test('older packs retain exact saved-attempt fingerprints and preview write guards', () => {
  const server = get('attempt-server');
  for (const [id, hash] of [
    ['B2.C01.L01', '631c827850208d3fbd9f26d5a81f8cb7957c665de3872ffd571e62fa0388d349'],
    ['B2.C01.L02', 'abdd416ac0bb652a6873da6510cb5160dacd8882fd28440e02fe24b9adce8506'],
    ['B2.C01.L03', 'c257100fe9e44cb830e98a660f9acf83847c2fed0b3d7c15f400dd11da835f7d'],
  ]) {
    const { pack, hash: actual } = server.coursePack(id, '1.0.0');
    assert.equal(actual, hash);
    if (id !== 'B2.C01.L01') assert.throws(() => get('attempt').initialAttemptState(pack));
  }
});

test('production listening hides its scripts until feedback and scene reuse reconstructs a dialogue line', () => {
  const m = get('attempt'), Renderer = loadCourseModule('components/busuu/LessonScreen.tsx').default;
  for (const id of Object.keys(responses)) {
    const pack = get('content-registry').getContentPack(id), s = pack.screens[7];
    const state = { ...m.initialAttemptState(pack), index: 7, phase: 'response', audioReady: true };
    const markup = renderToStaticMarkup(React.createElement(Renderer, { screen: s, state, dispatch() {} }));
    assert.doesNotMatch(markup, /Content unavailable|HIDDEN_|Fixture/);
    assert.ok(s.audio.text);
    assert.ok(!markup.includes(s.audio.text));
    assert.deepEqual(get('runner').getVisibleSupport(s, 'response'), []);
    const feedback = get('runner').getVisibleSupport(s, 'feedback');
    assert.ok(feedback.some(b => b.kind === 'japanese' && b.text === s.audio.text));
    assert.ok(feedback.some(b => b.kind === 'translation'));
  }
  const pack = get('content-registry').getContentPack('B2.C01.L03'), s = pack.screens[9];
  const natureModel = pack.screens[5];
  const natureMarkup = renderToStaticMarkup(React.createElement(Renderer, { screen: natureModel,
    state: { ...m.initialAttemptState(pack), index: 5, phase: 'presentation', audioReady: true }, dispatch() {} }));
  assert.match(natureMarkup, /I want to go somewhere rich in nature\./);
  const sentence = s.scaffold.reduce((text, part, i) => text + (i ? s.answer.tokens.find(t => t.id === responses[pack.recordId][9][i - 1]).text : '') + part, '');
  assert.equal(sentence, '日本の文化に興味があります。おすすめの博物館を教えてください。');
  assert.ok(get('content-readiness').getSceneReuse(pack, s).dialogue.turns.some(t => t.japanese === sentence));
  assert.equal(s.audio.text, sentence);
});

test('production distractors grade wrong and cannot become a correct completion', () => {
  const m = get('attempt');
  for (const id of Object.keys(responses)) {
    const pack = get('content-registry').getContentPack(id);
    assert.equal(get('content-readiness').getPackReadiness(pack).playable, true);
    for (const [index, s] of pack.screens.entries()) {
      if (!s.answer || s.renderer === 'pairs') continue;
      let state = { ...m.initialAttemptState(pack), index, phase: 'response', audioReady: true,
        slots: s.answer.kind === 'ordered_slots' ? s.answer.slots.map(() => null) : [] };
      const values = s.answer.kind === 'truth' ? [!responses[id][index][0]]
        : s.answer.kind === 'choice' ? [s.answer.options.find(o => !s.answer.acceptedOptionIds.includes(o.id)).id]
        : [s.answer.tokens.find(t => !s.answer.slots[0].acceptedTokenIds.includes(t.id)).id];
      for (let j = 1; j < (s.answer.slots?.length ?? 1); j++) values.push(s.answer.tokens.find(t => !values.includes(t.id)).id);
      for (const value of values) state = m.evaluateAction(pack, state, { screenId: s.screenId,
        ...(s.renderer === 'truth' ? { type: 'truth', value } : { type: s.renderer === 'choice' ? 'choice' : 'token', id: value }) });
      assert.equal(state.phase, 'feedback'); assert.equal(state.outcomes[index].correct, false);
      assert.equal(m.attemptResult(pack, state).completionEligible, false);
    }
  }
});
