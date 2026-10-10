import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadCourseModule} from './busuu-test-helpers.mjs';
const ids=['L01','L02','L03','L04','L05','CP'].map(k=>`B2.C07.${k}`);
const registry=loadCourseModule('lib/busuu/content-registry.ts');

test('all six chapter seven entries are registered playable versions',()=>{
 const readiness=loadCourseModule('lib/busuu/content-readiness.ts');
 for(const id of ids){const p=registry.getContentPack(id);assert.ok(p,`${id} is registered`);assert.equal(readiness.getPackReadiness(p).playable,true,id);}
});

test('114 documented occurrences retain partitions, source identities and 186 physical responses',async()=>{
 const packs=ids.map(id=>registry.getContentPack(id));assert.ok(packs.every(Boolean));
 const raw=JSON.parse(fs.readFileSync(new URL('../content/busuu/b2-structure.json',import.meta.url))).records;
 const maps=Object.assign({},...['creation','recommendation','wondering'].map(g=>JSON.parse(fs.readFileSync(new URL(`../scripts/busuu-chapter-seven-${g}-occurrences.json`,import.meta.url))).screens));
 const partitions=[[10,8],[9,9],[10,10],[10,10],[10,8],[20]],responses=[29,25,31,23,27,51];
 for(const [i,p]of packs.entries()){
  const r=raw.find(r=>r.recordId===p.recordId);registry.assertContentAlignment(p,r);
  assert.equal(p.status,'reviewed');assert.ok(['1.0.0', '1.1.0', '1.2.0'].includes(p.contentVersion), 'released or text-polished version');assert.equal(p.structuralContract,undefined);
  assert.ok(!p.completion?.optionalSurfaces.length);assert.equal(p.baseScreenCount,r.screens.length);
  assert.deepEqual(r.activities.map(a=>a.baseScreenCount),partitions[i]);
  assert.equal(p.screens.reduce((n,s)=>n+s.sourceContract.responseSlotCount,0),responses[i]);
  for(const [j,s]of p.screens.entries()){
   const source=r.screens[j],c=s.sourceContract;
   for(const [key,value]of Object.entries({sourceScreenId:source.sourceScreenId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,responseSlotCount:source.rawResponseSlotCount,sourceRenderer:source.rawRenderer,sourceRendererId:source.sourceRendererId}))assert.equal(c[key],value,`${s.screenId} ${key}`);
   assert.deepEqual(c.recordedSupport,source.rawSupport);assert.deepEqual(s.unresolved,[]);assert.ok(s.evidence.length);
   for(const field of ['targetConceptIds','priorConceptIds','feedbackCategories'])assert.deepEqual(c[field],maps[s.screenId][field],`${s.screenId} ${field}`);
   const count=s.answer?.kind==='ordered_slots'?s.answer.slots.length:s.answer?.kind==='ordered_tokens'?s.answer.tokens.length:s.answer?.kind==='pairs'?s.answer.pairs.length:s.answer?1:0;
   assert.equal(count,c.responseSlotCount,s.screenId);
  }
 }
 assert.equal(packs.reduce((n,p)=>n+p.baseScreenCount,0),114);assert.equal(responses.reduce((a,b)=>a+b),186);
 assert.deepEqual(packs[4].retryPolicy,{kind:'after_activity_once',screenIds:['B2.C07.L05.A02.S07']});
 assert.ok(packs.filter((_,i)=>i!==4).every(p=>!p.retryPolicy));
});

test('independently specified responses complete all six evaluators with unique base accounting',async()=>{
 const {chapterSevenResponses,chapterSevenAction}=await import('./busuu-chapter-seven-responses.mjs');
 const attempt=loadCourseModule('lib/busuu/attempt.ts');
 for(const id of ids){const p=registry.getContentPack(id);let state=attempt.initialAttemptState(p);
  const send=a=>state=attempt.evaluateAction(p,state,{...a,screenId:p.screens[state.index].screenId});
  assert.equal(chapterSevenResponses[id].length,p.baseScreenCount);
  for(const [i,s]of p.screens.entries()){
   assert.equal(state.index,i);if(!state.audioReady)send({type:'audio_ready'});
   for(const [j,v]of chapterSevenResponses[id][i].entries())send(chapterSevenAction(s,v,j,state));
   if(s.renderer==='typed')send({type:'typed_check'});if(s.answer)assert.equal(state.outcomes[i]?.correct,true,s.screenId);send({type:'continue'});
  }
  const result=attempt.attemptResult(p,state);assert.equal(state.phase,'result');assert.equal(result.percent,100);assert.equal(result.completionEligible,true);
  assert.equal(new Set(state.visited).size,p.baseScreenCount);assert.equal(state.retry,undefined);
 }
});

