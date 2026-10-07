import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadCourseModule} from './busuu-test-helpers.mjs';
const raw=JSON.parse(fs.readFileSync(new URL('../content/busuu/b2-structure.json',import.meta.url))).records;
const ids=['L01','L02','L03','L04','L05','L06','L07','L08','L09','CP'].map(k=>`B2.C10.${k}`);
const counts=[18,20,18,7,20,19,19,20,13,20],parts=[[12,6],[11,9],[10,8],[8],[10,10],[12,7],[9,10],[11,9],[13],[20]],physical=[null,34,30,15,22,25,26,23,17,40];
const actual=s=>s.answer?.kind==='pairs'?s.answer.pairs.length:s.answer?.kind==='ordered_slots'?s.answer.slots.length:s.answer?.kind==='ordered_tokens'?s.answer.tokens.length:s.answer?.kind==='multi_choice'?s.answer.requiredCount:s.answer?1:0;
const renderers={cloze_choice_v1:'gaps',explanation_example_v1:'model',multiple_choice_v1:'choice',explanation_table_v1:'table',sentence_ordering_v1:'ordering',cloze_typed_v1:'typed',pair_matching_v1:'pairs',audio_model_v1:'model',true_false_v1:'truth',kanji_animation_v1:'kanji',sentence_segment_selection_v1:'choice',scene_video_v1:'dialogue',multiple_selection_v1:'multi_choice'};
test('all ten final chapter packs align and are playable with 174 required tasks plus one optional surface',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),r=loadCourseModule('lib/busuu/content-readiness.ts'),meta=JSON.parse(fs.readFileSync(new URL('../scripts/busuu-chapter-ten-occurrences.json',import.meta.url))).screens;
 let observed=0,required=0,optional=0,known=0;
 for(const [i,id]of ids.entries()){
  const p=registry.getContentPack(id),spec=raw.find(r=>r.recordId===id);assert.ok(p,id);registry.assertContentAlignment(p,spec);assert.deepEqual(r.getPackReadiness(p).textGaps,[],id);assert.equal(r.getPackReadiness(p).playable,true,id);
  assert.equal(p.baseScreenCount,counts[i]);assert.deepEqual(spec.activities.map(a=>a.baseScreenCount),parts[i]);assert.ok(['1.0.0', '1.1.0'].includes(p.contentVersion), 'released or text-polished version');assert.equal(p.provenance.origin,'app_authored');
  observed+=spec.screens.length;required+=p.baseScreenCount;optional+=p.completion?.optionalSurfaces.length??0;
  if(i===0)continue;
  assert.equal(p.structuralContract,undefined);assert.equal(p.screens.reduce((n,s)=>n+actual(s),0),physical[i]);known+=physical[i];
  for(const [j,s]of p.screens.entries()){
   const source=spec.screens[j],c=s.sourceContract;
   for(const[k,v]of Object.entries({sourceScreenId:source.sourceScreenId,sourceRenderer:source.rawRenderer,sourceRendererId:source.sourceRendererId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,responseSlotCount:source.rawResponseSlotCount,responseSlotCountState:source.responseSlotCountState}))assert.equal(c[k],v,`${s.screenId} ${k}`);
   assert.deepEqual(c.recordedSupport,source.rawSupport);assert.deepEqual(s.evidence,source.evidence);assert.deepEqual(s.unresolved,[]);
   assert.equal(s.renderer,renderers[source.rawRenderer],`${s.screenId} renderer variant`);
   for(const key of ['feedbackCategories','targetConceptIds','priorConceptIds'])assert.deepEqual(c[key],meta[s.screenId][key],`${s.screenId} ${key}`);
   assert.equal(actual(s),c.responseSlotCount);if(s.answer?.tokens)assert.equal(new Set(s.answer.tokens.map(t=>t.id)).size,s.answer.tokens.length);
   if(meta[s.screenId].optionCount&&s.answer?.options)assert.equal(s.answer.options.length,meta[s.screenId].optionCount);
  }
 }
 assert.equal(observed,157);assert.equal(required,174);assert.equal(optional,1);assert.equal(known,232);assert.equal(Object.keys(meta).length,157);
});
test('L01 alone authors eighteen tasks in the known empty 12+6 partition; checkpoint remains observed',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),p=registry.getContentPack(ids[0]),spec=raw.find(r=>r.recordId===ids[0]);assert.ok(p);
 assert.deepEqual(spec.screens,[]);assert.ok(spec.activities.every(a=>a.screenIds.length===0));registry.assertContentAlignment(p,spec);
 assert.equal(p.structuralContract.kind,'summary_authored');assert.equal(p.structuralContract.review.status,'reviewed');assert.deepEqual(p.structuralContract.activities.map(a=>a.baseScreenCount),[12,6]);
 assert.equal(p.structuralContract.tasks.length,18);const authoredPhysical=[0,1,1,0,2,1,0,3,1,1,3,1,0,2,1,2,3,1];assert.deepEqual(p.structuralContract.tasks.map(t=>t.responseCount),authoredPhysical);assert.equal(authoredPhysical.reduce((a,b)=>a+b,0),23);assert.deepEqual(p.structuralContract.tasks.map(t=>t.responseCount),p.screens.map(actual));
 for(const s of p.screens)for(const key of ['sourceScreenId','sourceActivityId','sourceExerciseNumber','sourceRenderer','sourceRendererId','responseSlotCount'])assert.equal(s.sourceContract[key],null);
 const r=loadCourseModule('lib/busuu/readiness.ts').getLessonReadiness({...spec,contentPack:p});assert.equal(r.structure.knownScreenRows,0);assert.equal(r.structure.authoredScreenRows,18);assert.equal(r.scoredLaunchReady,true);
 const cp=registry.getContentPack(ids[9]);assert.equal(raw.find(r=>r.recordId===ids[9]).screens.length,20);assert.equal(cp.structuralContract,undefined);assert.deepEqual(cp.passPolicy,{kind:'none'});assert.equal(cp.retryPolicy,undefined);
});
test('independently specified answers complete all ten registered evaluator paths',async()=>{
 const {chapterTenResponses:responses,chapterTenActions:actions}=await import('./busuu-chapter-ten-responses.mjs'),registry=loadCourseModule('lib/busuu/content-registry.ts'),attempt=loadCourseModule('lib/busuu/attempt.ts');
 for(const id of ids){const p=registry.getContentPack(id);assert.ok(p,id);let state=attempt.initialAttemptState(p);const send=a=>state=attempt.evaluateAction(p,state,{...a,screenId:p.screens[state.index].screenId});
  assert.equal(responses[id].length,p.baseScreenCount);for(const [i,s]of p.screens.entries()){
   assert.equal(state.index,i);if(!state.audioReady)send({type:'audio_ready'});for(const[j,v]of responses[id][i].entries())for(const a of actions(s,v,j,state))send(a);
   if(s.renderer==='typed')send({type:'typed_check'});if(s.renderer==='multi_choice')send({type:'selection_check'});if(s.answer)assert.equal(state.outcomes[i]?.correct,true,s.screenId);send({type:'continue'});
  }
  assert.equal(state.phase,'result');assert.equal(state.retry,undefined);assert.equal(state.retryOutcomes,undefined);assert.equal(attempt.attemptResult(p,state).percent,100);assert.equal(attempt.attemptResult(p,state).completionEligible,true);assert.equal(new Set(state.visited).size,p.baseScreenCount);
 }
});
test('only documented retries run; L06 returns two targets in order after twelve tasks then resumes A02 for all outcome combinations',async()=>{
 const {chapterTenResponses:responses,chapterTenActions:actions}=await import('./busuu-chapter-ten-responses.mjs'),registry=loadCourseModule('lib/busuu/content-registry.ts'),attempt=loadCourseModule('lib/busuu/attempt.ts');
 assert.deepEqual(ids.filter(id=>registry.getContentPack(id).retryPolicy),[ids[2],ids[5]]);
 for(const [id,boundary,targets,counters]of [[ids[2],18,[14],[9]],[ids[5],12,[0,4],[13,14]]])for(const outcomes of targets.length===2?[[false,false],[false,true],[true,false],[true,true]]:[[false],[true]]){
  const p=registry.getContentPack(id);assert.deepEqual(p.retryPolicy,{kind:'after_activity_once',screenIds:targets.map(i=>p.screens[i].screenId)});
  for(const [j,i]of targets.entries()){assert.equal(p.screens[i].sourceContract.retryTrace.sourceExerciseNumber,counters[j]);assert.equal(p.screens[i].sourceContract.retryTrace.sourceActivityId,id===ids[2]?'6bf89baf-2b11-4527-aede-5142f9e02343':'b1247497-31b4-46fc-86f1-b856565e6954');}
  let state=attempt.initialAttemptState(p),times=0;const send=a=>state=attempt.evaluateAction(p,state,{...a,screenId:p.screens[state.index].screenId});
  const respond=(i,error)=>{const s=p.screens[i];if(!state.audioReady)send({type:'audio_ready'});const values=error?[s.renderer==='truth'?!responses[id][i][0]:s.answer.options.find(o=>!s.answer.acceptedOptionIds.includes(o.id)).id]:responses[id][i];for(const[j,v]of values.entries())for(const a of actions(s,v,j,state))send(a);if(s.renderer==='typed')send({type:'typed_check'});if(s.renderer==='multi_choice')send({type:'selection_check'});};
  for(const[i]of p.screens.entries()){assert.equal(state.index,i);respond(i,targets.includes(i));send({type:'continue'});
   while(state.retry){assert.equal(i+1,boundary);const target=targets[times];assert.equal(state.index,target);assert.equal(state.retry.returnIndex,boundary);assert.equal(state.audioReady,false);assert.equal(state.visited.length,boundary);const first=structuredClone(state.outcomes),s=p.screens[target];{const saved=state;send(s.renderer==='truth'?{type:'truth',value:true}:{type:'choice',id:'o0'});state=saved;}respond(target,!outcomes[times]);assert.deepEqual(state.outcomes,first);send({type:'continue'});assert.equal((state.retry?.outcomes?.[target]??state.retryOutcomes?.[target]).correct,outcomes[times]);times++;}
   if(id===ids[5]&&i===11){assert.equal(state.index,12);assert.equal(p.screens[state.index].screenId,`${id}.A02.S01`);}
  }
  assert.equal(times,targets.length);assert.equal(state.phase,'result');assert.equal(attempt.attemptResult(p,state).completionEligible,true);const graded=p.screens.filter(s=>s.answer).length;assert.equal(attempt.attemptResult(p,state).percent,Math.round((graded-targets.length)/graded*100));assert.equal(new Set(state.visited).size,p.baseScreenCount);
 }
});
test('optional L04 writing preserves canonical S08 and raw source exercise9 while emitting no course events',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),p=registry.getContentPack(ids[3]),s=p.completion.optionalSurfaces[0],a=loadCourseModule('lib/busuu/attempt.ts');
 assert.equal(s.screenId,`${ids[3]}.A01.S08`);assert.equal(s.sourceExerciseNumber,9);assert.deepEqual(s.modes,['write']);assert.equal(p.baseScreenCount,7);
 const state=a.initialAttemptState(p),before=structuredClone(state);assert.throws(()=>a.evaluateAction(p,state,{type:'typed_draft',screenId:s.screenId,text:'母は私に料理をさせました。'}));assert.deepEqual(state,before);
 const html=renderToStaticMarkup(React.createElement(loadCourseModule('components/busuu/OptionalProduction.tsx').default,{surface:s}));assert.match(html,/ungraded/);assert.doesNotMatch(html,/microphone|recording|Speak|Submit/);
});
test('occurrence support hides complete scripts/translation/order while preserving response banks, readings and limited feedback',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),Screen=loadCourseModule('components/busuu/LessonScreen.tsx').default;
 for(const p of ids.map(id=>registry.getContentPack(id)))for(const s of p.screens){
  const c=s.sourceContract;if(c.recordedSupport.parallel_kana_available===false)assert.ok(!s.support.before.some(b=>b.kind==='japanese'&&b.secondary),s.screenId);
  if(c.feedbackTranscript==='omitted'){assert.equal(s.audio.feedbackText,undefined,s.screenId);assert.ok(!s.support.after.some(b=>b.kind==='japanese'&&b.text===s.audio.text),s.screenId);}
  if(c.transcriptBeforeAnswer===false){const html=renderToStaticMarkup(React.createElement(Screen,{screen:s,state:{phase:'response',audioReady:true,slots:s.answer?.tokens?Array(s.answer.tokens.length).fill(null):[],matches:[],selectedOptionIds:[]},dispatch(){}}));assert.deepEqual(s.support.before,[],s.screenId);
   const bankException=s.answer?.options?.some(o=>o.text===s.audio.text)||s.answer?.tokens?.some(o=>o.text===s.audio.text);if(s.audio.text&&!bankException)assert.ok(!html.includes(s.audio.text),s.screenId);
   for(const b of s.support.after.filter(b=>b.kind==='translation'))assert.ok(!html.includes(b.text),s.screenId);if(s.renderer==='ordering')for(const t of s.answer.tokens)assert.ok(html.includes(t.text),`${s.screenId} bank`);
  }
  if(s.audio.beforeAnswer===false)assert.equal(s.audio.required,false);
 }
});

