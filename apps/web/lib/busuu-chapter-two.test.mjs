import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from './busuu-test-helpers.mjs';
import { chapterTwoResponses, chapterTwoAction } from './busuu-chapter-two-responses.mjs';
import fs from 'node:fs';
const get = f => loadCourseModule(`lib/busuu/${f}.ts`);
const fixture = screen => ({ schemaVersion: '1.0', contentVersion: '1.0.0', recordId: 'B2.C02.L06', status: 'reviewed', baseScreenCount: 1,
  screens: [{ screenId: 'B2.C02.L06.A01.S01', renderer: 'typed', prompt: 'Type the reading stem before がり.',
    typed: { label: 'Reading stem', before: '怖', after: 'がり' }, answer: { kind: 'typed', acceptedForms: ['こわ'], normalization: 'nfkc_trim' },
    support: { before: [], after: [{ kind: 'explanation', text: 'こわ is the stem; がり is supplied.' }] }, praise: 'Well done!',
    audio: { required: false, text: null }, visual: 'none', evidence: [], unresolved: [], ...screen }] });

test('typed drafts resume without grading; explicit Check locks a reviewed normalized answer', () => {
  const p = fixture(), m = get('attempt');
  assert.equal(get('content-readiness').getPackReadiness(p).playable, true);
  let state = m.initialAttemptState(p); const screenId = p.screens[0].screenId;
  assert.throws(() => m.evaluateAction(p, state, { type: 'typed_check', screenId }));
  state = m.evaluateAction(p, state, { type: 'typed_draft', screenId, text: 'こ' });
  state = JSON.parse(JSON.stringify(state)); assert.equal(state.typedDraft, 'こ'); assert.deepEqual(state.outcomes, {});
  state = m.evaluateAction(p, state, { type: 'typed_draft', screenId, text: '　こわ　' });
  state = m.evaluateAction(p, state, { type: 'typed_check', screenId });
  assert.equal(state.phase, 'feedback'); assert.equal(state.outcomes[0].correct, true);
  assert.throws(() => m.evaluateAction(p, state, { type: 'typed_draft', screenId, text: 'wrong' }));
  state = m.evaluateAction(p, state, { type: 'continue', screenId }); assert.equal(m.attemptResult(p, state).percent, 100);
});

test('typed checks do not infer script equivalence or accept the supplied suffix twice', () => {
  const m = get('attempt');
  for (const value of ['こ', 'こわがり', '怖', 'kowa', 'コワ', 'こ わ']) {
    const p = fixture(), screenId = p.screens[0].screenId;
    let state = m.evaluateAction(p, m.initialAttemptState(p), { type: 'typed_draft', screenId, text: value });
    state = m.evaluateAction(p, state, { type: 'typed_check', screenId }); assert.equal(state.outcomes[0].correct, false, value);
  }
  const p = fixture({ answer: { kind: 'typed', acceptedForms: ['あまい', '甘い'], normalization: 'nfkc_trim' } });
  for (const text of ['あまい', '甘い', '　甘い ']) {
    let state = m.evaluateAction(p, m.initialAttemptState(p), { type: 'typed_draft', screenId: p.screens[0].screenId, text });
    state = m.evaluateAction(p, state, { type: 'typed_check', screenId: p.screens[0].screenId }); assert.equal(state.outcomes[0].correct, true);
  }
});

test('typed event shapes are bounded and server-authoritative; draft clearing is allowed', () => {
  const m = get('attempt'), p = fixture(), screenId = p.screens[0].screenId;
  for (const action of [{ type: 'typed_draft', screenId, text: 1 }, { type: 'typed_draft', screenId, text: 'a'.repeat(101) },
    { type: 'typed_check', screenId, correct: true }, { type: 'typed_draft', screenId, text: 'a', score: 100 },
    { type: 'typed_draft', screenId, text: '\u0000' }, { type: 'typed_draft', screenId, text: '\ud800' }]) assert.throws(() => m.validateAction(action));
  let state = m.evaluateAction(p, m.initialAttemptState(p), { type: 'typed_draft', screenId, text: 'こ' });
  state = m.evaluateAction(p, state, { type: 'typed_draft', screenId, text: '' });
  assert.equal(state.typedDraft, ''); assert.throws(() => m.evaluateAction(p, state, { type: 'typed_check', screenId }));
  assert.throws(() => m.evaluateAction(p, state, { type: 'choice', screenId, id: 'fake' }));
});