test('only L05 ticket listening retries after all 18 screens; either outcome completes with first accuracy immutable',async()=>{
 const {chapterSevenResponses,chapterSevenAction}=await import('./busuu-chapter-seven-responses.mjs');
 const attempt=loadCourseModule('lib/busuu/attempt.ts'),p=registry.getContentPack(ids[4]),target=16;
 for(const retryCorrect of [true,false]){
  let state=attempt.initialAttemptState(p);const send=a=>state=attempt.evaluateAction(p,state,{...a,screenId:p.screens[state.index].screenId});
  const wrong=p.screens[target].answer.options.find(o=>!p.screens[target].answer.acceptedOptionIds.includes(o.id)).id;
  for(const [i,s]of p.screens.entries()){
   assert.equal(state.index,i);if(!state.audioReady)send({type:'audio_ready'});
   for(const [j,v]of (i===target?[wrong]:chapterSevenResponses[p.recordId][i]).entries())send(chapterSevenAction(s,v,j,state));
   if(s.renderer==='typed')send({type:'typed_check'});send({type:'continue'});
   if(i<17)assert.equal(state.retry,undefined);
  }
  assert.equal(state.index,target);assert.equal(state.retry.returnIndex,18);assert.equal(state.audioReady,false);assert.equal(state.visited.length,18);
  const outcomes=structuredClone(state.outcomes),options=structuredClone(p.screens[target].answer.options);
  {const saved=state;send({type:'choice',id:wrong});state=saved;}send({type:'audio_ready'});
  send({type:'choice',id:retryCorrect?chapterSevenResponses[p.recordId][target][0]:wrong});assert.deepEqual(state.outcomes,outcomes);
  send({type:'continue'});assert.equal(state.phase,'result');assert.equal(state.retryOutcomes[target].correct,retryCorrect);
  assert.deepEqual(p.screens[target].answer.options,options);const result=attempt.attemptResult(p,state);
  assert.equal(result.completionEligible,true);const graded=p.screens.filter(s=>s.answer).length;assert.equal(result.percent,Math.round((graded-1)/graded*100));
  assert.equal(new Set(state.visited).size,18);
 }
});

test('hidden listening retains legitimate response banks and occurrence-specific limited feedback and playback timing',()=>{
 const content=loadCourseModule('lib/busuu/content-readiness.ts'),Screen=loadCourseModule('components/busuu/LessonScreen.tsx').default;
 const raw=JSON.parse(fs.readFileSync(new URL('../content/busuu/b2-structure.json',import.meta.url))).records;
 for(const p of ids.map(id=>registry.getContentPack(id)))for(const s of p.screens){
  const c=s.sourceContract;
  const source=raw.find(r=>r.recordId===p.recordId).screens.find(r=>r.screenId===s.screenId);
  if(source.rawMedia.length===0&&source.rawMediaStructure?.source_replay_available===false){assert.equal(s.audio.beforeAnswer,false,s.screenId);assert.equal(s.audio.required,false,s.screenId);}
  if(c.transcriptBeforeAnswer===false&&!content.isTeachingScreen(s)){
   assert.ok(!s.support.before.some(b=>['japanese','translation'].includes(b.kind)),s.screenId);
   const html=renderToStaticMarkup(React.createElement(Screen,{screen:s,state:{phase:'response',audioReady:true,slots:s.answer?.tokens?Array(s.answer.tokens.length).fill(null):[],matches:[]},dispatch(){}}));
   if(s.answer?.kind==='choice'&&s.answer.options.some(o=>o.text===s.audio.text))assert.equal(html.split(s.audio.text).length-1,1,s.screenId);
   else assert.ok(!html.includes(s.audio.text),s.screenId);
   if(s.renderer==='ordering')for(const t of s.answer.tokens)assert.ok(html.includes(t.text),`${s.screenId} visible bank`);
  }
  if(c.recordedSupport.transcript_in_feedback===false&&!content.isTeachingScreen(s)){
   assert.ok(!s.support.after.some(b=>b.kind==='japanese'&&b.text===s.audio.text),s.screenId);assert.equal(s.audio.feedbackText,undefined,s.screenId);
  }
  if(c.recordedSupport.japanese_transcript_before_answer===false&&c.recordedSupport.parallel_kana_available===true&&s.answer?.kind==='choice')assert.ok(s.answer.options.every(o=>o.secondary),s.screenId);
 }
 assert.deepEqual(registry.getContentPack(ids[3]).screens.filter(s=>s.renderer==='kanji').map(s=>s.kanji.character),['雪','景','流','公','園']);
});

