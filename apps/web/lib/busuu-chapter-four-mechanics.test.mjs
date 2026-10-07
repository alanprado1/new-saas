import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from './busuu-test-helpers.mjs';
const get = f => loadCourseModule(`lib/busuu/${f}.ts`);
const screen = (id, overrides = {}) => ({ screenId: `B2.C04.L01.${id}`, renderer: 'model', prompt: 'Read.', answer: null, praise: null,
  support: { before: [{ kind: 'japanese', text: '勝ちます。' }], after: [] }, audio: { required: false, text: null }, visual: 'none', evidence: [], unresolved: [], ...overrides });
const response = { praise: 'Well done!', support: { before: [], after: [{ kind: 'explanation', text: 'Review the forms.' }] } };
const pack = screens => ({ schemaVersion: '1.0', contentVersion: '1.0.0', recordId: 'B2.C04.L01', status: 'reviewed', baseScreenCount: screens.length, screens });
const multi = () => pack([screen('A01.S01', { ...response, renderer: 'multi_choice', answer: { kind: 'multi_choice', requiredCount: 2, grading: 'exact_set',
  options: [{ id: 'run', text: '走れ' }, { id: 'come', text: '来い' }, { id: 'te', text: '走って' }], acceptedOptionIds: ['run', 'come'] } })]);
const boundary = () => ({ ...pack([
  screen('A01.S01', { ...response, renderer: 'gaps', scaffold: ['勝', 'ます、勝', 'て、待', 'ます、待', 'て。'],
    answer: { kind: 'ordered_slots', tokens: [{ id: 'chi1', text: 'ち' }, { id: 'tte1', text: 'っ' }, { id: 'chi2', text: 'ち' }, { id: 'tte2', text: 'っ' }, { id: 'wrong', text: 'つ' }],
      slots: [{ id: 's1', acceptedTokenIds: ['chi1', 'chi2'] }, { id: 's2', acceptedTokenIds: ['tte1', 'tte2'] }, { id: 's3', acceptedTokenIds: ['chi1', 'chi2'] }, { id: 's4', acceptedTokenIds: ['tte1', 'tte2'] }] } }),
  screen('A01.S02'), screen('A02.S01')]), retryPolicy: { kind: 'after_activity_once', screenIds: ['B2.C04.L01.A01.S01'] } });