for(const[id,index,values]of [['B2.C10.L02',9,['みんなを','彼の冗談は','笑わせました。']],['B2.C10.L09',7,['申し訳ございません。','お待たせ','いたしました。']]])test(`reviewed equivalent sentence order remains accepted in ${id}`,async()=>{
 const{chapterTenActions:actions}=await import('./busuu-chapter-ten-responses.mjs'),p=loadCourseModule('lib/busuu/content-registry.ts').getContentPack(id),s=p.screens[index],runner=loadCourseModule('lib/busuu/runner.ts');let state={...runner.createLessonState(p),index,phase:'response',audioReady:true,slots:Array(s.answer.tokens.length).fill(null)};
 for(const[j,v]of values.entries())for(const a of actions(s,v,j,state))state=runner.transitionLesson(p,state,{...a,screenId:s.screenId});assert.equal(state.outcomes[index].correct,true);assert.equal(new Set(state.slots).size,values.length);
});
test('occurrences offering romaji accept reviewed Hepburn yū with supplied えんち outside the answer',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),runner=loadCourseModule('lib/busuu/runner.ts');
 for(const[id,index]of [['B2.C10.L05',17],['B2.C10.CP',13]]){const p=registry.getContentPack(id),s=p.screens[index];assert.ok(s.typed.after.startsWith('えんち'));let state={...runner.createLessonState(p),index,phase:'response',audioReady:true};for(const action of[{type:'typed_draft',text:'yū'},{type:'typed_check'}])state=runner.transitionLesson(p,state,{...action,screenId:s.screenId});assert.equal(state.outcomes[index].correct,true,s.screenId);}
});
