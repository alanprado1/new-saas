import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from './busuu-test-helpers.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../content/busuu/b2-structure.json', import.meta.url))).records;
const spec = raw.find(s => s.recordId === 'B2.C05.CP');
const registry = loadCourseModule('lib/busuu/content-registry.ts');
function fixture() {
 const p = structuredClone(registry.getContentPack('B2.C04.CP'));
 p.recordId = spec.recordId;
 p.screens.forEach((s,i) => { s.screenId = `${p.recordId}.A01.S${String(i+1).padStart(2,'0')}`;
  Object.assign(s.sourceContract,{sourceRenderer:null,sourceRendererId:null,sourceScreenId:null,sourceActivityId:null,sourceExerciseNumber:null,responseSlotCount:null,responseSlotCountState:'unknown'});
 });
 p.structuralContract = {version:'1.0',kind:'summary_authored',origin:'app_authored',review:{status:'reviewed',note:'Reviewed app assessment based on retained targets.'},
  activities:[{activityId:`${p.recordId}.A01`,ordinal:1,sourceActivityIds:[],baseScreenCount:20,screenIds:p.screens.map(s=>s.screenId)}],
  tasks:p.screens.map(s=>({screenId:s.screenId,responseCount:s.answer.kind==='ordered_slots'?s.answer.slots.length:s.answer.kind==='ordered_tokens'?s.answer.tokens.length:1}))};
 return p;
}
const retainedSpec=raw.find(s=>s.recordId==='B2.C06.L01');
function retainedFixture() {
 const p=fixture();p.recordId=retainedSpec.recordId;p.baseScreenCount=19;p.screens=p.screens.slice(0,19);
 p.screens.forEach((s,i)=>s.screenId=`${p.recordId}.A${i<11?'01':'02'}.S${String(i<11?i+1:i-10).padStart(2,'0')}`);
 p.structuralContract.activities=retainedSpec.activities.map((a,i)=>({...structuredClone(a),screenIds:p.screens.slice(i?11:0,i?19:11).map(s=>s.screenId)}));
 p.structuralContract.tasks=p.screens.map(s=>({screenId:s.screenId,responseCount:s.answer.kind==='ordered_slots'?s.answer.slots.length:s.answer.kind==='ordered_tokens'?s.answer.tokens.length:1}));
 return p;
}

test('retained summary activities preserve 11+8 with zero observed rows and a ready authored launch',()=>{
 const p=retainedFixture(),before=JSON.stringify(retainedSpec);
 assert.doesNotThrow(()=>registry.assertContentAlignment(p,retainedSpec));
 const r=loadCourseModule('lib/busuu/readiness.ts').getLessonReadiness({...retainedSpec,contentPack:p});
 assert.equal(r.scoredLaunchReady,true);assert.equal(r.structure.knownScreenRows,0);assert.equal(r.structure.authoredScreenRows,19);
 assert.equal(JSON.stringify(retainedSpec),before);assert.deepEqual(retainedSpec.activities.map(a=>a.baseScreenCount),[11,8]);
});

test('retained summary rejects lost activities, changed known identities/ordinals/counts and nonempty source arrays',()=>{
 for(const mutate of [s=>s.activities.pop(),s=>s.activities.reverse(),s=>s.activities[0].activityId='B2.C06.L01.A03',
  s=>s.activities[0].ordinal=2,s=>s.activities[0].baseScreenCount=10,s=>s.activities[0].baseScreenCount=0,
  s=>s.activities[0].baseScreenCount=11.5,s=>s.activities[0].screenIds=['invented'],s=>s.activities[0].sourceActivityIds=['known-id']]) {
  const s=structuredClone(retainedSpec);mutate(s);assert.throws(()=>registry.assertContentAlignment(retainedFixture(),s));
  const r=loadCourseModule('lib/busuu/readiness.ts').getLessonReadiness({...s,contentPack:retainedFixture()});assert.equal(r.scoredLaunchReady,false);
 }
 const p=retainedFixture();p.structuralContract.activities[0].baseScreenCount=10;
 assert.throws(()=>registry.assertContentAlignment(p,retainedSpec));
});