test('documented typed script categories and authored lexical forms remain occurrence-specific',async()=>{
 const attempt=loadCourseModule('lib/busuu/attempt.ts');
 const {chapterSevenResponses,chapterSevenAction}=await import('./busuu-chapter-seven-responses.mjs');
 const cases=[['B2.C07.L01',7,['できる','dekiru'],['できるの','の','出来る']],['B2.C07.L03',13,['ぜひ','是非','zehi'],['きっと','行ってみて']],['B2.C07.CP',12,['行ってみて','いってみて','ittemite'],['ぜひ','行ってみてください']],['B2.C07.CP',14,['の','no'],['できる','dekiru','のは']]];
 for(const [id,index,accepted,rejected]of cases){
  const original=registry.getContentPack(id),s=original.screens[index];assert.deepEqual(s.answer.acceptedForms,accepted,s.screenId);
  for(const value of [...accepted,...rejected]){
   let state=attempt.initialAttemptState(original);
   const send=a=>state=attempt.evaluateAction(original,state,{...a,screenId:original.screens[state.index].screenId});
   for(let i=0;i<index;i++){
    const before=original.screens[i];if(!state.audioReady)send({type:'audio_ready'});
    for(const [j,v]of chapterSevenResponses[id][i].entries())send(chapterSevenAction(before,v,j,state));
    if(before.renderer==='typed')send({type:'typed_check'});send({type:'continue'});
   }
   if(!state.audioReady)send({type:'audio_ready'});send({type:'typed_draft',text:value});send({type:'typed_check'});
   assert.equal(state.outcomes[index].correct,accepted.includes(value),`${s.screenId} ${value}`);
  }
 }
});

test('checkpoint completion and first accuracy are separate from the existing explicit app pass policy',()=>{
 const p=registry.getContentPack(ids[5]),runner=loadCourseModule('lib/busuu/runner.ts');
 assert.deepEqual(p.passPolicy,{kind:'none'});
 assert.equal(runner.getPassOutcome(p,{completionEligible:true,graded:20,correct:15}),null);
 assert.equal(runner.getPassOutcome(p,{completionEligible:true,graded:20,correct:16}),null);
 assert.equal(runner.getPassOutcome(p,{completionEligible:false,graded:20,correct:20}),null);
});

test('explicitly unavailable parallel source readings remain absent while response-option readings stay visible',()=>{
 for(const p of ids.map(id=>registry.getContentPack(id)))for(const s of p.screens){
  if(s.sourceContract.recordedSupport.parallel_kana_available===false)
   assert.ok(!s.support.before.some(b=>b.kind==='japanese'&&b.secondary),s.screenId);
 }
 for(const [id,index]of [['B2.C07.L02',13],['B2.C07.L04',16],['B2.C07.L05',16],['B2.C07.CP',4]])
  assert.ok(registry.getContentPack(id).screens[index].answer.options.every(o=>o.secondary),`${id} option readings`);
});

test('endpoint-focused banks accept equivalent means-first discourse order',async()=>{
 const {chapterSevenResponses,chapterSevenAction}=await import('./busuu-chapter-seven-responses.mjs'),attempt=loadCourseModule('lib/busuu/attempt.ts');
 for(const [id,target,values]of [['B2.C07.L02',8,['電車で','そこまで','は、','行くことが','できます。']],['B2.C07.CP',17,['バスで','駅まで','は、','行くことが','できます。']]]){
  const p=registry.getContentPack(id);let state=attempt.initialAttemptState(p);
  const send=a=>state=attempt.evaluateAction(p,state,{...a,screenId:p.screens[state.index].screenId});
  for(let i=0;i<=target;i++){
   const s=p.screens[i];if(!state.audioReady)send({type:'audio_ready'});
   for(const [j,v]of (i===target?values:chapterSevenResponses[id][i]).entries())send(chapterSevenAction(s,v,j,state));
   if(s.renderer==='typed')send({type:'typed_check'});
   assert.equal(state.outcomes[i]?.correct,s.answer?true:undefined,s.screenId);if(i<target)send({type:'continue'});
  }
 }
});
