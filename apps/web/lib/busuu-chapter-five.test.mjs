import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadCourseModule} from './busuu-test-helpers.mjs';
import {chapterFiveResponses,chapterFiveAction} from './busuu-chapter-five-responses.mjs';
const registry=loadCourseModule('lib/busuu/content-registry.ts'),inventory=loadCourseModule('lib/busuu/inventory.ts');
const readiness=loadCourseModule('lib/busuu/readiness.ts'),attempt=loadCourseModule('lib/busuu/attempt.ts'),content=loadCourseModule('lib/busuu/content-readiness.ts');
const packs=Object.keys(chapterFiveResponses).map(id=>registry.getContentPack(id));
const raw=JSON.parse(fs.readFileSync(new URL('../content/busuu/b2-structure.json',import.meta.url))).records;

test('five documented lessons preserve all 97 source rows, physical counts, support and partitions; CP has 20 authored tasks',()=>{
 assert.deepEqual(packs.map(p=>p.baseScreenCount),[21,20,21,16,19,20]);
 for(const [i,p]of packs.entries()) {
  const source=raw.find(r=>r.recordId===p.recordId),spec=inventory.getLessonSpec(p.recordId);
  registry.assertContentAlignment(p,source);assert.equal(readiness.getLessonReadiness(spec).scoredLaunchReady,true);
  assert.equal(p.status,'reviewed');assert.equal(p.completion,undefined);assert.ok(['1.0.0', '1.1.0'].includes(p.contentVersion), 'released or text-polished version');
  if(i===5){assert.equal(spec.screens.length,0);assert.equal(spec.activities.length,0);assert.equal(p.structuralContract.origin,'app_authored');continue;}
  assert.deepEqual(spec.activities.map(a=>a.baseScreenCount),[[11,10],[14,6],[13,8],[10,6],[10,9]][i]);
  assert.deepEqual(p.screens.map(s=>s.screenId),source.screens.map(s=>s.screenId));
  for(const [j,s]of p.screens.entries()) {
   const r=source.screens[j],c=s.sourceContract;
   assert.equal(c.sourceScreenId,r.sourceScreenId);assert.equal(c.sourceActivityId,r.sourceActivityId);assert.equal(c.sourceExerciseNumber,r.sourceExerciseNumber);
   assert.equal(c.responseSlotCount,r.rawResponseSlotCount);assert.deepEqual(c.recordedSupport,r.rawSupport);assert.deepEqual(s.unresolved,[]);
   if(r.rawSupport.japanese_transcript_before_answer!==null)assert.equal(c.transcriptBeforeAnswer,r.rawSupport.japanese_transcript_before_answer);
   assert.equal(c.translationBeforeAnswer,r.rawSupport.translation_visible);
   assert.ok(s.evidence.length);assert.ok(c.targetConceptIds.length);
  }
 }
 assert.equal(packs.slice(0,5).reduce((n,p)=>n+p.screens.length,0),97);
 assert.deepEqual(packs[0].retryPolicy,{kind:'after_activity_once',screenIds:['B2.C05.L01.A02.S08']});
 assert.ok(packs.slice(1).every(p=>p.retryPolicy===undefined));assert.deepEqual(packs[5].passPolicy,{kind:'none'});
});
test('117 independently reviewed responses finish each registered evaluator with distinct completion and accuracy',()=>{
 for(const p of packs) {
  let state=attempt.initialAttemptState(p);const send=a=>state=attempt.evaluateAction(p,state,{...a,screenId:p.screens[state.index].screenId});
  for(const [i,s]of p.screens.entries()) {
   assert.equal(state.index,i);if(!state.audioReady)send({type:'audio_ready'});
   for(const [j,v]of chapterFiveResponses[p.recordId][i].entries())send(chapterFiveAction(s,v,j,state));
   if(s.renderer==='typed')send({type:'typed_check'});
   if(s.answer)assert.equal(state.outcomes[i]?.correct,true,s.screenId);
   send({type:'continue'});
  }
  assert.equal(state.phase,'result');assert.equal(state.retry,undefined);assert.equal(state.retryOutcomes,undefined);
  const result=attempt.attemptResult(p,state);assert.equal(result.percent,100);assert.equal(result.completionEligible,true);assert.equal(state.visited.length,p.baseScreenCount);
 }
});
test('final-boundary L01 retry requires fresh listening, finishes even wrong and never rewrites first accuracy or base count',()=>{
 for(const retryValue of [false,true]) {
  const p=packs[0];let state=attempt.initialAttemptState(p);const send=a=>state=attempt.evaluateAction(p,state,{...a,screenId:p.screens[state.index].screenId});
  for(const [i,s]of p.screens.entries()) {
   if(!state.audioReady)send({type:'audio_ready'});
   const responses=i===18?[true]:chapterFiveResponses[p.recordId][i];
   for(const [j,v]of responses.entries())send(chapterFiveAction(s,v,j,state));
   send({type:'continue'});
   if(i===18)assert.equal(state.index,19,'no immediate repeat');
  }
  assert.equal(state.index,18);assert.equal(state.retry.returnIndex,21);assert.equal(state.visited.length,21);assert.equal(state.audioReady,false);
  const outcomes=structuredClone(state.outcomes);{const saved=state;send({type:'truth',value:retryValue});state=saved;}
  send({type:'audio_ready'});send({type:'truth',value:retryValue});assert.deepEqual(state.outcomes,outcomes);
  send({type:'continue'});assert.equal(state.phase,'result');assert.equal(state.retryOutcomes[18].correct,!retryValue);
  const result=attempt.attemptResult(p,state);assert.equal(result.completionEligible,true);assert.equal(result.percent,Math.round(12/13*100));
  assert.equal(state.visited.length,21);
 }
});
test('all five hotel replay references bind Japanese-only full scene; lexical checkout gloss is separate',()=>{
 const p=packs[3],s=p.screens[10];assert.equal(s.dialogue.translationVisible,false);assert.equal(s.dialogue.japaneseVisible,true);
 assert.ok(s.dialogue.turns.every(t=>t.japanese&&t.reading&&t.english===null));assert.equal(content.getAudioScript(s),s.dialogue.turns.map(t=>t.japanese).join('\n'));
 assert.deepEqual(s.dialogue.glosses,[{japanese:'チェックアウト',reading:'チェックアウト',english:'checkout'}]);
 for(let i=11;i<16;i++)assert.equal(content.getSceneReuse(p,p.screens[i]),s);
 assert.equal(p.screens.filter(s=>s.sourceContract.sceneReuse).length,5);
 const Dialogue=loadCourseModule('components/busuu/LessonScreen.tsx').Dialogue;
 const html=renderToStaticMarkup(React.createElement(Dialogue,{screen:s}));
 assert.match(html,/<dd lang="en">checkout<\/dd>/);assert.doesNotMatch(html,/Breakfast|Your room|English dialogue support unavailable/);
 assert.match(content.getAudioScript(s),/三階でございます/);assert.match(content.getAudioScript(s),/食堂は一階にございます/);assert.match(content.getAudioScript(s),/チェックアウトは十時/);
});
test('transcript-free ordering retains all response tokens but hides full source, translation and accepted order in pre-answer DOM',()=>{
 const Screen=loadCourseModule('components/busuu/LessonScreen.tsx').default;
 for(const p of packs)for(const s of p.screens.filter(s=>s.sourceContract.transcriptBeforeAnswer===false)) {
  const state={phase:'response',audioReady:true,slots:s.renderer==='ordering'?Array(s.answer.tokens.length).fill(null):[],matches:[]};
  const html=renderToStaticMarkup(React.createElement(Screen,{screen:s,state,dispatch(){}}));
  assert.deepEqual(s.support.before,[]);assert.ok(!html.includes(s.audio.text),s.screenId);
  for(const b of s.support.after.filter(b=>b.kind==='translation'))assert.ok(!html.includes(b.text),s.screenId);
  if(s.renderer==='ordering')for(const token of s.answer.tokens)assert.ok(html.includes(token.text),`${s.screenId} bank ${token.text}`);
  assert.doesNotMatch(html,/<audio|title=/);assert.equal(content.getSceneReuse(p,s),null);
 }
});
test('kanji, reviewed typed forms, supplied endings and equivalent orders preserve chapter targets',()=>{
 assert.deepEqual(packs[1].screens.filter(s=>s.renderer==='kanji').map(s=>s.kanji.character),['館','段','庭','室','性']);
 const repeated=packs[1].screens[15].answer.tokens.filter(t=>t.text==='家');assert.equal(repeated.length,2);assert.notEqual(repeated[0].id,repeated[1].id);
 for(const p of packs)for(const s of p.screens.filter(s=>s.renderer==='typed'))assert.equal(s.answer.normalization,'nfkc_trim');
 assert.deepEqual(packs[2].screens[4].answer.acceptedForms,['お好き','おすき']);
 assert.equal(packs[4].screens[11].scaffold.at(-1),'ください。');assert.equal(packs[4].screens[11].answer.slots.length,1);
 assert.equal(packs[2].screens[5].answer.acceptedOrders.length,2);assert.equal(packs[2].screens[19].answer.acceptedOrders.length,2);
 assert.equal(packs[4].screens[18].answer.acceptedOrders.length,2);
});
test('reviewed alternative floor reading and hotel question order grade correctly per occurrence',()=>{
 for(const [p,i,values]of [[packs[0],10,['さんかい','食事']],[packs[3],14,['ご質問は','ほかに、','ございます','か。']]]) {
  let state={...attempt.initialAttemptState(p),index:i,phase:'response',audioReady:true,slots:Array(values.length).fill(null)};
  for(const [j,v]of values.entries())state=attempt.evaluateAction(p,state,{...chapterFiveAction(p.screens[i],v,j,state),screenId:p.screens[i].screenId});
  assert.equal(state.outcomes[i].correct,true,p.screens[i].screenId);
 }
});
