import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadCourseModule } from './busuu-test-helpers.mjs';

function modules() {
  assert.ok(fs.existsSync(new URL('./busuu/readiness.ts', import.meta.url)), 'separate readiness implementation is required');
  return { ...loadCourseModule('lib/busuu/inventory.ts'), ...loadCourseModule('lib/busuu/readiness.ts') };
}

test('chapter one retains 49 canonical target screens and nullable source facts', () => {
  const { getLessonSpec } = modules();
  const ids = ['B2.C01.L01', 'B2.C01.L02', 'B2.C01.L03', 'B2.C01.L04', 'B2.C01.CP'];
  assert.deepEqual(ids.map(id => getLessonSpec(id).baseScreenCount), [6, 9, 10, 10, 14]);
  assert.deepEqual(ids.map(id => getLessonSpec(id).activities.map(a => a.baseScreenCount)), [[6], [9], [10], [10], [14]]);
  const screens = ids.flatMap(id => getLessonSpec(id).screens);
  assert.equal(screens.length, 49);
  assert.equal(new Set(screens.map(s => s.screenId)).size, 49);
  const first = screens[0];
  assert.equal(first.rawSupport.japanese_transcript_before_answer, null);
  assert.equal(first.rawResponseSlotCount, null);
  assert.equal(first.sourceActivityId, 'activity_112be83f-55ce-4500-9315-e726c94f909d');
  assert.equal(first.liveObservation.media.observed_modality, 'speaker_video');
  assert.equal(first.prompt.value, 'Look, something new!');
  assert.equal(first.modelOrScaffold.value, null);
  assert.equal(first.answerSpec.value, null);
});

test('L05 teaching and optional production remain distinct from its checkpoint dependency', () => {
  const { getLessonSpec } = modules();
  const fluency = getLessonSpec('B2.C01.L05');
  assert.equal(fluency.baseScreenCount, 8);
  assert.deepEqual(fluency.optionalProduction, { endpointOptional: true, coreTeachingScreenCount: 7 });
  const dependency = getLessonSpec('B2.C01.CP').dependencies.find(d => d.recordId === 'B2.C01.L05');
  assert.ok(dependency);
  assert.equal(dependency.sourceEnforced, null);
  assert.match(dependency.note, /vessel|cultural/i);
});

test('navigation readiness survives missing text and deferred media without granting scored launch', () => {
  const { getLessonSpec, getLessonReadiness } = modules();
  for (const id of ['A1.C01.L01', 'B2.C01.L02', 'B2.C01.L05', 'B2.C01.CP', 'A2.C22.LT']) {
    const current = getLessonSpec(id);
    const spec = ['B2.C01.L05', 'B2.C01.CP'].includes(id) ? { ...current, contentPack: undefined } : current;
    const r = getLessonReadiness(id === 'B2.C01.L02' ? { ...spec, contentPack: loadCourseModule('lib/busuu/content-registry.ts').getContentPack(id, '1.0.0') } : spec);
    assert.equal(r.structure.navigationReady, true);
    assert.equal(r.textAnswers.complete, false);
    assert.equal(r.media.ready, false);
    assert.equal(r.media.visualsDeferred, true);
    assert.equal(r.scoredLaunchReady, false);
    assert.ok(r.textAnswers.gaps.length);
    assert.ok(r.media.gaps.length);
    assert.equal(r.runnerAvailable, id === 'B2.C01.L02');
    assert.equal(r.previewAvailable, id === 'B2.C01.L02');
    assert.ok(r.textAnswers.gaps.every(g => !g.field.startsWith('audio')));
  }
});

test('partial answer evidence cannot be promoted to a complete answer key; summaries never fabricate rows', () => {
  const { inventory, getLessonSpec, getLessonReadiness } = modules();
  assert.equal(getLessonSpec('B2.C01.L01').screens[1].liveObservation.answer_configuration.successful_observed_response.value, 'True');
  const original = { ...getLessonSpec('B2.C01.L01'), contentPack: undefined };
  assert.equal(getLessonReadiness(original).textAnswers.complete, false, 'the retained partial evidence alone never unlocks practice');
  const specs = inventory.levels.flatMap(l => l.chapters.flatMap(c => c.entries)).filter(e => e.id.startsWith('B2')).map(e => getLessonSpec(e.id));
  assert.equal(specs.flatMap(s => s.screens).length, 1117);
  const summaries = specs.filter(s => s.screens.length === 0 && s.baseScreenCount > 0);
  assert.equal(summaries.length, 4);
  assert.equal(summaries.reduce((sum, s) => sum + s.baseScreenCount, 0), 77);
  assert.ok(summaries.every(s => !getLessonReadiness({ ...s, contentPack: undefined }).structure.lessonSequenceComplete));
});
