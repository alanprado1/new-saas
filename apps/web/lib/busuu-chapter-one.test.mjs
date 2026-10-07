import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from './busuu-test-helpers.mjs';
import { chapterOneResponses, chapterAction } from './busuu-chapter-one-responses.mjs';
const get = file => loadCourseModule(`lib/busuu/${file}.ts`);
const fixture = () => ({ schemaVersion: '1.0', contentVersion: '1.0.0', recordId: 'B2.C01.L04', status: 'reviewed', baseScreenCount: 1,
  screens: [{ screenId: 'B2.C01.L04.A01.S01', renderer: 'ordering', prompt: 'Build the sentence.',
    answer: { kind: 'ordered_tokens', tokens: [{ id: 'a', text: 'とか' }, { id: 'c', text: '行きたい。' }, { id: 'b', text: 'とか' }], acceptedOrders: [['a', 'b', 'c'], ['b', 'a', 'c']] },
    support: { before: [], after: [{ kind: 'explanation', text: 'Fixture explanation.' }] }, praise: 'Correct',
    audio: { required: false, text: null }, visual: 'none', evidence: [], unresolved: [], sourceContract: { responseSlotCount: 3 } }] });

test('L05 partitions unchanged eight-surface evidence into seven required screens and optional S08', () => {
  const spec = get('inventory').getLessonSpec('B2.C01.L05'), pack = get('content-registry').getContentPack(spec.recordId);
  assert.ok(pack); assert.equal(spec.baseScreenCount, 8); assert.equal(spec.screens.length, 8);
  assert.equal(pack.baseScreenCount, 7); assert.equal(pack.screens.length, 7);
  assert.equal(pack.schemaVersion, '1.1');
  assert.deepEqual(pack.completion.requiredScreenIds, spec.screens.slice(0, 7).map(s => s.screenId));
  assert.equal(pack.completion.optionalSurfaces[0].screenId, 'B2.C01.L05.A01.S08');
  assert.deepEqual(spec.screens.map(s => s.sourceExerciseNumber), [1, 2, 4, 5, 6, 7, 8, 9]);
  assert.equal(get('readiness').getLessonReadiness(spec).scoredLaunchReady, true);
  const broken = structuredClone(pack); broken.completion.optionalSurfaces[0].screenId = pack.screens[6].screenId;
  assert.throws(() => get('content-registry').assertContentAlignment(broken, spec));
  assert.equal(get('content-readiness').getPackReadiness(broken).playable, false);
  const wrongActivity = structuredClone(pack); wrongActivity.completion.optionalSurfaces[0].sourceActivityId = 'wrong';
  assert.throws(() => get('content-registry').assertContentAlignment(wrongActivity, spec));
});

test('pass reporting is configurable and separate from completion, using raw accuracy at a boundary', () => {
  const m = get('runner'), p = fixture(), result = { correct: 4, graded: 5, percent: 80, completionEligible: true };
  assert.equal(m.getPassOutcome(p, result), null);
  p.passPolicy = { kind: 'accuracy_threshold', minimumPercent: 80 };
  assert.equal(m.getPassOutcome(p, result), true);
  assert.equal(m.getPassOutcome(p, { ...result, correct: 11, graded: 14, percent: 79 }), false);
  assert.equal(result.completionEligible, true);
  assert.equal(m.getPassOutcome(p, { ...result, completionEligible: false }), null);
  assert.equal(get('content-readiness').getPackReadiness({ ...p, passPolicy: { kind: 'accuracy_threshold', minimumPercent: 101 } }).playable, false);
});

test('ordering uses distinct identities, supports partial removal/reinsertion, and grades only the final placement', () => {
  const p = fixture(), m = get('attempt'), runner = get('runner');
  let state = m.initialAttemptState(p); const screenId = p.screens[0].screenId;
  const send = action => { state = m.evaluateAction(p, state, { ...action, screenId }); state = JSON.parse(JSON.stringify(state)); };
  assert.deepEqual(state.slots, [null, null, null]);
  send({ type: 'token', id: 'b' });
  assert.equal(state.phase, 'response'); assert.deepEqual(state.outcomes, {});
  assert.throws(() => send({ type: 'token', id: 'b' }));
  send({ type: 'remove_token', slot: 0 });
  assert.deepEqual(runner.getTokenBank(p.screens[0], state).map(t => t.id), ['a', 'c', 'b']);
  send({ type: 'token', id: 'b' }); send({ type: 'token', id: 'a' }); send({ type: 'token', id: 'c' });
  assert.equal(state.phase, 'feedback'); assert.equal(state.outcomes[0].correct, true);
  assert.throws(() => send({ type: 'remove_token', slot: 0 }));
  send({ type: 'continue' }); assert.equal(m.attemptResult(p, state).percent, 100);
});

