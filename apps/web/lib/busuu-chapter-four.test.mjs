import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from './busuu-test-helpers.mjs';
import { chapterFourResponses, chapterFourAction } from './busuu-chapter-four-responses.mjs';
const registry = loadCourseModule('lib/busuu/content-registry.ts'), inventory = loadCourseModule('lib/busuu/inventory.ts');
const readiness = loadCourseModule('lib/busuu/readiness.ts'), attempt = loadCourseModule('lib/busuu/attempt.ts');
const contentReady = loadCourseModule('lib/busuu/content-readiness.ts');
const entries = Object.keys(chapterFourResponses).map(id => registry.getContentPack(id));
test('all six chapter 4 packs retain 114 rows, exact partitions, original activity/exercise identities, counts and support', () => {
 const raw=JSON.parse(fs.readFileSync(new URL('../content/busuu/b2-structure.json',import.meta.url))).records;
 assert.deepEqual(entries.map(p=>p.baseScreenCount),[20,19,18,21,16,20]);
 assert.equal(entries.reduce((n,p)=>n+p.baseScreenCount,0),114);
 for (const [j,p] of entries.entries()) {
  assert.equal(p.status,'reviewed'); assert.ok(['1.0.0', '1.1.0'].includes(p.contentVersion), 'released or text-polished version'); assert.equal(p.completion,undefined);
  const spec=inventory.getLessonSpec(p.recordId), source=raw.find(r=>r.recordId===p.recordId);
  registry.assertContentAlignment(p,source); assert.equal(readiness.getLessonReadiness(spec).scoredLaunchReady,true,p.recordId);
  assert.deepEqual(spec.activities.map(a=>a.screenIds.length),[[10,10],[10,9],[12,6],[12,9],[8,8],[20]][j]);
  assert.deepEqual(p.screens.map(s=>s.screenId),spec.activities.flatMap(a=>a.screenIds));
  for (const [i,s] of p.screens.entries()) {
   assert.equal(s.sourceContract.sourceActivityId,source.screens[i].sourceActivityId);
   assert.equal(s.sourceContract.sourceExerciseNumber,source.screens[i].sourceExerciseNumber);
   assert.equal(s.sourceContract.responseSlotCount,source.screens[i].rawResponseSlotCount);
   assert.deepEqual(s.sourceContract.recordedSupport,source.screens[i].rawSupport); assert.deepEqual(s.unresolved,[]);
  }
 }
 assert.deepEqual(entries[0].retryPolicy,{kind:'after_activity_once',screenIds:['B2.C04.L01.A01.S02']});
 assert.deepEqual(entries[2].retryPolicy,{kind:'after_activity_once',screenIds:['B2.C04.L03.A01.S09']});
 for (const p of [entries[1],entries[3],entries[4],entries[5]]) assert.equal(p.retryPolicy,undefined);
 assert.deepEqual(entries[5].passPolicy,{kind:'none'});
});
test('114 independently reviewed responses complete every actual registered evaluator with 100 percent base accuracy', () => {
 for (const p of entries) {
  let s=attempt.initialAttemptState(p);
  const send=a=>{s=attempt.evaluateAction(p,s,{...a,screenId:p.screens[s.index].screenId});};
  for (const [i,screen] of p.screens.entries()) {
   assert.equal(s.index,i); if(!s.audioReady)send({type:'audio_ready'});
   for (const [j,value] of chapterFourResponses[p.recordId][i].entries()) send(chapterFourAction(screen,value,j,s));
   if (screen.renderer==='typed')send({type:'typed_check'});
   if (screen.renderer==='multi_choice') {assert.equal(s.phase,'response');send({type:'selection_check'});}
   if(screen.answer) assert.equal(s.outcomes[i]?.correct,true,screen.screenId);
   send({type:'continue'});
  }
  assert.equal(s.phase,'result'); assert.equal(s.retry,undefined); assert.equal(s.retryOutcomes,undefined);
  assert.equal(s.visited.length,p.baseScreenCount); const result=attempt.attemptResult(p,s);
  assert.equal(result.percent,100); assert.equal(result.completionEligible,true);
 }
});
test('two Japanese-only scenes and every supported comprehension/replay resolve to the correct authored activity', () => {
 const p=entries[4], scenes=p.screens.filter(s=>s.renderer==='dialogue');
 assert.deepEqual(scenes.map(s=>s.screenId),['B2.C04.L05.A01.S03','B2.C04.L05.A02.S01']);
 for (const s of scenes) {
  assert.equal(s.dialogue.translationVisible,false); assert.equal(s.dialogue.japaneseVisible,true);
  assert.ok(s.dialogue.turns.every(t=>t.japanese&&t.reading&&t.english===null));
  assert.equal(contentReady.getAudioScript(s),s.dialogue.turns.map(t=>t.japanese).join('\n'));
 }
 for(const i of [3,4,5,6])assert.equal(contentReady.getSceneReuse(p,p.screens[i]).screenId,scenes[0].screenId);
 for(const i of [9,10,11,12,13,14])assert.equal(contentReady.getSceneReuse(p,p.screens[i]).screenId,scenes[1].screenId);
 assert.equal(p.screens[15].sourceContract.sceneReuse,undefined); assert.equal(p.screens[15].sourceContract.transcriptBeforeAnswer,false);
 assert.equal(p.screens[15].audio.required,true);
 assert.equal(entries[5].screens.some(s=>s.sceneContext||s.sourceContract.sceneReuse),false);
});
test('all unsupported chapter 4 listening excludes scripts, translations and scene replay from pre-answer markup', () => {
 const Screen=loadCourseModule('components/busuu/LessonScreen.tsx').default;
 for(const p of entries)for(const s of p.screens.filter(s=>s.sourceContract.transcriptBeforeAnswer===false)) {
  const html=renderToStaticMarkup(React.createElement(Screen,{screen:s,state:{phase:'response',audioReady:true,slots:[],matches:[]},dispatch(){}}));
  assert.ok(!html.includes(s.audio.text),s.screenId); assert.deepEqual(s.support.before,[]);
  for(const b of s.support.after.filter(b=>b.kind==='translation'))assert.ok(!html.includes(b.text),s.screenId);
  assert.doesNotMatch(html,/<audio|title=/); assert.equal(contentReady.getSceneReuse(p,s),null);
 }
});
test('kanji models teach reviewed word-specific readings and physical repeated characters; register precedes imperative practice', () => {
 const p=entries[3];assert.deepEqual(p.screens.filter(s=>s.renderer==='kanji').map(s=>s.kanji.character),['勝','負','点','位','球']);
 assert.match(p.screens[2].kanji.readings.map(r=>r.text).join(','),/お-う.*ふ/);
 assert.match(p.screens[6].support.after.map(b=>b.text).join(' '),/一点（いってん）/);
 for(const i of [6,14]) {
  const s=p.screens[i], repeated=s.answer.tokens.filter(t=>t.text==='点');assert.equal(repeated.length,2);assert.notEqual(repeated[0].id,repeated[1].id);
 }
 assert.equal(p.screens[11].answer.kind,'ordered_slots');assert.equal(p.screens[11].answer.slots.length,5);
 assert.match(entries[2].screens[1].support.before.map(b=>b.text).join(' '),/strong direct command/);
 for(const p of entries)for(const s of p.screens.filter(s=>s.renderer==='typed')) {
  assert.equal(s.answer.normalization,'nfkc_trim');assert.ok(s.answer.acceptedForms.every(f=>!/[a-z]/i.test(f)));
 }
});
test('negative intention accepts reviewed object-first order in both lesson and checkpoint; English table support contains English', () => {
 for(const [p,i]of [[entries[0],19],[entries[5],4]])assert.ok(p.screens[i].answer.acceptedOrders.some(o=>o.join(',')==='t1,t0,t2,t3,t4'));
 for(const i of [3,9]) {
  const translation=entries[2].screens[i].support.before.find(b=>b.kind==='translation');assert.match(translation.text,/[A-Za-z]/);
 }
});
