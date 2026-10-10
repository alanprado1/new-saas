import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from './busuu-test-helpers.mjs';
const get = f => loadCourseModule(`lib/busuu/${f}.ts`);
const counts = { L01:8,L02:9,L03:15,L04:18,L05:7,L06:21,CP:20 };
const entries = () => Object.entries(counts).map(([key,count]) => [get('content-registry').getContentPack(`B2.C03.${key}`),count]);
test('seven reviewed chapter 3 packs preserve 99 canonical source surfaces and 98 required screens', () => {
  const raw = JSON.parse(fs.readFileSync(new URL('../content/busuu/b2-structure.json',import.meta.url))).records;
  let required = 0, retained = 0;
  for (const [pack,count] of entries()) {
    assert.ok(pack,'Chapter 3 pack must be registered'); assert.equal(pack.baseScreenCount,count);
    assert.equal(pack.status,'reviewed'); assert.ok(['1.0.0', '1.1.0', '1.2.0'].includes(pack.contentVersion), 'released or text-polished version');
    const spec = get('inventory').getLessonSpec(pack.recordId), source = raw.find(r => r.recordId === pack.recordId);
    const ready = get('readiness').getLessonReadiness(spec); assert.equal(ready.scoredLaunchReady,true,pack.recordId);
    get('content-registry').assertContentAlignment(pack,source);
    assert.deepEqual([...pack.screens,...(pack.completion?.optionalSurfaces??[])].map(s=>s.screenId),spec.activities.flatMap(a=>a.screenIds));
    for (const [i,screen] of pack.screens.entries()) {
      assert.equal(screen.sourceContract.sourceActivityId,source.screens[i].sourceActivityId);
      assert.equal(screen.sourceContract.sourceExerciseNumber,source.screens[i].sourceExerciseNumber);
      assert.equal(screen.sourceContract.responseSlotCount,source.screens[i].rawResponseSlotCount);
      assert.deepEqual(screen.sourceContract.recordedSupport,source.screens[i].rawSupport);
      assert.deepEqual(screen.unresolved,[]);
    }
    required += count; retained += spec.baseScreenCount;
  }
  assert.equal(required,98); assert.equal(retained,99);
  for (const [key,lengths] of [['L03',[9,6]],['L04',[10,8]],['L06',[12,9]]])
    assert.deepEqual(get('inventory').getLessonSpec(`B2.C03.${key}`).activities.map(a=>a.screenIds.length),lengths);
  const writing = get('inventory').getLessonSpec('B2.C03.L05');
  assert.equal(raw.find(r=>r.recordId==='B2.C03.L05').optionalProduction,null);
  assert.deepEqual(writing.screens.map(s=>s.sourceExerciseNumber),[1,2,3,4,6,7,8,9]);
  assert.equal(writing.optionalProduction.coreTeachingScreenCount,7);
  assert.equal(writing.contentPack.completion.optionalSurfaces[0].screenId,'B2.C03.L05.A01.S08');
  assert.deepEqual(writing.contentPack.completion.optionalSurfaces[0].modes,['write']);
});
test('new real listening hides Japanese/translation in pre-answer markup and delayed context has no audio or replay', () => {
  const Renderer = loadCourseModule('components/busuu/LessonScreen.tsx').default;
  for (const [pack] of entries()) for (const s of pack.screens) {
    if (s.sourceContract.transcriptBeforeAnswer!==false) continue;
    const html = renderToStaticMarkup(React.createElement(Renderer,{screen:s,state:{phase:'response',audioReady:true,slots:[],matches:[]},dispatch(){}}));
    if (s.audio.text) assert.ok(!html.includes(s.audio.text),s.screenId);
    for (const block of s.support.after.filter(b=>b.kind==='translation')) assert.ok(!html.includes(block.text),s.screenId);
    assert.deepEqual(get('runner').getVisibleSupport(s,'response'),[]);
    assert.doesNotMatch(html,/<audio|title=/);
  }
  const cp = get('content-registry').getContentPack('B2.C03.CP'), q = cp.screens[3];
  assert.ok(q.sceneContext); assert.equal(q.audio.required,false); assert.equal(q.audio.text,null); assert.equal(q.audio.feedbackText,undefined);
  assert.equal(cp.retryPolicy,undefined); assert.deepEqual(cp.passPolicy,{kind:'none'});
});
test('chapter 3 kanji order and repeated physical characters keep complete teaching and unique token identity', () => {
  const pack = get('content-registry').getContentPack('B2.C03.L06'); assert.ok(pack);
  assert.deepEqual(pack.screens.filter(s=>s.renderer==='kanji').map(s=>s.kanji.character),['続','通','努','試','験']);
  const screen = pack.screens.at(-1), m = get('attempt');
  const tokens = screen.answer.tokens.filter(t=>t.text==='試'); assert.equal(tokens.length,2); assert.notEqual(tokens[0].id,tokens[1].id);
  let state = {...m.initialAttemptState(pack),index:20,phase:'response',audioReady:true,slots:[null,null,null]};
  state = m.evaluateAction(pack,state,{type:'token',screenId:screen.screenId,id:tokens[0].id});
  assert.throws(()=>m.evaluateAction(pack,state,{type:'token',screenId:screen.screenId,id:tokens[0].id}));
  assert.equal(state.phase,'response');
  state = m.evaluateAction(pack,state,{type:'remove_token',screenId:screen.screenId,slot:0});
  assert.deepEqual(state.slots,[null,null,null]);
});
