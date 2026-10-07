import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadCourseModule} from './busuu-test-helpers.mjs';
const ids=['L01','L02','L03','L04','L05','L06','L07','CP'].map(k=>`B2.C08.${k}`);
test('all eight chapter eight entries are registered and playable',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),readiness=loadCourseModule('lib/busuu/content-readiness.ts');
 for(const id of ids){const p=registry.getContentPack(id);assert.ok(p,id);assert.equal(readiness.getPackReadiness(p).playable,true,id);}
});

test('132 observed rows preserve exact identities, variants, partitions and 234 physical required responses',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),raw=JSON.parse(fs.readFileSync(new URL('../content/busuu/b2-structure.json',import.meta.url))).records;
 const maps=JSON.parse(fs.readFileSync(new URL('../scripts/busuu-chapter-eight-occurrences.json',import.meta.url))).screens;
 const partitions=[[10,10],[9,8],[10,9],[10,9],[8,10],[9],[10],[20]],physical=[32,27,32,22,29,15,19,58],counts=[20,17,19,19,18,8,10,20];
 const renderers={sentence_model:'model',word_model:'model',explanation_table:'table',true_false:'truth',token_gap:'gaps',character_order:'gaps',single_choice:'choice',typed_gap:'typed',chunk_order:'ordering',pair_match:'pairs',kanji_animation:'kanji',scene_video:'dialogue'};
 let required=0,optional=0,responses=0;
 for(const [i,id]of ids.entries()){
  const p=registry.getContentPack(id),r=raw.find(r=>r.recordId===id);assert.ok(p,id);registry.assertContentAlignment(p,r);
  assert.ok(['1.0.0', '1.1.0'].includes(p.contentVersion), 'released or text-polished version');assert.equal(p.structuralContract,undefined);assert.equal(p.baseScreenCount,counts[i]);
  assert.deepEqual(r.activities.map(a=>a.baseScreenCount),partitions[i]);
  const sum=p.screens.reduce((n,s)=>n+s.sourceContract.responseSlotCount,0);assert.equal(sum,physical[i]);responses+=sum;required+=p.baseScreenCount;optional+=p.completion?.optionalSurfaces.length??0;
  for(const [j,s]of p.screens.entries()){
   const source=r.screens[j],c=s.sourceContract;
   for(const [key,value]of Object.entries({sourceScreenId:source.sourceScreenId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,responseSlotCount:source.rawResponseSlotCount,sourceRenderer:source.rawRenderer,sourceRendererId:source.sourceRendererId}))assert.equal(c[key],value,`${s.screenId} ${key}`);
   assert.deepEqual(c.recordedSupport,source.rawSupport);assert.deepEqual(s.unresolved,[]);assert.ok(s.evidence.length);
   for(const field of ['targetConceptIds','priorConceptIds','feedbackCategories'])assert.deepEqual(c[field],maps[s.screenId][field],`${s.screenId} ${field}`);
   assert.equal(s.renderer,renderers[source.rawRenderer],`${s.screenId} actual renderer ${source.rawRenderer}`);
   const a=s.answer,actual=a?.kind==='pairs'?a.pairs.length:a?.kind==='ordered_slots'?a.slots.length:a?.kind==='ordered_tokens'?a.tokens.length:a?1:0;assert.equal(actual,c.responseSlotCount,s.screenId);
   if(a?.tokens)assert.equal(new Set(a.tokens.map(t=>t.id)).size,a.tokens.length,s.screenId);
  }
 }
 assert.equal(required,131);assert.equal(optional,1);assert.equal(required+optional,132);assert.equal(responses,234);assert.equal(Object.keys(maps).length,132);
 assert.deepEqual(registry.getContentPack(ids[0]).retryPolicy,{kind:'after_activity_once',screenIds:['B2.C08.L01.A02.S07']});
 assert.ok(ids.slice(1).every(id=>!registry.getContentPack(id).retryPolicy));
});