test('ordering rejects malformed permutations and preserves final wrong-answer feedback', () => {
  const p = fixture(), m = get('attempt'); let state = m.initialAttemptState(p);
  for (const id of ['c', 'a', 'b']) state = m.evaluateAction(p, state, { type: 'token', id, screenId: p.screens[0].screenId });
  assert.equal(state.outcomes[0].correct, false);
  for (const orders of [[['a', 'a', 'c']], [['a', 'c']], [['a', 'b', 'unknown']], []]) {
    p.screens[0].answer.acceptedOrders = orders;
    assert.equal(get('content-readiness').getPackReadiness(p).playable, false);
  }
});

test('ordering UI has numbered removable chunks, stable bank positions and no early feedback', () => {
  const p = fixture(), m = get('attempt'), Renderer = loadCourseModule('components/busuu/LessonScreen.tsx').default;
  let state = m.initialAttemptState(p); state = m.evaluateAction(p, state, { type: 'token', id: 'b', screenId: p.screens[0].screenId });
  const html = renderToStaticMarkup(React.createElement(Renderer, { screen: p.screens[0], state, dispatch() {} }));
  assert.match(html, /Remove とか from position 1/); assert.match(html, /Available chunks/);
  assert.doesNotMatch(html, /Fixture explanation/);
});

test('all registered chapter core packs align, finish, and preserve reviewed Japanese response order', () => {
  for (const [id, values] of Object.entries(chapterOneResponses)) {
    const spec = get('inventory').getLessonSpec(id), { pack } = get('attempt-server').coursePack(id), m = get('attempt');
    assert.equal(get('readiness').getLessonReadiness(spec).scoredLaunchReady, true);
    let state = m.initialAttemptState(pack);
    for (const [i, s] of pack.screens.entries()) {
      assert.equal(state.index, i); assert.deepEqual(s.unresolved, []);
      assert.deepEqual(s.sourceContract.recordedSupport, spec.screens[i].rawSupport);
      assert.equal(s.sourceContract.responseSlotCount, spec.screens[i].rawResponseSlotCount);
      const send = action => { state = m.evaluateAction(pack, state, { ...action, screenId: s.screenId }); };
      if (!state.audioReady) send({ type: 'audio_ready' }); // legacy stream: playback recorded before answering
      for (const [j, value] of values[i].entries()) send(chapterAction(s, value, j));
      if (s.answer) {
        assert.equal(state.phase, 'feedback'); assert.equal(state.outcomes[i].correct, true);
        const built = s.answer.kind === 'ordered_tokens' ? values[i].map(id => s.answer.tokens.find(t => t.id === id).text).join('')
          : s.answer.kind === 'ordered_slots' ? s.scaffold.reduce((all, part, k) => all + (k ? s.answer.tokens.find(t => t.id === values[i][k - 1]).text : '') + part, '') : null;
        if (built) assert.equal(built, s.audio.text, `${s.screenId}: scaffold/chunks agree with Japanese audio and correction`);
      }
      send({ type: 'continue' });
    }
    const result = m.attemptResult(pack, state);
    assert.equal(result.completionEligible, true); assert.equal(result.percent, 100);
    assert.equal(result.graded, id.endsWith('L04') ? 6 : id.endsWith('L05') ? 6 : 14);
    assert.equal(state.visited.length, pack.baseScreenCount);
    assert.equal(get('runner').getPassOutcome(pack, result), null);
    assert.throws(() => m.evaluateAction(pack, state, { type: 'continue', screenId: `${id}.A01.S08` }));
  }
});

