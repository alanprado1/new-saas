import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadCourseModule} from './busuu-test-helpers.mjs';
const raw=JSON.parse(fs.readFileSync(new URL('../content/busuu/b2-structure.json',import.meta.url))).records;
const ids=['L01','L02','L03','L04','L05','L06','L07','L08','CP'].map(k=>`B2.C09.${k}`);

test('all nine chapter nine entries are registered and playable',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),readiness=loadCourseModule('lib/busuu/content-readiness.ts');
 for(const id of ids){const p=registry.getContentPack(id);assert.ok(p,id);assert.equal(readiness.getPackReadiness(p).playable,true,id);}
});

test('production_choice_v1 projects only an evidenced optional tail and validates its exact raw identity',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),spec=raw.find(r=>r.recordId==='B2.C09.L07');
 assert.equal(spec.optionalProduction,null);
 assert.deepEqual(registry.getRuntimeCompletionMetadata(spec),{endpointOptional:true,coreTeachingScreenCount:7});
 const p=structuredClone(registry.getContentPack('B2.C08.L06'));
 p.recordId=spec.recordId;p.baseScreenCount=7;p.screens=p.screens.slice(0,7);
 for(const [i,s]of p.screens.entries()){
  const source=spec.screens[i];s.screenId=source.screenId;
  Object.assign(s.sourceContract,{sourceScreenId:source.sourceScreenId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,responseSlotCount:source.rawResponseSlotCount});
 }
 p.completion.requiredScreenIds=p.screens.map(s=>s.screenId);
 Object.assign(p.completion.optionalSurfaces[0],{screenId:spec.screens[7].screenId,sourceActivityId:spec.screens[7].sourceActivityId,sourceExerciseNumber:8});
 assert.doesNotThrow(()=>registry.assertContentAlignment(p,spec));
 const bad=structuredClone(spec);bad.screens[0].rawRenderer='production_choice_v1';
 assert.equal(registry.getRuntimeCompletionMetadata(bad),null);
 for(const renderer of ['production_choice_v2','community_production_v1','production_choice_v1_extra']){
  const unknown=structuredClone(spec);unknown.screens[7].rawRenderer=renderer;
  assert.equal(registry.getRuntimeCompletionMetadata(unknown),null);
  assert.throws(()=>registry.assertContentAlignment(p,unknown));
 }
 assert.deepEqual(spec.screens[7].rawRenderer,'production_choice_v1');
});

test('chapter nine preserves all 136 rows, exact source identities, partitions and 173 known responses',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),meta=JSON.parse(fs.readFileSync(new URL('../scripts/busuu-chapter-nine-occurrences.json',import.meta.url))).screens;
 const parts=[[9,8],[9,10],[10,10],[10,7],[8,8],[10,9],[8],[12,8]],physical=[18,28,27,26,16,27,12,19],required=[17,19,20,17,16,19,7,20];
 const renderers={audio_model_v1:'model',explanation_example_v1:'model',explanation_table_v1:'table',kanji_animation_v1:'kanji',multiple_choice_v1:'choice',true_false_v1:'truth',multiple_selection_v1:'multi_choice',cloze_choice_v1:'gaps',cloze_typed_v1:'typed',character_ordering_v1:'gaps',sentence_ordering_v1:'ordering',pair_matching_v1:'pairs'};
 let rows=0,total=0,optional=0;
 for(const [i,id]of ids.slice(0,8).entries()){
  const p=registry.getContentPack(id),spec=raw.find(r=>r.recordId===id);registry.assertContentAlignment(p,spec);
  assert.ok(['1.0.0', '1.1.0', '1.2.0'].includes(p.contentVersion), 'released or text-polished version');assert.equal(p.structuralContract,undefined);assert.equal(p.baseScreenCount,required[i]);assert.deepEqual(spec.activities.map(a=>a.baseScreenCount),parts[i]);
  assert.equal(p.screens.reduce((n,s)=>n+s.sourceContract.responseSlotCount,0),physical[i]);total+=physical[i];rows+=spec.screens.length;optional+=p.completion?.optionalSurfaces.length??0;
  for(const [j,s]of p.screens.entries()){
   const source=spec.screens[j],c=s.sourceContract;
   for(const [key,value]of Object.entries({sourceScreenId:source.sourceScreenId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,responseSlotCount:source.rawResponseSlotCount,sourceRenderer:source.rawRenderer,sourceRendererId:source.sourceRendererId}))assert.equal(c[key],value,`${s.screenId} ${key}`);
   // S50's reservation explanation_example explicitly retains a dialogue.
   if(source.rawRenderer==='explanation_example_v1')assert.ok(['model','dialogue'].includes(s.renderer),s.screenId);
   else assert.equal(s.renderer,renderers[source.rawRenderer],s.screenId);
   assert.deepEqual(c.recordedSupport,source.rawSupport);assert.deepEqual(s.unresolved,[]);
   for(const field of ['targetConceptIds','priorConceptIds','feedbackCategories'])assert.deepEqual(c[field],meta[s.screenId][field],`${s.screenId} ${field}`);
   const a=s.answer,count=a?.kind==='pairs'?a.pairs.length:a?.kind==='ordered_slots'?a.slots.length:a?.kind==='ordered_tokens'?a.tokens.length:a?.kind==='multi_choice'?a.requiredCount:a?1:0;assert.equal(count,c.responseSlotCount,s.screenId);
   if(a?.tokens)assert.equal(new Set(a.tokens.map(t=>t.id)).size,a.tokens.length,s.screenId);
  }
 }
 assert.equal(rows,136);assert.equal(total,173);assert.equal(optional,1);assert.equal(required.reduce((a,b)=>a+b,0)+20,155);assert.equal(Object.keys(meta).length,136);
 const retries=ids.filter(id=>registry.getContentPack(id).retryPolicy);assert.deepEqual(retries,[ids[0],ids[1],ids[5]]);
 for(const [id,target,counter,activity]of [[ids[0],'A02.S08',9,'a77bd09a-93f4-49ad-8b81-b39bdc0293d3'],[ids[1],'A01.S05',10,'2e78d83a-f1a9-4cb9-8252-25a873394984'],[ids[5],'A02.S09',10,'66b6685f-9b5f-4d7d-940f-93c446e4a412']]){
  const p=registry.getContentPack(id),s=p.screens.find(s=>s.screenId===`${id}.${target}`);assert.deepEqual(p.retryPolicy,{kind:'after_activity_once',screenIds:[s.screenId]});assert.equal(s.sourceContract.retryTrace.sourceExerciseNumber,counter);assert.equal(s.sourceContract.retryTrace.sourceActivityId,activity);
 }
});