test('independently specified Japanese responses complete all eight registered evaluator paths',async()=>{
 const {chapterEightResponses,chapterEightActions}=await import('./busuu-chapter-eight-responses.mjs'),registry=loadCourseModule('lib/busuu/content-registry.ts'),attempt=loadCourseModule('lib/busuu/attempt.ts');
 for(const id of ids){const p=registry.getContentPack(id);let state=attempt.initialAttemptState(p);
  const send=a=>state=attempt.evaluateAction(p,state,{...a,screenId:p.screens[state.index].screenId});
  assert.equal(chapterEightResponses[id].length,p.baseScreenCount);
  for(const [i,s]of p.screens.entries()){
   assert.equal(state.index,i);if(!state.audioReady)send({type:'audio_ready'});
   for(const [j,v]of chapterEightResponses[id][i].entries())for(const action of chapterEightActions(s,v,j,state))send(action);
   if(s.renderer==='typed')send({type:'typed_check'});if(s.answer)assert.equal(state.outcomes[i]?.correct,true,s.screenId);send({type:'continue'});
  }
  assert.equal(state.phase,'result');assert.equal(state.retry,undefined);assert.equal(state.retryOutcomes,undefined);
  const r=attempt.attemptResult(p,state);assert.equal(r.percent,100);assert.equal(r.completionEligible,true);assert.equal(new Set(state.visited).size,p.baseScreenCount);
 }
});

test('sole retry returns only after twenty base screens and preserves first accuracy for either outcome',async()=>{
 const {chapterEightResponses,chapterEightActions}=await import('./busuu-chapter-eight-responses.mjs'),registry=loadCourseModule('lib/busuu/content-registry.ts'),attempt=loadCourseModule('lib/busuu/attempt.ts'),p=registry.getContentPack(ids[0]),target=16;
 for(const retryCorrect of [true,false]){
  let state=attempt.initialAttemptState(p);const send=a=>state=attempt.evaluateAction(p,state,{...a,screenId:p.screens[state.index].screenId});
  const s=p.screens[target],wrong=s.answer.options.find(o=>!s.answer.acceptedOptionIds.includes(o.id)).id,options=structuredClone(s.answer.options);
  for(const [i,screen]of p.screens.entries()){
   assert.equal(state.index,i);if(!state.audioReady)send({type:'audio_ready'});
   for(const [j,v]of (i===target?[wrong]:chapterEightResponses[p.recordId][i]).entries())for(const action of chapterEightActions(screen,v,j,state))send(action);
   if(screen.renderer==='typed')send({type:'typed_check'});send({type:'continue'});if(i<19)assert.equal(state.retry,undefined);
  }
  assert.equal(state.index,target);assert.equal(state.retry.returnIndex,20);assert.equal(state.audioReady,false);assert.equal(state.visited.length,20);
  const first=structuredClone(state.outcomes);{const saved=state;send({type:'choice',id:wrong});state=saved;}send({type:'audio_ready'});
  send({type:'choice',id:retryCorrect?chapterEightResponses[p.recordId][target][0]:wrong});assert.deepEqual(state.outcomes,first);send({type:'continue'});
  assert.equal(state.phase,'result');assert.equal(state.retryOutcomes[target].correct,retryCorrect);assert.deepEqual(s.answer.options,options);
  assert.equal(s.sourceContract.sourceExerciseNumber,7);assert.equal(new Set(state.visited).size,20);
  const r=attempt.attemptResult(p,state),graded=p.screens.filter(s=>s.answer).length;assert.equal(r.completionEligible,true);assert.equal(r.percent,Math.round((graded-1)/graded*100));
 }
});

test('source scripts, limited feedback, response banks and unavailable parallel readings follow each occurrence',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),content=loadCourseModule('lib/busuu/content-readiness.ts'),Screen=loadCourseModule('components/busuu/LessonScreen.tsx').default;
 for(const p of ids.map(id=>registry.getContentPack(id)))for(const s of p.screens){
  const c=s.sourceContract;
  if(c.recordedSupport.parallel_kana_available===false)assert.ok(!s.support.before.some(b=>b.kind==='japanese'&&b.secondary),s.screenId);
  if(c.recordedSupport.transcript_in_feedback===false&&s.answer){assert.equal(s.audio.feedbackText,undefined,s.screenId);assert.ok(!s.support.after.some(b=>b.kind==='japanese'&&b.text===s.audio.text),s.screenId);}
  if(c.transcriptBeforeAnswer===false&&!content.isTeachingScreen(s)){
   assert.deepEqual(s.support.before,[]);
   const html=renderToStaticMarkup(React.createElement(Screen,{screen:s,state:{phase:'response',audioReady:true,slots:s.answer?.tokens?Array(s.answer.tokens.length).fill(null):[],matches:[]},dispatch(){}}));
   const full=html.includes(s.audio.text),bankException=s.answer?.kind==='choice'&&s.answer.options.some(o=>o.text===s.audio.text);
   if(bankException)assert.equal(html.split(s.audio.text).length-1,1,s.screenId);else assert.equal(full,false,s.screenId);
   if(s.renderer==='ordering')for(const t of s.answer.tokens)assert.ok(html.includes(t.text),`${s.screenId} response bank`);
  }
  if(c.recordedSupport.japanese_transcript_before_answer===true&&s.renderer!=='dialogue')assert.ok(s.support.before.some(b=>b.kind==='japanese'),s.screenId);
  if(c.recordedSupport.translation_visible===true&&s.renderer!=='dialogue')assert.ok(s.support.before.some(b=>b.kind==='translation'),s.screenId);
  if(s.renderer==='pairs'){assert.equal(s.audio.beforeAnswer,false);assert.equal(s.audio.required,false);}
 }
 assert.deepEqual(registry.getContentPack(ids[3]).screens.filter(s=>s.renderer==='kanji').map(s=>s.kanji.character),['腹','顔','首','指','歯']);
});