test('retained summary preserves known source activity lists while unknown task identities remain null',()=>{
 const s=structuredClone(retainedSpec),p=retainedFixture();s.activities[0].sourceActivityIds=['retained-source-activity'];
 p.structuralContract.activities[0].sourceActivityIds=['retained-source-activity'];
 assert.doesNotThrow(()=>registry.assertContentAlignment(p,s));
 p.screens[0].sourceContract.sourceActivityId='retained-source-activity';assert.throws(()=>registry.assertContentAlignment(p,s));
 p.screens[0].sourceContract.sourceActivityId=null;s.activities[1].baseScreenCount=null;
 assert.doesNotThrow(()=>registry.assertContentAlignment(p,s));
});
test('reviewed summary contract supplies an app sequence without promoting raw source rows', () => {
 const p=fixture(), before=JSON.stringify(spec);
 assert.doesNotThrow(()=>registry.assertContentAlignment(p,spec));
 const r=loadCourseModule('lib/busuu/readiness.ts').getLessonReadiness({...spec,contentPack:p});
 assert.equal(r.scoredLaunchReady,true);assert.equal(r.structure.knownScreenRows,0);assert.equal(r.structure.authoredScreenRows,20);
 assert.equal(JSON.stringify(spec),before);assert.equal(spec.activities.length,0);
});
test('summary contract fails closed for invented identities, malformed partitions/counts, or observed records', () => {
 for(const mutate of [p=>delete p.structuralContract,p=>p.structuralContract.review.status='draft',p=>p.structuralContract.origin='source_observation',
  p=>p.structuralContract.activities[0].sourceActivityIds=['invented'],p=>p.screens[0].sourceContract.sourceActivityId='invented',
  p=>p.screens[0].sourceContract.sourceScreenId='invented',p=>p.screens[0].sourceContract.responseSlotCount=1,
  p=>p.structuralContract.tasks[0].responseCount=99,p=>p.structuralContract.activities[0].screenIds.reverse(),
  p=>p.structuralContract.activities[0].baseScreenCount=19,p=>p.structuralContract.tasks.pop(),p=>p.baseScreenCount=19]) {
  const p=fixture();mutate(p);assert.throws(()=>registry.assertContentAlignment(p,spec));
 }
 assert.throws(()=>registry.assertContentAlignment(fixture(),{...spec,evidenceDepth:'ordered_screen_records'}));
 assert.throws(()=>registry.assertContentAlignment(fixture(),{...spec,screens:[raw[0].screens[0]]}));
 const observed=structuredClone(registry.getContentPack('B2.C04.CP'));observed.structuralContract=fixture().structuralContract;
 assert.throws(()=>registry.assertContentAlignment(observed,raw.find(s=>s.recordId===observed.recordId)));
});
test('Japanese-only dialogue allows explicit lexical glosses while rejecting hidden or unbound glosses', () => {
 const s=structuredClone(registry.getContentPack('B2.C04.L05').screens[2]);
 s.dialogue.glosses=[{japanese:'ゲーム',reading:'げーむ',english:'game'}];
 const gaps=loadCourseModule('lib/busuu/scene-context.ts').getDialogueContentGaps;
 assert.deepEqual(gaps(s),[]);
 const Dialogue=loadCourseModule('components/busuu/LessonScreen.tsx').Dialogue;
 const html=renderToStaticMarkup(React.createElement(Dialogue,{screen:s}));
 assert.match(html,/<dd lang="en">game<\/dd>/);assert.doesNotMatch(html,/English dialogue support unavailable/);
 s.dialogue.glosses[0].japanese='不存在';assert.ok(gaps(s).length);
 s.dialogue.glosses[0].japanese='ゲーム';s.dialogue.japaneseVisible=false;assert.ok(gaps(s).length);
});