test('checkpoint has zero observed rows, twenty authored tasks and forty independently counted app responses',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),spec=raw.find(r=>r.recordId===ids[8]),p=registry.getContentPack(ids[8]);
 assert.deepEqual(spec.screens,[]);assert.deepEqual(spec.activities,[]);registry.assertContentAlignment(p,spec);
 assert.equal(p.structuralContract.kind,'summary_authored');assert.equal(p.structuralContract.review.status,'reviewed');assert.equal(p.structuralContract.origin,'app_authored');assert.deepEqual(p.passPolicy,{kind:'none'});assert.equal(p.retryPolicy,undefined);
 assert.deepEqual(p.structuralContract.activities.map(a=>a.baseScreenCount),[20]);
 const counts=[1,1,1,4,1,1,1,2,3,2,1,1,5,5,3,1,1,3,2,1];assert.deepEqual(p.structuralContract.tasks.map(t=>t.responseCount),counts);assert.equal(counts.reduce((a,b)=>a+b,0),40);
 for(const s of p.screens)for(const key of ['sourceScreenId','sourceActivityId','sourceExerciseNumber','sourceRenderer','sourceRendererId','responseSlotCount'])assert.equal(s.sourceContract[key],null);
 const r=loadCourseModule('lib/busuu/readiness.ts').getLessonReadiness({...spec,contentPack:p});assert.equal(r.scoredLaunchReady,true);assert.equal(r.structure.knownScreenRows,0);assert.equal(r.structure.authoredScreenRows,20);
});

test('independently specified answers complete all nine evaluator paths',async()=>{
 const {chapterNineResponses,chapterNineActions}=await import('./busuu-chapter-nine-responses.mjs'),registry=loadCourseModule('lib/busuu/content-registry.ts'),attempt=loadCourseModule('lib/busuu/attempt.ts');
 for(const id of ids){
  const p=registry.getContentPack(id);let state=attempt.initialAttemptState(p);const send=a=>state=attempt.evaluateAction(p,state,{...a,screenId:p.screens[state.index].screenId});assert.equal(chapterNineResponses[id].length,p.baseScreenCount);
  for(const [i,s]of p.screens.entries()){
   assert.equal(state.index,i);if(!state.audioReady)send({type:'audio_ready'});
   for(const [j,v]of chapterNineResponses[id][i].entries())for(const a of chapterNineActions(s,v,j,state))send(a);
   if(s.renderer==='typed')send({type:'typed_check'});if(s.renderer==='multi_choice')send({type:'selection_check'});
   if(s.answer)assert.equal(state.outcomes[i]?.correct,true,s.screenId);send({type:'continue'});
  }
  assert.equal(state.phase,'result');assert.equal(state.retry,undefined);assert.equal(state.retryOutcomes,undefined);assert.equal(attempt.attemptResult(p,state).percent,100);assert.equal(attempt.attemptResult(p,state).completionEligible,true);assert.equal(new Set(state.visited).size,p.baseScreenCount);
 }
});

