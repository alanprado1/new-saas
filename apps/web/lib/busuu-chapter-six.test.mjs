import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadCourseModule} from './busuu-test-helpers.mjs';
import {chapterSixResponses,chapterSixAction} from './busuu-chapter-six-responses.mjs';
const registry=loadCourseModule('lib/busuu/content-registry.ts'),inventory=loadCourseModule('lib/busuu/inventory.ts');
const readiness=loadCourseModule('lib/busuu/readiness.ts'),attempt=loadCourseModule('lib/busuu/attempt.ts'),content=loadCourseModule('lib/busuu/content-readiness.ts');
const packs=Object.keys(chapterSixResponses).map(id=>registry.getContentPack(id));
const raw=JSON.parse(fs.readFileSync(new URL('../content/busuu/b2-structure.json',import.meta.url))).records;
const occurrences=Object.assign({},...['taste','emphasis','rail'].map(group=>JSON.parse(fs.readFileSync(new URL(`../scripts/busuu-chapter-six-${group}-occurrences.json`,import.meta.url))).screens));

test('seven packs retain 119 surfaces, 118 core tasks, known activity partitions and all 100 source rows without promoting the summary',()=>{
 assert.deepEqual(packs.map(p=>p.baseScreenCount),[19,7,18,19,20,15,20]);
 const partitions=[[11,8],[8],[10,8],[10,9],[10,10],[8,7],[20]];
 for(const [i,p]of packs.entries()) {
  const source=raw.find(r=>r.recordId===p.recordId);registry.assertContentAlignment(p,source);
  const spec=inventory.getLessonSpec(p.recordId),r=readiness.getLessonReadiness(spec);
  assert.equal(r.scoredLaunchReady,true,p.recordId);assert.equal(p.status,'reviewed');assert.ok(['1.0.0', '1.1.0', '1.2.0'].includes(p.contentVersion), 'released or text-polished version');
  assert.deepEqual(source.activities.map(a=>a.baseScreenCount),partitions[i]);
  if(i===0){assert.equal(r.structure.knownScreenRows,0);assert.equal(r.structure.authoredScreenRows,19);
   assert.deepEqual(p.structuralContract.activities.map(a=>a.baseScreenCount),[11,8]);assert.equal(p.provenance.origin,'app_authored');
   assert.ok(p.screens.every(s=>s.sourceContract.responseSlotCount===null&&s.sourceContract.sourceActivityId===null&&s.sourceContract.sourceScreenId===null));continue;}
  assert.equal(p.structuralContract,undefined);
  for(const [j,s]of p.screens.entries()) {
   const r=source.screens[j],c=s.sourceContract;
   for(const [key,value]of Object.entries({sourceScreenId:r.sourceScreenId,sourceActivityId:r.sourceActivityId,sourceExerciseNumber:r.sourceExerciseNumber,responseSlotCount:r.rawResponseSlotCount,sourceRenderer:r.rawRenderer,sourceRendererId:r.sourceRendererId}))assert.equal(c[key],value,`${s.screenId} ${key}`);
   assert.deepEqual(c.recordedSupport,r.rawSupport);assert.deepEqual(s.unresolved,[]);assert.ok(s.evidence.length);
   for(const field of ['targetConceptIds','priorConceptIds','feedbackCategories'])assert.deepEqual(c[field],occurrences[s.screenId][field],`${s.screenId} ${field}`);
   assert.equal(c.transcriptBeforeAnswer,r.rawSupport.japanese_transcript_before_answer);assert.equal(c.translationBeforeAnswer,r.rawSupport.translation_visible);
  }
 }
 assert.equal(packs.reduce((n,p)=>n+p.baseScreenCount,0),118);
 assert.equal(packs.reduce((n,p)=>n+(p.completion?.optionalSurfaces.length??0)+p.baseScreenCount,0),119);
 assert.equal(raw.filter(r=>r.recordId.startsWith('B2.C06.')).reduce((n,r)=>n+r.screens.length,0),100);
 assert.deepEqual(packs[2].retryPolicy,{kind:'after_activity_once',screenIds:['B2.C06.L03.A01.S10']});
 assert.deepEqual(packs[3].retryPolicy,{kind:'after_activity_once',screenIds:['B2.C06.L04.A01.S05']});
 assert.ok(packs.filter((_,i)=>![2,3].includes(i)).every(p=>!p.retryPolicy));
});

