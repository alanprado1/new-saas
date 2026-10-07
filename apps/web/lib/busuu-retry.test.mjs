import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from './busuu-test-helpers.mjs';
const get = f => loadCourseModule(`lib/busuu/${f}.ts`);
const fixture = (retry = true) => ({ schemaVersion: '1.0', contentVersion: '1.0.0', recordId: 'B2.C03.L02', status: 'reviewed', baseScreenCount: 2,
  ...(retry ? { retryPolicy: { kind: 'end_once', screenIds: ['B2.C03.L02.A01.S01'] } } : {}), screens: [
    { screenId: 'B2.C03.L02.A01.S01', renderer: 'truth', truthMode: 'audio_only', prompt: 'Listen and judge.', statement: 'The speaker arrived late.',
      answer: { kind: 'truth', accepted: false }, sourceContract: { transcriptBeforeAnswer: false }, praise: 'Well done!',
      support: { before: [], after: [{ kind: 'japanese', text: '早く着きました。' }, { kind: 'translation', text: 'I arrived early.' }, { kind: 'explanation', text: '早く is early.' }] },
      audio: { required: true, text: '早く着きました。' }, visual: 'none', evidence: [], unresolved: [] },
    { screenId: 'B2.C03.L02.A01.S02', renderer: 'model', prompt: 'Read.', answer: null, praise: null,
      support: { before: [{ kind: 'japanese', text: 'また来ます。' }], after: [] }, audio: { required: false, text: null }, visual: 'none', evidence: [], unresolved: [] }
  ] });