test('all three activity retries require fresh listening, preserve accuracy and resume after either outcome',async()=>{
 const {chapterNineResponses,chapterNineActions}=await import('./busuu-chapter-nine-responses.mjs'),registry=loadCourseModule('lib/busuu/content-registry.ts'),attempt=loadCourseModule('lib/busuu/attempt.ts');
 for(const [id,boundary,target]of [[ids[0],17,16],[ids[1],9,4],[ids[5],19,18]])for(const correct of [true,false]){
  const p=registry.getContentPack(id);let state=attempt.initialAttemptState(p);const send=a=>state=attempt.evaluateAction(p,state,{...a,screenId:p.screens[state.index].screenId});
  const s=p.screens[target],wrong=s.renderer==='truth'?!chapterNineResponses[id][target][0]:s.answer.options.find(o=>!s.answer.acceptedOptionIds.includes(o.id)).id;const options=structuredClone(s.answer.options);
  const respond=(i,error)=>{const item=p.screens[i];if(!state.audioReady)send({type:'audio_ready'});for(const[j,v]of(error?[wrong]:chapterNineResponses[id][i]).entries())for(const a of chapterNineActions(item,v,j,state))send(a);if(item.renderer==='typed')send({type:'typed_check'});if(item.renderer==='multi_choice')send({type:'selection_check'});};
  let times=0;
  for(const [i]of p.screens.entries()){
   assert.equal(state.index,i);respond(i,i===target);send({type:'continue'});
   if(state.retry){
    times++;assert.equal(i+1,boundary);assert.equal(state.index,target);assert.equal(state.retry.returnIndex,boundary);assert.equal(state.audioReady,false);assert.equal(state.visited.length,boundary);
    const first=structuredClone(state.outcomes);{const saved=state;send(s.renderer==='truth'?{type:'truth',value:wrong}:{type:'choice',id:wrong});state=saved;}
    respond(target,!correct);assert.deepEqual(state.outcomes,first);send({type:'continue'});assert.equal(state.retryOutcomes[target].correct,correct);assert.deepEqual(s.answer.options,options);
    if(id===ids[1]){assert.equal(state.index,9);assert.equal(p.screens[state.index].screenId,`${id}.A02.S01`);}
   }
  }
  assert.equal(times,1);assert.equal(state.phase,'result');assert.equal(attempt.attemptResult(p,state).completionEligible,true);assert.equal(new Set(state.visited).size,p.baseScreenCount);
  const graded=p.screens.filter(s=>s.answer).length;assert.equal(attempt.attemptResult(p,state).percent,Math.round((graded-1)/graded*100));
 }
});

test('three-of-six selections are editable and graded once as an order-independent exact set',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),runner=loadCourseModule('lib/busuu/runner.ts'),p=registry.getContentPack(ids[1]),s=p.screens[7];
 assert.equal(s.renderer,'multi_choice');assert.equal(s.answer.options.length,6);assert.equal(s.answer.requiredCount,3);assert.equal(s.answer.grading,'exact_set');
 const answer=['o4','o0','o2'];for(const values of [answer,['o0','o2','o1']]){
  let state={...runner.createLessonState(p),index:7,phase:'response',audioReady:true,selectedOptionIds:[]};const send=a=>state=runner.transitionLesson(p,state,{...a,screenId:s.screenId});
  send({type:'toggle_option',id:values[0]});assert.equal(state.outcomes[7],undefined);assert.throws(()=>loadCourseModule('lib/busuu/attempt.ts').evaluateAction(p,state,{type:'selection_check',screenId:s.screenId}));
  send({type:'toggle_option',id:values[0]});assert.deepEqual(state.selectedOptionIds,[]);for(const id of values)send({type:'toggle_option',id});
  assert.equal(state.outcomes[7],undefined);send({type:'selection_check'});assert.equal(state.outcomes[7].correct,values===answer);assert.equal(Object.keys(state.outcomes).length,1);
 }
});