test('L06 optional writing retains source exercise ten and is private local state outside course events',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),attempt=loadCourseModule('lib/busuu/attempt.ts'),p=registry.getContentPack(ids[5]),surface=p.completion.optionalSurfaces[0];
 assert.equal(p.schemaVersion,'1.1');assert.equal(surface.screenId,'B2.C08.L06.A01.S09');assert.equal(surface.sourceExerciseNumber,10);assert.deepEqual(surface.modes,['write']);
 assert.equal(p.baseScreenCount,8);assert.ok(surface.hint.includes('かな'));assert.throws(()=>attempt.evaluateAction(p,attempt.initialAttemptState(p),{type:'typed_draft',screenId:surface.screenId,text:'魚を食べようかな。'}));
 const setters=[];let index=0;const Optional=loadCourseModule('components/busuu/OptionalProduction.tsx',{react:{...React,useState(){index++;return[index===1?true:'',value=>setters.push(value)];}}}).default;
 const tree=Optional({surface}),nodes=[];const walk=v=>{if(!v||typeof v!=='object')return;nodes.push(v);for(const c of [v.props?.children].flat(Infinity))walk(c);};walk(tree);
 const textarea=nodes.find(n=>n.type==='textarea');assert.ok(textarea);textarea.props.onChange({target:{value:'魚を食べようかな。'}});assert.deepEqual(setters,['魚を食べようかな。']);
 assert.ok(!nodes.some(n=>n.type==='button'&&/submit|speak|record|check/i.test(String(n.props.children))));
});

test('checkpoint preserves explicit app pass policy separately from completion and accuracy',()=>{
 const p=loadCourseModule('lib/busuu/content-registry.ts').getContentPack(ids[7]),runner=loadCourseModule('lib/busuu/runner.ts');assert.deepEqual(p.passPolicy,{kind:'none'});
 for(const correct of [15,16,17,20])assert.equal(runner.getPassOutcome(p,{completionEligible:true,graded:20,correct}),null);
 assert.equal(runner.getPassOutcome(p,{completionEligible:false,graded:20,correct:20}),null);
});

test('gift-shopping scene exposes documented English, keeps Japanese hidden and binds only legitimate full-scene replays',async()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),content=loadCourseModule('lib/busuu/content-readiness.ts'),Screen=loadCourseModule('components/busuu/LessonScreen.tsx').default,p=registry.getContentPack(ids[6]),scene=p.screens[1];
 assert.equal(scene.dialogue.japaneseVisible,false);assert.equal(scene.dialogue.translationVisible,true);assert.ok(scene.dialogue.turns.length>=7);
 const html=renderToStaticMarkup(React.createElement(Screen,{screen:scene,state:{phase:'presentation',audioReady:true,slots:[],matches:[]},dispatch(){}}));
 for(const t of scene.dialogue.turns){assert.ok(t.japanese&&t.reading&&t.english);assert.ok(html.includes(t.english));assert.ok(!html.includes(t.japanese));assert.ok(!html.includes(t.reading));}
 assert.equal(content.getAudioScript(scene),scene.dialogue.turns.map(t=>t.japanese).join('\n'));
 assert.deepEqual(p.screens.flatMap((s,i)=>s.sourceContract.sceneReuse?[i]:[]),[2,3,5,6,7,8,9]);
 assert.ok(p.screens.every(s=>!s.sceneContext&&!s.sourceContract.transcriptAccess));
 // Exercise the actual shared playback handler against this new complete bound scene.
 for(const index of [2,9]){
  const calls=[],dispatched=[],state={phase:'response',index,preview:true,audioReady:false,visited:[],outcomes:{},slots:[],matches:[]};
  const audio={setScreen(){},async playDialogue(turns){calls.push(turns);return true;},async play(){throw Error('Full bound scene must play all dialogue turns');}};let n=0;
  const Runner=loadCourseModule('components/busuu/LessonRunner.tsx',{react:{...React,useState(initial){n++;return[n===1?state:n===6?true:typeof initial==='function'?initial():initial,fn=>{if(typeof fn==='function')dispatched.push(fn(state));}];},useRef(initial){return{current:initial===null?audio:initial};},useCallback(fn){return fn;},useEffect(){}}}).default;
  const tree=Runner({pack:p,preview:true,title:'Gift shopping',returnHref:'/busuu/B2',onExit(){}}),buttons=[];const walk=v=>{if(!v||typeof v!=='object')return;if(v.type==='button')buttons.push(v);for(const c of [v.props?.children].flat(Infinity))walk(c);};walk(tree);
  const replay=buttons.find(b=>String(b.props['aria-label']??b.props.children).includes('Replay scene'));assert.ok(replay);await replay.props.onClick();
  assert.equal(content.getSceneReuse(p,p.screens[index]),scene);assert.deepEqual(calls[0].map(t=>t.text),scene.dialogue.turns.map(t=>t.japanese));assert.equal(dispatched.at(-1).audioReady,true);
 }
});