const respondBase = (p, correct) => {
  const m = get('attempt'), id = p.screens[0].screenId;
  let s = m.initialAttemptState(p);
  s = m.evaluateAction(p, s, { type: 'audio_ready', screenId: id });
  s = m.evaluateAction(p, s, { type: 'truth', screenId: id, value: !correct });
  s = m.evaluateAction(p, s, { type: 'continue', screenId: id });
  return m.evaluateAction(p, s, { type: 'continue', screenId: p.screens[1].screenId });
};
test('failed configured listening returns once after base sequence without changing first-attempt accuracy', () => {
  const p = fixture(), m = get('attempt'); let s = respondBase(p, false);
  assert.equal(s.phase, 'response'); assert.equal(s.index, 0); assert.deepEqual(s.visited, [0,1]);
  assert.equal(s.audioReady, false); assert.deepEqual(s.retry, { queue: [0], position: 0, outcomes: {} });
  assert.equal(m.attemptResult(p, s).completionEligible, false);
  assert.doesNotThrow(() => m.evaluateAction(p, s, { type: 'truth', screenId: p.screens[0].screenId, value: false })); // no playback required before answering the retry
  s = JSON.parse(JSON.stringify(s));
  s = m.evaluateAction(p, s, { type: 'audio_ready', screenId: p.screens[0].screenId });
  s = m.evaluateAction(p, s, { type: 'truth', screenId: p.screens[0].screenId, value: false });
  assert.equal(s.outcomes[0].correct, false); assert.equal(s.retry.outcomes[0].correct, true);
  assert.equal(get('runner').getCurrentOutcome(s).correct, true);
  assert.throws(() => m.evaluateAction(p, s, { type: 'truth', screenId: p.screens[0].screenId, value: true }));
  s = m.evaluateAction(p, s, { type: 'continue', screenId: p.screens[0].screenId });
  assert.equal(s.phase, 'result');
  assert.deepEqual(m.attemptResult(p, s), { correct: 0, graded: 1, percent: 0, completionEligible: true, retry: { attempted: 1, correct: 1, total: 1, complete: true } });
});
test('end retry is one pass, wrong retry still completes; correct base answer schedules no retry', () => {
  const p = fixture(), m = get('attempt'); let s = respondBase(p, false), screenId = p.screens[0].screenId;
  s = m.evaluateAction(p, s, { type: 'audio_ready', screenId });
  s = m.evaluateAction(p, s, { type: 'truth', screenId, value: true });
  s = m.evaluateAction(p, s, { type: 'continue', screenId });
  assert.equal(s.phase, 'result'); assert.deepEqual(m.attemptResult(p,s).retry, { attempted:1,correct:0,total:1,complete:true });
  const perfect = respondBase(p, true); assert.equal(perfect.phase, 'result'); assert.equal(perfect.retry, undefined);
  assert.deepEqual(m.attemptResult(p,perfect).retry, { attempted:0,correct:0,total:0,complete:true });
});
test('unconfigured packs keep exact old state/results and reject fabricated retry payloads', () => {
  const p = fixture(false), m = get('attempt'), s = respondBase(p,false);
  assert.equal(s.retry, undefined); assert.deepEqual(m.attemptResult(p,s), { correct:0,graded:1,percent:0,completionEligible:true });
  for (const action of [{ type:'retry', screenId:p.screens[0].screenId }, { type:'continue',screenId:p.screens[0].screenId,retry:true }]) assert.throws(() => m.validateAction(action));
});
test('retry policy permits only unique existing transcript-free listening response occurrences', () => {
  const m = get('content-readiness');
  for (const screenIds of [[], ['missing'], ['B2.C03.L02.A01.S02'], ['B2.C03.L02.A01.S01','B2.C03.L02.A01.S01']]) {
    const p = fixture(); p.retryPolicy.screenIds = screenIds; assert.equal(m.getPackReadiness(p).playable, false);
  }
});
test('multiple configured failures retry in canonical order with separate immutable outcomes', () => {
  const p = fixture(), m = get('attempt');
  p.screens[1] = { ...structuredClone(p.screens[0]), screenId: p.screens[1].screenId };
  p.retryPolicy.screenIds = p.screens.map(s => s.screenId).reverse();
  let s = m.initialAttemptState(p);
  for (const screen of p.screens) {
    s = m.evaluateAction(p,s,{type:'audio_ready',screenId:screen.screenId});
    s = m.evaluateAction(p,s,{type:'truth',screenId:screen.screenId,value:true});
    s = m.evaluateAction(p,s,{type:'continue',screenId:screen.screenId});
  }
  assert.deepEqual(s.retry.queue,[0,1]);
  for (const [i,screen] of p.screens.entries()) {
    assert.equal(s.index,i); assert.equal(s.audioReady,false);
    s = m.evaluateAction(p,s,{type:'audio_ready',screenId:screen.screenId});
    s = m.evaluateAction(p,s,{type:'truth',screenId:screen.screenId,value:false});
    s = m.evaluateAction(p,s,{type:'continue',screenId:screen.screenId});
  }
  assert.equal(s.phase,'result'); assert.deepEqual(s.outcomes,{0:{correct:false},1:{correct:false}});
  assert.deepEqual(m.attemptResult(p,s).retry,{attempted:2,correct:2,total:2,complete:true});
});
test('retry UI shows separate progress and current feedback, and results label first-attempt accuracy', () => {
  const p = fixture(), m = get('attempt'), screenId = p.screens[0].screenId;
  let s = respondBase(p,false);
  const render = state => {
    let first = true;
    const Runner = loadCourseModule('components/busuu/LessonRunner.tsx',{react:{...React,useState(initial){
      const value = first ? state : initial; first = false;
      return React.useState(value);
    }}}).default;
    return renderToStaticMarkup(React.createElement(Runner,{pack:p,preview:true,title:'Listening',returnHref:'/busuu/B2',onExit(){}}));
  };
  assert.doesNotMatch(render(s),/Listening retry|Activity retry|Try this task once more|base screens/); // retried screens look like the originals
  assert.match(render(s),/aria-label="Activity progress"/);
  s = m.evaluateAction(p,s,{type:'audio_ready',screenId});
  s = m.evaluateAction(p,s,{type:'truth',screenId,value:false});
  assert.match(render(s),/Well done!|Nice work|You got it|Amazing work!|You’re improving/); assert.doesNotMatch(render(s),/>Review the answer</);
  s = m.evaluateAction(p,s,{type:'continue',screenId});
  const result = render(s);
  assert.match(result,/>Score</); assert.match(result,/>Retried</); assert.match(result,/1 of 1/); assert.doesNotMatch(result,/server-confirmed|base screens|Retry outcomes are separate/);
});