test('optional writing remains private and outside attempts; text-only decision retrieval binds the lunch context',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),attempt=loadCourseModule('lib/busuu/attempt.ts'),p=registry.getContentPack(ids[6]),surface=p.completion.optionalSurfaces[0];
 assert.equal(p.baseScreenCount,7);assert.equal(surface.screenId,`${ids[6]}.A01.S08`);assert.equal(surface.sourceExerciseNumber,8);assert.deepEqual(surface.modes,['write']);
 const state=attempt.initialAttemptState(p),before=structuredClone(state);assert.throws(()=>attempt.evaluateAction(p,state,{type:'typed_draft',screenId:surface.screenId,text:'ラテにする。'}));assert.deepEqual(state,before);
 const Optional=loadCourseModule('components/busuu/OptionalProduction.tsx').default,html=renderToStaticMarkup(React.createElement(Optional,{surface}));assert.match(html,/ungraded/);assert.doesNotMatch(html,/microphone|recording|Speak|Send|Submit/);
 const retrieval=registry.getContentPack(ids[5]).screens[14];assert.equal(retrieval.renderer,'typed');assert.equal(retrieval.audio.required,false);assert.equal(retrieval.audio.beforeAnswer,false);assert.deepEqual(retrieval.answer.acceptedForms,['に']);
 assert.match(registry.getContentPack(ids[5]).provenance.note,/S50|commentary|text-only/);
});

test('occurrence support protects hidden transcripts while retaining legitimate response banks and cues',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),Screen=loadCourseModule('components/busuu/LessonScreen.tsx').default;
 for(const p of ids.map(id=>registry.getContentPack(id)))for(const s of p.screens){
  const c=s.sourceContract;if(c.recordedSupport.parallel_kana_available===false)assert.ok(!s.support.before.some(b=>b.kind==='japanese'&&b.secondary),s.screenId);
  if(c.feedbackTranscript==='omitted'){assert.equal(s.audio.feedbackText,undefined,s.screenId);assert.ok(!s.support.after.some(b=>b.kind==='japanese'&&b.text===s.audio.text),s.screenId);}
  if(c.transcriptBeforeAnswer===false){
   assert.deepEqual(s.support.before,[],s.screenId);const html=renderToStaticMarkup(React.createElement(Screen,{screen:s,state:{phase:'response',audioReady:true,slots:s.answer?.tokens?Array(s.answer.tokens.length).fill(null):[],matches:[],selectedOptionIds:[]},dispatch(){}}));
   const bankException=s.answer?.options?.some(o=>o.text===s.audio.text);if(s.audio.text&&!bankException)assert.ok(!html.includes(s.audio.text),s.screenId);
   for(const b of s.support.after.filter(b=>b.kind==='translation'))assert.ok(!html.includes(b.text),`${s.screenId} hidden translation`);
   if(s.renderer==='ordering')for(const t of s.answer.tokens)assert.ok(html.includes(t.text),`${s.screenId} response bank`);
  }
  if(s.audio.beforeAnswer===false)assert.equal(s.audio.required,false,s.screenId);
 }
});

test('casual selection of a food and drink accepts either equivalent noun order without tile reuse',async()=>{
 const {chapterNineActions}=await import('./busuu-chapter-nine-responses.mjs'),registry=loadCourseModule('lib/busuu/content-registry.ts'),runner=loadCourseModule('lib/busuu/runner.ts'),p=registry.getContentPack(ids[6]),s=p.screens[6];
 for(const values of [['日替わり定食','レモネード'],['レモネード','日替わり定食']]){
  let state={...runner.createLessonState(p),index:6,phase:'response',audioReady:true,slots:[null,null]};
  for(const [j,value]of values.entries())for(const action of chapterNineActions(s,value,j,state))state=runner.transitionLesson(p,state,{...action,screenId:s.screenId});
  assert.equal(state.outcomes[6].correct,true);assert.equal(new Set(state.slots).size,2);
 }
 assert.equal(s.sourceContract.responseSlotCount,2);
});

for(const [id,index,values]of [[ids[0],4,['いらっしゃい。','ごゆっくり','どうぞ、','ご覧','ください。']],[ids[1],15,['荷物を','観光している間、','ホテルで','預かって','もらえますか。']]])test(`reviewed service-request order in ${id} preserves meaning`,async()=>{
 const {chapterNineActions}=await import('./busuu-chapter-nine-responses.mjs'),registry=loadCourseModule('lib/busuu/content-registry.ts'),runner=loadCourseModule('lib/busuu/runner.ts');
  const p=registry.getContentPack(id),s=p.screens[index];let state={...runner.createLessonState(p),index,phase:'response',audioReady:true,slots:Array(5).fill(null)};
  for(const [j,value]of values.entries())for(const action of chapterNineActions(s,value,j,state))state=runner.transitionLesson(p,state,{...action,screenId:s.screenId});assert.equal(state.outcomes[index].correct,true,s.screenId);
});