test('typed birth and desire acceptance is occurrence-specific and excludes supplied endings',async()=>{
 const {chapterEightResponses,chapterEightActions}=await import('./busuu-chapter-eight-responses.mjs'),registry=loadCourseModule('lib/busuu/content-registry.ts'),attempt=loadCourseModule('lib/busuu/attempt.ts');
 const cases=[['B2.C08.L01',7,['うまれの','umareno'],['生まれの','うまれ','の','うまれのはず']],['B2.C08.L06',6,['食べたい','たべたい','tabetai'],['食べよう','食べたいかな','たべる']],['B2.C08.CP',6,['食べたい','たべたい','tabetai'],['食べよう','食べたいかな']],['B2.C08.CP',8,['うまれ','umare'],['生まれ','うまれの','の']]];
 for(const [id,index,accepted,rejected]of cases){const p=registry.getContentPack(id),s=p.screens[index];assert.deepEqual(s.answer.acceptedForms,accepted,s.screenId);
  for(const value of [...accepted,...rejected]){
   let state=attempt.initialAttemptState(p);const send=a=>state=attempt.evaluateAction(p,state,{...a,screenId:p.screens[state.index].screenId});
   for(let i=0;i<index;i++){const prev=p.screens[i];if(!state.audioReady)send({type:'audio_ready'});for(const [j,v]of chapterEightResponses[id][i].entries())for(const a of chapterEightActions(prev,v,j,state))send(a);if(prev.renderer==='typed')send({type:'typed_check'});send({type:'continue'});}
   if(!state.audioReady)send({type:'audio_ready'});send({type:'typed_draft',text:value});send({type:'typed_check'});assert.equal(state.outcomes[index].correct,accepted.includes(value),`${s.screenId}: ${value}`);
  }
 }
});

test('reviewed checkpoint discourse alternatives retain meaning and grade correctly',async()=>{
 const {chapterEightResponses,chapterEightActions}=await import('./busuu-chapter-eight-responses.mjs'),p=loadCourseModule('lib/busuu/content-registry.ts').getContentPack(ids[7]),attempt=loadCourseModule('lib/busuu/attempt.ts');
 for(const [target,values]of [[10,['どうぞ','こちらの','料理を','お召し上がり','ください。']],[15,['このお茶は','味もいいし、','いい匂いがするし、','おすすめです。']],[5,['魚を','今夜は、','焼いて','食べよう','かな。']],[12,['プレゼントを','もらったので、','母は','喜んでいる','はずです。']]]){
  let state=attempt.initialAttemptState(p);const send=a=>state=attempt.evaluateAction(p,state,{...a,screenId:p.screens[state.index].screenId});
  for(let i=0;i<=target;i++){const s=p.screens[i];if(!state.audioReady)send({type:'audio_ready'});for(const [j,v]of (i===target?values:chapterEightResponses[p.recordId][i]).entries())for(const a of chapterEightActions(s,v,j,state))send(a);if(s.renderer==='typed')send({type:'typed_check'});assert.equal(state.outcomes[i].correct,true,s.screenId);if(i<target)send({type:'continue'});}
 }
});