test('new packs give wrong answers final correction, including reversed culture/interest and repeated kana', () => {
  const m = get('attempt');
  for (const id of Object.keys(chapterOneResponses)) {
    const pack = get('content-registry').getContentPack(id);
    for (const [i, s] of pack.screens.entries()) {
      if (!s.answer) continue;
      let state = { ...m.initialAttemptState(pack), index: i, phase: 'response', audioReady: true, slots: s.answer.kind === 'ordered_slots' ? s.answer.slots.map(() => null) : s.answer.kind === 'ordered_tokens' ? s.answer.tokens.map(() => null) : [] };
      const send = action => { state = m.evaluateAction(pack, state, { ...action, screenId: s.screenId }); };
      if (s.renderer === 'pairs') {
        send({ type: 'pair', side: 'left', id: 'formal' }); send({ type: 'pair', side: 'right', id: 'toka' });
        for (const [j, value] of chapterOneResponses[id][i].entries()) send(chapterAction(s, value, j));
      } else if (s.renderer === 'truth') send({ type: 'truth', value: !chapterOneResponses[id][i][0] });
      else if (s.renderer === 'choice') send({ type: 'choice', id: s.answer.options.find(o => !s.answer.acceptedOptionIds.includes(o.id)).id });
      else {
        const wrong = s.answer.kind === 'ordered_tokens' ? [...chapterOneResponses[id][i]].reverse()
          : s.answer.tokens.filter(t => !s.answer.slots[0].acceptedTokenIds.includes(t.id)).map(t => t.id).slice(0, 1);
        while (wrong.length < state.slots.length) wrong.push(s.answer.tokens.find(t => !wrong.includes(t.id)).id);
        for (const token of wrong) send({ type: 'token', id: token });
      }
      assert.equal(state.phase, 'feedback'); assert.equal(state.outcomes[i].correct, false, s.screenId);
      assert.equal(m.attemptResult(pack, state).completionEligible, false);
      assert.ok(get('runner').getVisibleSupport(s, 'feedback').some(b => b.kind === 'explanation'));
    }
  }
});

test('new listening hides support, model translations are reachable, and optional writing excludes speaking', () => {
  const Renderer = loadCourseModule('components/busuu/LessonScreen.tsx').default, m = get('attempt');
  for (const id of Object.keys(chapterOneResponses)) {
    const pack = get('content-registry').getContentPack(id);
    for (const [i, s] of pack.screens.entries()) {
      const html = renderToStaticMarkup(React.createElement(Renderer, { screen: s, state: { ...m.initialAttemptState(pack), index: i, phase: 'response', audioReady: true }, dispatch() {} }));
      if (s.sourceContract.transcriptBeforeAnswer === false) {
        assert.ok(!html.includes(s.audio.text)); assert.deepEqual(get('runner').getVisibleSupport(s, 'response'), []);
        assert.ok(s.support.after.some(b => b.kind === 'japanese' && b.text === s.audio.text));
      }
      if (s.renderer === 'model') { assert.equal(s.support.after.length, 0); assert.ok(s.support.before.some(b => b.kind === 'translation')); }
    }
  }
  const surface = get('content-registry').getContentPack('B2.C01.L05').completion.optionalSurfaces[0];
  assert.deepEqual(surface.modes, ['write']);
  const Optional = loadCourseModule('components/busuu/OptionalProduction.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Optional, { surface }));
  assert.match(html, /Write a draft/); assert.match(html, /ungraded/);
  assert.doesNotMatch(html, /speak|pronunciation|microphone|recording|speech/i);
  const wrongMode = structuredClone(get('content-registry').getContentPack('B2.C01.L05'));
  wrongMode.completion.optionalSurfaces[0].modes = ['speak'];
  assert.equal(get('content-readiness').getPackReadiness(wrongMode).playable, false);
});

test('chapter map reaches 100% from six unique core completions without any production record', () => {
  const chapter = get('inventory').getLevelInventory('B2').chapters[0];
  assert.equal(chapter.entries.length, 6);
  const rows = chapter.entries.map(e => ({ record_id: e.id, completed_at: 'saved', state: { phase: 'result', preview: false }, result: { completionEligible: true, percent: 60 } }));
  const progress = get('progress').savedCourseProgress([...rows, ...rows]);
  assert.equal(get('progress').chapterCompletion(chapter, progress), 100);
  assert.deepEqual(Object.keys(progress), chapter.entries.map(e => e.id));
});

test('optional writing opens, edits and closes locally without lesson actions', () => {
  let index = 0; const values = [false, ''];
  const Optional = loadCourseModule('components/busuu/OptionalProduction.tsx', {
    react: { ...React, useState: () => { const i = index++; return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value; }]; } },
  }).default;
  const surface = get('content-registry').getContentPack('B2.C01.L05').completion.optionalSurfaces[0];
  const render = () => { index = 0; return Optional({ surface }); };
  const elements = node => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(elements)];
  let view = render(); let nodes = elements(view);
  assert.equal(nodes.some(n => n.type === 'textarea'), false);
  nodes.find(n => n.type === 'button').props.onClick();
  view = render(); nodes = elements(view);
  nodes.find(n => n.type === 'textarea').props.onChange({ target: { value: '京都とか奈良とかに行きたいです。' } });
  nodes = elements(render()); assert.equal(nodes.find(n => n.type === 'textarea').props.value, '京都とか奈良とかに行きたいです。');
  nodes.find(n => n.type === 'button').props.onClick();
  assert.equal(elements(render()).some(n => n.type === 'textarea'), false);
  assert.equal(values[1], '京都とか奈良とかに行きたいです。');
});