test('retained production_choice tail projects only L02 separate private writing and never accepts course events',()=>{
 const p=packs[1],source=raw.find(r=>r.recordId===p.recordId);
 assert.deepEqual(registry.getRuntimeCompletionMetadata(source),{endpointOptional:true,coreTeachingScreenCount:7});
 const optional=p.completion.optionalSurfaces[0];assert.equal(optional.screenId,'B2.C06.L02.A01.S08');assert.deepEqual(optional.modes,['write']);
 assert.equal(optional.sourceActivityId,source.screens[7].sourceActivityId);assert.equal(optional.sourceExerciseNumber,source.screens[7].sourceExerciseNumber);
 assert.throws(()=>attempt.evaluateAction(p,attempt.initialAttemptState(p),{type:'typed_draft',screenId:optional.screenId,text:'甘いです。'}));
 const bad=structuredClone(source);bad.screens[7].rawRenderer='choice';assert.equal(registry.getRuntimeCompletionMetadata(bad),null);assert.throws(()=>registry.assertContentAlignment(p,bad));
 const mid=structuredClone(source);mid.screens[3].rawRenderer='production_choice';assert.equal(registry.getRuntimeCompletionMetadata(mid),null);
});

test('118 independent Japanese responses complete every registered evaluator with unique base counts',()=>{
 for(const p of packs) {
  let state=attempt.initialAttemptState(p);const send=a=>state=attempt.evaluateAction(p,state,{...a,screenId:p.screens[state.index].screenId});
  for(const [i,s]of p.screens.entries()) {
   assert.equal(state.index,i);if(!state.audioReady)send({type:'audio_ready'});
   for(const [j,v]of chapterSixResponses[p.recordId][i].entries())send(chapterSixAction(s,v,j,state));
   if(s.renderer==='typed')send({type:'typed_check'});if(s.answer)assert.equal(state.outcomes[i]?.correct,true,s.screenId);send({type:'continue'});
  }
  assert.equal(state.phase,'result');assert.equal(state.retry,undefined);assert.equal(state.retryOutcomes,undefined);
  const result=attempt.attemptResult(p,state);assert.equal(result.percent,100);assert.equal(result.completionEligible,true);assert.equal(state.visited.length,p.baseScreenCount);
 }
});

test('documented first-activity retries keep first accuracy and base counts immutable and permit either retry outcome',()=>{
 for(const p of [packs[2],packs[3]])for(const retryCorrect of [true,false]) {
  const target=p.recordId.endsWith('L03')?9:4,values=p.recordId.endsWith('L03')?['o1']:[true];
  let state=attempt.initialAttemptState(p);const send=a=>state=attempt.evaluateAction(p,state,{...a,screenId:p.screens[state.index].screenId});
  for(let i=0;i<p.screens.length;i++) {
   const s=p.screens[i];assert.equal(state.index,i);if(!state.audioReady)send({type:'audio_ready'});
   for(const [j,v]of (i===target?values:chapterSixResponses[p.recordId][i]).entries())send(chapterSixAction(s,v,j,state));
   if(s.renderer==='typed')send({type:'typed_check'});send({type:'continue'});
   if(i===9){
    assert.equal(state.index,target);assert.equal(state.retry.returnIndex,10);assert.equal(state.visited.length,10);assert.equal(state.audioReady,false);
    const outcomes=structuredClone(state.outcomes);{const saved=state;send(chapterSixAction(p.screens[target],values[0],0,state));state=saved;}
    send({type:'audio_ready'});const response=retryCorrect?chapterSixResponses[p.recordId][target]:values;
    for(const [j,v]of response.entries())send(chapterSixAction(p.screens[target],v,j,state));
    assert.deepEqual(state.outcomes,outcomes);send({type:'continue'});assert.equal(state.index,10);assert.equal(state.retryOutcomes[target].correct,retryCorrect);
   }
  }
  const result=attempt.attemptResult(p,state);assert.equal(state.phase,'result');assert.equal(result.completionEligible,true);
  assert.equal(result.percent,Math.round((p.screens.filter(s=>s.answer).length-1)/p.screens.filter(s=>s.answer).length*100));
  assert.equal(state.visited.length,p.baseScreenCount);
 }
});