test('audio-only truth requires hidden source and playback while supported truth stays strict', () => {
  const s = { renderer: 'truth', truthMode: 'audio_only', statement: 'The speaker likes winter.', answer: { kind: 'truth', accepted: false },
    sourceContract: { transcriptBeforeAnswer: false }, audio: { required: true, text: '寒がりなので、冬は苦手です。' },
    support: { before: [], after: [{ kind: 'japanese', text: '寒がりなので、冬は苦手です。' }, { kind: 'translation', text: 'I am sensitive to cold, so winter is difficult for me.' }, { kind: 'explanation', text: 'This is the opposite of liking winter.' }] } };
  const p = fixture(s), m = get('attempt'), screenId = p.screens[0].screenId;
  assert.equal(get('content-readiness').getPackReadiness(p).playable, true);
  let state = m.initialAttemptState(p); assert.doesNotThrow(() => m.evaluateAction(p, state, { type: 'truth', screenId, value: false })); // answering without playback is accepted
  state = m.evaluateAction(p, state, { type: 'audio_ready', screenId });
  const Renderer = loadCourseModule('components/busuu/LessonScreen.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Renderer, { screen: p.screens[0], state, dispatch() {} }));
  assert.ok(!html.includes(s.audio.text)); assert.ok(!html.includes(s.support.after[1].text)); assert.match(html, /The speaker likes winter/);
  state = m.evaluateAction(p, state, { type: 'truth', screenId, value: false }); assert.equal(state.outcomes[0].correct, true);
  for (const changes of [{ truthMode: undefined }, { audio: { required: false, text: s.audio.text } }, { sourceContract: { transcriptBeforeAnswer: true } }])
    assert.equal(get('content-readiness').getPackReadiness(fixture({ ...s, ...changes })).playable, false);
});

test('fixed prefix is outside six selectable chunks and survives removal/reinsertion', () => {
  const p = fixture({ renderer: 'ordering', fixedPrefix: '兄は、', answer: { kind: 'ordered_tokens', tokens: [
    { id: 'a', text: 'のんびり' }, { id: 'b', text: 'していますが、' }, { id: 'c', text: '妹は' }, { id: 'd', text: 'じつは' }, { id: 'e', text: 'まじめ' }, { id: 'f', text: 'です。' }], acceptedOrders: [['a','b','c','d','e','f']] }, sourceContract: { responseSlotCount: 6 } });
  const m = get('attempt'), screenId = p.screens[0].screenId; let state = m.initialAttemptState(p);
  assert.equal(get('content-readiness').getPackReadiness(p).playable, true); assert.equal(state.slots.length, 6);
  state = m.evaluateAction(p, state, { type: 'token', screenId, id: 'a' });
  state = m.evaluateAction(p, state, { type: 'remove_token', screenId, slot: 0 }); assert.equal(state.slots[0], null);
  const Renderer = loadCourseModule('components/busuu/LessonScreen.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Renderer, { screen: p.screens[0], state, dispatch() {} })); assert.match(html, /兄は、/);
  for (const id of ['a','b','c','d','e','f']) state = m.evaluateAction(p, state, { type: 'token', screenId, id });
  assert.equal(state.outcomes[0].correct, true);
});

test('IME Enter cannot submit during composition or keycode 229', () => {
  const m = get('typed-input');
  assert.equal(m.canCheckTyped('こわ', false), true); assert.equal(m.canCheckTyped('　 ', false), false);
  for (const e of [{ key: 'Enter', isComposing: true }, { key: 'Enter', keyCode: 229 }, { key: 'a' }]) assert.equal(m.isTypedCheckKey(e, false), false);
  assert.equal(m.isTypedCheckKey({ key: 'Enter' }, true), false); assert.equal(m.isTypedCheckKey({ key: 'Enter' }, false), true);
});

test('all eight real registered packs align with 111 source surfaces and complete 110 required screens', () => {
  const raw = JSON.parse(fs.readFileSync(new URL('../content/busuu/b2-structure.json', import.meta.url))).records;
  let total = 0, sourceTotal = 0;
  for (const [id, responses] of Object.entries(chapterTwoResponses)) {
    const spec = get('inventory').getLessonSpec(id), { pack } = get('attempt-server').coursePack(id), m = get('attempt');
    assert.equal(get('readiness').getLessonReadiness(spec).scoredLaunchReady, true, id);
    assert.equal(responses.length, pack.baseScreenCount); total += pack.baseScreenCount; sourceTotal += spec.baseScreenCount;
    const original = raw.find(r => r.recordId === id); get('content-registry').assertContentAlignment(pack, original);
    assert.deepEqual([...pack.screens, ...(pack.completion?.optionalSurfaces ?? [])].map(s => s.screenId), spec.activities.flatMap(a => a.screenIds));
    let state = m.initialAttemptState(pack);
    for (const [i, s] of pack.screens.entries()) {
      assert.equal(state.index, i); assert.equal(state.typedDraft, s.renderer === 'typed' ? '' : undefined);
      assert.deepEqual(s.sourceContract.recordedSupport, spec.screens[i].rawSupport); assert.equal(s.sourceContract.responseSlotCount, spec.screens[i].rawResponseSlotCount);
      assert.equal(s.sourceContract.sourceActivityId, spec.screens[i].sourceActivityId); assert.deepEqual(s.unresolved, []);
      const send = action => { state = m.evaluateAction(pack, state, { ...action, screenId: s.screenId }); };
      if (!state.audioReady) send({ type: 'audio_ready' });
      for (const [j, value] of responses[i].entries()) send(chapterTwoAction(s, value, j, state));
      if (s.renderer === 'typed') { assert.deepEqual(state.outcomes[i], undefined); send({ type: 'typed_check' }); }
      if (s.answer) {
        assert.equal(state.phase, 'feedback'); assert.equal(state.outcomes[i].correct, true, s.screenId);
        const built = s.renderer === 'ordering' ? (s.fixedPrefix ?? '') + responses[i].join('') : s.renderer === 'gaps'
          ? s.scaffold.reduce((a, p, k) => a + (k ? responses[i][k-1] : '') + p, '') : null;
        if (built) assert.equal(built, s.audio.text, `${s.screenId}: Japanese response agrees with source audio/correction`);
      }
      send({ type: 'continue' });
    }
    assert.equal(m.attemptResult(pack, state).completionEligible, true); assert.equal(m.attemptResult(pack, state).percent, 100);
    assert.equal(state.visited.length, pack.baseScreenCount); assert.equal(get('runner').getPassOutcome(pack, m.attemptResult(pack, state)), null);
  }
  assert.equal(total, 110); assert.equal(sourceTotal, 111);
  assert.equal(raw.find(r => r.recordId === 'B2.C02.L06').optionalProduction, null);
  const l06 = get('inventory').getLessonSpec('B2.C02.L06'); assert.equal(l06.optionalProduction.coreTeachingScreenCount, 8);
  assert.deepEqual(l06.screens.map(s => s.sourceExerciseNumber), [1,2,4,5,6,7,8,9,10]);
  assert.deepEqual(l06.contentPack.completion.optionalSurfaces[0].modes, ['write']);
  const cp = get('content-registry').getContentPack('B2.C02.CP'); assert.equal(cp.screens[19].sourceContract.responseSlotCount, null);
  for (const id of ['B2.C02.L02', 'B2.C02.L07']) assert.equal(get('inventory').getLessonSpec(id).activities.length, 2);
});

test('new kanji models require full shape/readings/meaning/context and all listening DOM stays transcript-free', () => {
  const Renderer = loadCourseModule('components/busuu/LessonScreen.tsx').default;
  const models = [];
  for (const id of Object.keys(chapterTwoResponses)) for (const s of get('content-registry').getContentPack(id).screens) {
    const html = renderToStaticMarkup(React.createElement(Renderer, { screen: s, state: { phase: 'response', audioReady: true, slots: [], matches: [], typedDraft: 'こ' }, dispatch() {} }));
    if (s.sourceContract.transcriptBeforeAnswer === false) {
      assert.ok(!html.includes(s.audio.text), s.screenId); assert.ok(!html.includes(s.support.after.find(b => b.kind === 'translation')?.text));
      assert.deepEqual(get('runner').getVisibleSupport(s, 'response'), []);
    }
    if (s.renderer === 'kanji') {
      models.push(s.kanji.character); const card = renderToStaticMarkup(React.createElement(loadCourseModule('components/busuu/LessonScreen.tsx').KanjiCard, { screen: s, audio: null })); assert.doesNotMatch(html + card, /Static shape study|animation replacement/i); assert.ok(card.includes(s.kanji.character));
      for (const field of ['shapeNote','meaning','readings','examples']) {
        const broken = structuredClone(s); broken.kanji[field] = Array.isArray(broken.kanji[field]) ? [] : '';
        assert.ok(get('content-readiness').getScreenContentGaps(broken).some(g => g.field === 'kanji'));
      }
    }
    if (s.renderer === 'model') assert.ok(s.support.before.some(b => b.kind === 'translation'));
    if (s.renderer === 'typed') { assert.match(html, /Check/); assert.ok(html.includes(s.typed.after)); assert.ok(!html.includes('acceptedForms')); }
  }
  assert.deepEqual(models, ['参','実','然','特','例','優','怖','寒','暑','悪']);
});

test('optional projection cannot exclude required activities and old schema state shapes stay unchanged', () => {
  const registry = get('content-registry'), spec = get('inventory').getLessonSpec('B2.C02.L06'), pack = structuredClone(spec.contentPack);
  pack.screens.pop(); pack.baseScreenCount--; pack.completion.requiredScreenIds.pop(); assert.throws(() => registry.assertContentAlignment(pack, spec));
  const fake = structuredClone(spec); fake.optionalProduction = null; fake.screens[8].rawRenderer = 'audio_gap';
  assert.throws(() => registry.assertContentAlignment(spec.contentPack, fake));
  const m = get('attempt'), runner = get('runner');
  for (const [id, version] of [['B2.C01.L01','1.0.0'],['B2.C01.L02','1.1.0'],['B2.C01.L03','1.1.0'],['B2.C01.L05','1.0.0']]) {
    const p = registry.getContentPack(id, version), state = m.initialAttemptState(p); assert.equal(Object.hasOwn(state, 'typedDraft'), false);
    assert.equal(Object.hasOwn(runner.createLessonState(p), 'typedDraft'), false);
    assert.throws(() => m.evaluateAction(p, state, { type: 'typed_draft', screenId: p.screens[0].screenId, text: 'a' }));
  }
});

test('reviewed sister-topic and actually orders are both accepted after the fixed start', () => {
  const m = get('attempt');
  for (const [id, i] of [['B2.C02.L06',7],['B2.C02.CP',12]]) {
    const p = get('content-registry').getContentPack(id), s = p.screens[i];
    let state = { ...m.initialAttemptState(p), index: i, phase: 'response', audioReady: true, slots: s.answer.tokens.map(() => null) };
    for (const id of ['t0','t1','t3','t2','t4','t5']) state = m.evaluateAction(p, state, { type: 'token', screenId: s.screenId, id });
    assert.equal(state.outcomes[i].correct, true, s.screenId);
  }
});

test('typed component preserves IME confirmation, saves drafts, and checks only committed input', () => {
  const refs = [], values = []; let refIndex = 0, valueIndex = 0, prevented = 0;
  const Typed = loadCourseModule('components/busuu/LessonScreen.tsx', { react: { ...React,
    useRef: v => refs[refIndex++] ?? (refs[refIndex - 1] = { current: v }),
    useState: v => { const i = valueIndex++; values[i] ??= v; return [values[i], value => { values[i] = value; }]; },
  } }).TypedAnswer;
  const p = fixture(), s = p.screens[0], m = get('attempt'); let state = m.initialAttemptState(p); const actions = [];
  const dispatch = action => { actions.push(action); state = get('runner').transitionLesson(p, state, action); };
  const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...React.Children.toArray(n.props?.children).flatMap(nodes)];
  const view = () => { refIndex = 0; valueIndex = 0; return nodes(Typed({ screen: s, state, dispatch })); };
  const input = () => view().find(n => n.type === 'input'), button = () => view().find(n => n.type === 'button');
  assert.equal(button().props.disabled, true);
  input().props.onCompositionStart(); input().props.onChange({ target: { value: 'こ' } });
  assert.equal(state.typedDraft, 'こ'); assert.equal(button().props.disabled, true);
  input().props.onKeyDown({ key: 'Enter', nativeEvent: { key: 'Enter', isComposing: true, keyCode: 229 }, preventDefault() { prevented++; } });
  button().props.onClick(); assert.deepEqual(state.outcomes, {}); assert.equal(prevented, 0);
  input().props.onCompositionEnd({ currentTarget: { value: 'こわ' } }); assert.equal(state.typedDraft, 'こわ');
  assert.equal(button().props.disabled, false);
  input().props.onKeyDown({ key: 'Enter', nativeEvent: { key: 'Enter', keyCode: 229 }, preventDefault() { prevented++; } });
  assert.deepEqual(state.outcomes, {}); assert.equal(prevented, 0);
  input().props.onKeyDown({ key: 'Enter', nativeEvent: { key: 'Enter' }, preventDefault() { prevented++; } });
  assert.equal(prevented, 1); assert.equal(state.outcomes[0].correct, true); assert.equal(input().props.disabled, true);
  button().props.onClick(); assert.equal(actions.filter(a => a.type === 'typed_check').length, 1);
});