const send = (p, s, a) => get('attempt').evaluateAction(p, s, { screenId: p.screens[s.index].screenId, ...a });
test('multi-selection is editable, bounded and ungraded until exact-count submission; replay preserves draft and feedback locks', () => {
  const p = multi(); let s = get('attempt').initialAttemptState(p);
  assert.deepEqual(s.selectedOptionIds, []);
  assert.throws(() => send(p, s, { type: 'selection_check' }));
  s = send(p, s, { type: 'toggle_option', id: 'run' });
  assert.deepEqual(s.outcomes, {}); assert.throws(() => send(p, s, { type: 'selection_check' }));
  s = send(p, s, { type: 'toggle_option', id: 'te' });
  assert.throws(() => send(p, s, { type: 'toggle_option', id: 'come' }));
  s = send(p, s, { type: 'toggle_option', id: 'te' });
  s = JSON.parse(JSON.stringify(s)); s = send(p, s, { type: 'toggle_option', id: 'come' });
  s = send(p, s, { type: 'selection_check' }); assert.equal(s.outcomes[0].correct, true);
  assert.throws(() => send(p, s, { type: 'toggle_option', id: 'run' }));
  s = send(p, s, { type: 'continue' }); assert.equal(get('attempt').attemptResult(p, s).percent, 100);
});
test('multi-selection grades exact sets without partial credit or selection-order dependency; rejects malformed and forged events', () => {
  for (const ids of [['come', 'run'], ['run', 'te']]) {
    const p = multi(); let s = get('attempt').initialAttemptState(p);
    for (const id of ids) s = send(p, s, { type: 'toggle_option', id });
    s = send(p, s, { type: 'selection_check' }); assert.equal(s.outcomes[0].correct, !ids.includes('te'));
  }
  const m = get('attempt');
  for (const a of [{ type: 'toggle_option', screenId: 'x', id: [] }, { type: 'selection_check', screenId: 'x', correct: true }, { type: 'toggle_option', screenId: 'x', id: 'run', selected: true }]) assert.throws(() => m.validateAction(a));
  const p = multi(), s = m.initialAttemptState(p);
  assert.throws(() => send(p, s, { type: 'toggle_option', id: 'forged' }));
  assert.throws(() => send(p, s, { type: 'choice', id: 'run' }));
  const legacy = pack([screen('A01.S01')]); assert.equal(m.initialAttemptState(legacy).selectedOptionIds, undefined);
  assert.throws(() => send(legacy, m.initialAttemptState(legacy), { type: 'toggle_option', id: 'run' }));
});
test('four-slot task retries once at activity boundary with reset/removable tokens, immutable accuracy and exact continuation', () => {
  for (const retryCorrect of [true, false]) {
    const p = boundary(); let s = get('attempt').initialAttemptState(p);
    for (const id of ['wrong', 'tte1', 'chi1', 'tte2']) s = send(p, s, { type: 'token', id });
    s = send(p, s, { type: 'continue' }); assert.equal(s.index, 1); assert.equal(s.retry, undefined);
    s = send(p, s, { type: 'continue' }); assert.equal(s.index, 0); assert.equal(s.phase, 'response');
    assert.deepEqual(s.visited, [0, 1]); assert.deepEqual(s.slots, [null, null, null, null]);
    s = JSON.parse(JSON.stringify(s));
    s = send(p, s, { type: 'token', id: 'chi1' }); s = send(p, s, { type: 'remove_token', slot: 0 });
    for (const id of [retryCorrect ? 'chi1' : 'wrong', 'tte1', 'chi2', 'tte2']) s = send(p, s, { type: 'token', id });
    assert.equal(s.outcomes[0].correct, false); assert.equal(get('runner').getCurrentOutcome(s).correct, retryCorrect);
    s = send(p, s, { type: 'continue' }); assert.equal(s.index, 2); assert.equal(s.retry, undefined);
    s = send(p, s, { type: 'continue' }); assert.equal(s.phase, 'result');
    assert.deepEqual(get('attempt').attemptResult(p, s), { correct: 0, graded: 1, percent: 0, completionEligible: true,
      retry: { attempted: 1, correct: Number(retryCorrect), total: 1, complete: true } });
  }
});
test('new readiness enforces exact set/count and boundary retry renderer contracts without relaxing legacy end retry', () => {
  const m = get('content-readiness'); assert.equal(m.getPackReadiness(multi()).playable, true); assert.equal(m.getPackReadiness(boundary()).playable, true);
  for (const edit of [p => p.screens[0].answer.requiredCount = 1, p => p.screens[0].answer.acceptedOptionIds = ['run', 'run'], p => p.screens[0].answer.grading = 'partial', p => p.screens[0].sourceContract = { responseSlotCount: 1 }]) {
    const p = multi(); edit(p); assert.equal(m.getPackReadiness(p).playable, false);
  }
  for (const edit of [p => p.retryPolicy.kind = 'end_once', p => p.retryPolicy.screenIds = ['B2.C04.L01.A01.S02'], p => p.retryPolicy.screenIds.push(p.retryPolicy.screenIds[0])]) {
    const p = boundary(); edit(p); assert.equal(m.getPackReadiness(p).playable, false);
  }
});
test('multi-selection UI exposes pressed states and the selected count, never answer membership before grading', () => {
  const p = multi(); let s = get('attempt').initialAttemptState(p); s = send(p, s, { type: 'toggle_option', id: 'te' });
  const Screen = loadCourseModule('components/busuu/LessonScreen.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Screen, { screen: p.screens[0], state: s, dispatch() {} }));
  assert.match(html, /aria-pressed="true"[^>]*>.*走って/); assert.doesNotMatch(html, />Check</); assert.match(html, /1 of 2 selected/); // the last required pick grades; there is no separate Check
  assert.doesNotMatch(html, /correct|acceptedOptionIds|exact_set/);
});
test('supported scene replay plays full bound dialogue in order and gates on its completion, while corrected sentence stays separate', async () => {
 const p=loadCourseModule('lib/busuu/content-registry.ts').getContentPack('B2.C04.L05');
 for(const index of [3,11,13,15]) {
  const calls=[], dispatched=[], target=p.screens[index];
  const state={phase:'response',index,preview:true,audioReady:false,visited:[],outcomes:{},slots:[],matches:[]};
  const audio={setScreen(id){calls.push(['screen',id]);},async playDialogue(items){calls.push(['dialogue',items]);return true;},async play(item){calls.push(['clip',item]);return true;}};
  let stateCount=0;
  const Runner=loadCourseModule('components/busuu/LessonRunner.tsx',{react:{...React,
   useState(initial){stateCount++;return [stateCount===1?state:stateCount===6?true:typeof initial==='function'?initial():initial,fn=>{if(typeof fn==='function')dispatched.push(fn(state));}];},
   useRef(initial){return {current:initial===null?audio:initial};},useCallback(fn){return fn;},useEffect(){}
  }}).default;
  const tree=Runner({pack:p,preview:true,title:'Games',returnHref:'/busuu/B2',onExit(){}});
  const walk=(value,out=[])=>{if(!value||typeof value!=='object')return out;if(value.type==='button')out.push(value);for(const c of [value.props?.children].flat(Infinity))walk(c,out);return out;};
  const buttons=walk(tree), replayButton=buttons.find(b=>String(b.props['aria-label']??b.props.children).includes(index===15?'Replay audio':'Replay scene'));
  assert.ok(replayButton,target.screenId); await replayButton.props.onClick();
  if(index===15) {assert.equal(calls.at(-1)[0],'clip');assert.equal(calls.at(-1)[1].text,target.audio.text);}
  else {const source=loadCourseModule('lib/busuu/content-readiness.ts').getSceneReuse(p,target);assert.equal(calls.at(-1)[0],'dialogue');assert.deepEqual(calls.at(-1)[1].map(x=>x.text),source.dialogue.turns.map(t=>t.japanese));}
  assert.equal(dispatched.at(-1).audioReady,true);
 }
});
test('ordering retry colors use the current retry outcome while preserving the false first outcome', () => {
 const p=boundary();p.screens[0]={...p.screens[0],renderer:'ordering',answer:{kind:'ordered_tokens',tokens:[{id:'a',text:'走'},{id:'b',text:'れ！'}],acceptedOrders:[['a','b']]}};
 const state={phase:'feedback',index:0,audioReady:true,slots:['a','b'],matches:[],outcomes:{0:{correct:false}},retry:{queue:[0],position:0,outcomes:{0:{correct:true}},returnIndex:2}};
 const Screen=loadCourseModule('components/busuu/LessonScreen.tsx',{'@/app/busuu/runner.module.css':{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})}}).default;
 const html=renderToStaticMarkup(React.createElement(Screen,{screen:p.screens[0],state,dispatch(){}}));
 assert.doesNotMatch(html,/class="chip incorrect"|class="answerBox incorrect"/);assert.equal((html.match(/class="chip correct"/g)||[]).length,2);
});
test('configured retries at multiple activity boundaries and the final boundary each run once; correct base answers skip them', () => {
 const task=id=>screen(id,{...response,renderer:'truth',truthMode:'audio_only',statement:'We won.',answer:{kind:'truth',accepted:false},sourceContract:{transcriptBeforeAnswer:false},
  audio:{required:true,text:'負けました。'},support:{before:[],after:[{kind:'japanese',text:'負けました。'},{kind:'translation',text:'We lost.'},{kind:'explanation',text:'負けました is lost.'}]}});
 const p={...pack([task('A01.S01'),task('A02.S01')]),retryPolicy:{kind:'after_activity_once',screenIds:['B2.C04.L01.A02.S01','B2.C04.L01.A01.S01']}};
 for(const wrong of [true,false]) {
  let s=get('attempt').initialAttemptState(p);
  for(let i=0;i<2;i++) {
   s=send(p,s,{type:'audio_ready'});s=send(p,s,{type:'truth',value:wrong});s=send(p,s,{type:'continue'});
   if(wrong) {assert.equal(s.index,i);assert.equal(s.audioReady,false);s=send(p,s,{type:'audio_ready'});s=send(p,s,{type:'truth',value:false});s=send(p,s,{type:'continue'});}
  }
  assert.equal(s.phase,'result');assert.deepEqual(s.visited,[0,1]);assert.equal(s.retry,undefined);
  assert.deepEqual(get('attempt').attemptResult(p,s).retry,{attempted:wrong?2:0,correct:wrong?2:0,total:wrong?2:0,complete:true});
 }
});