test('listening support, transcript-free banks, limited feedback and two exact full scenes retain occurrence timing',()=>{
 const Screen=loadCourseModule('components/busuu/LessonScreen.tsx').default,p=packs[5];
 const scenes=p.screens.filter(s=>s.renderer==='dialogue');assert.deepEqual(scenes.map(s=>s.screenId),['B2.C06.L06.A01.S02','B2.C06.L06.A02.S01']);
 for(const s of scenes){assert.equal(s.dialogue.translationVisible,false);assert.ok(s.dialogue.turns.every(t=>t.english===null&&t.japanese&&t.reading));assert.equal(content.getAudioScript(s),s.dialogue.turns.map(t=>t.japanese).join('\n'));}
 for(const i of [2,3])assert.equal(content.getSceneReuse(p,p.screens[i]),scenes[0]);
 for(const i of [9,10,11,12,14])assert.equal(content.getSceneReuse(p,p.screens[i]),scenes[1]);
 assert.equal(p.screens[2].sourceContract.transcriptAccess,'scene_recap');assert.deepEqual(p.screens[2].support.before,[]);
 for(const pack of packs)for(const s of pack.screens.filter(s=>s.sourceContract.transcriptBeforeAnswer===false&&!content.isTeachingScreen(s))) {
  const html=renderToStaticMarkup(React.createElement(Screen,{screen:s,state:{phase:'response',audioReady:true,slots:s.answer?.kind==='ordered_tokens'?Array(s.answer.tokens.length).fill(null):[],matches:[]},dispatch(){}}));
  assert.deepEqual(s.support.before,[]);
  // A legitimate response option can itself be the target sentence; it is not an extra source-support layer.
  if(s.answer?.kind==='choice'&&s.answer.options.some(o=>o.text===s.audio.text))assert.equal(html.split(s.audio.text).length-1,1,s.screenId);
  else assert.ok(!html.includes(s.audio.text),s.screenId);
  if(s.renderer==='ordering')for(const t of s.answer.tokens)assert.ok(html.includes(t.text),`${s.screenId} response bank`);
 }
 for(const pack of packs)for(const s of pack.screens.filter(s=>s.sourceContract.recordedSupport.transcript_in_feedback===false)) {
  assert.ok(!s.support.after.some(b=>b.kind==='japanese'&&b.text===s.audio.text),s.screenId);
  assert.equal(s.audio.feedbackText,undefined,s.screenId);
 }
 assert.deepEqual(packs[4].screens.filter(s=>s.renderer==='kanji').map(s=>s.kanji.character),['客','観','光','遠','杯']);
});

test('same-meaning frequency order grades correctly and observed choices retain their kana response layer',()=>{
 const p=packs[6],s=p.screens[0];let state=attempt.initialAttemptState(p);if(!state.audioReady)state=attempt.evaluateAction(p,state,{type:'audio_ready',screenId:s.screenId});
 for(const [j,v]of ['一日に','この店に','食べに','五回も','来ました。'].entries())state=attempt.evaluateAction(p,state,{...chapterSixAction(s,v,j,state),screenId:s.screenId});
 assert.equal(state.outcomes[0].correct,true);
 for(const [pack,index]of [[packs[2],8],[packs[2],9],[packs[3],2],[packs[3],11],[packs[6],7],[packs[6],8],[packs[6],16]]){
  const s=pack.screens[index];assert.ok(s.answer.options.every(o=>o.secondary&&/[\u3040-\u30ff]/.test(o.secondary)),s.screenId);
 }
 const noReplay=['B2.C06.L04.A02.S05','B2.C06.L04.A02.S06','B2.C06.L04.A02.S08','B2.C06.L04.A02.S09','B2.C06.L06.A02.S06','B2.C06.CP.A01.S01','B2.C06.CP.A01.S02','B2.C06.CP.A01.S04','B2.C06.CP.A01.S07'];
 for(const id of noReplay){const s=packs.flatMap(p=>p.screens).find(s=>s.screenId===id);assert.equal(s.audio.beforeAnswer,false,id);assert.equal(s.audio.required,false,id);}
});

test('tourist and rail replay handlers play their complete bound scenes, including the final unsupported ordering',async()=>{
 const p=packs[5];
 for(const index of [2,9,12,14]){
  const calls=[],dispatched=[],state={phase:'response',index,preview:true,audioReady:false,visited:[],outcomes:{},slots:[],matches:[]};
  const audio={setScreen(){},async playDialogue(turns){calls.push(turns);return true;},async play(){throw new Error('A bound full scene must use dialogue playback');}};
  let count=0;
  const Runner=loadCourseModule('components/busuu/LessonRunner.tsx',{react:{...React,useState(initial){count++;return[count===1?state:count===6?true:typeof initial==='function'?initial():initial,fn=>{if(typeof fn==='function')dispatched.push(fn(state));}];},useRef(initial){return{current:initial===null?audio:initial};},useCallback(fn){return fn;},useEffect(){}}}).default;
  const tree=Runner({pack:p,preview:true,title:'Rail announcement',returnHref:'/busuu/B2',onExit(){}}),buttons=[];
  const walk=v=>{if(!v||typeof v!=='object')return;if(v.type==='button')buttons.push(v);for(const c of [v.props?.children].flat(Infinity))walk(c);};walk(tree);
  const button=buttons.find(b=>String(b.props['aria-label']??b.props.children).includes('Replay scene'));assert.ok(button,p.screens[index].screenId);await button.props.onClick();
  const scene=content.getSceneReuse(p,p.screens[index]);assert.deepEqual(calls[0].map(t=>t.text),scene.dialogue.turns.map(t=>t.japanese));
  assert.ok(calls[0].length>1);assert.equal(dispatched.at(-1).audioReady,true);
 }
});
