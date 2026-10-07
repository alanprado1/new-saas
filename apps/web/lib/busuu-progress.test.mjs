import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCourseModule } from './busuu-test-helpers.mjs';
test('map counts only genuine saved completion once and keeps accuracy separate', () => {
  const m = loadCourseModule('lib/busuu/progress.ts');
  const complete = { record_id: 'B2.C01.L01', completed_at: 'saved', state: { phase: 'result', preview: false }, result: { completionEligible: true, percent: 60 } };
  const attempts = [complete, complete, { ...complete, record_id: 'B2.C01.L02', completed_at: null },
    { ...complete, record_id: 'B2.C01.L03', state: { phase: 'result', preview: true } },
    { ...complete, record_id: 'B2.C01.L04', result: { completionEligible: false } }];
  const result = m.savedCourseProgress(attempts);
  assert.deepEqual(Object.keys(result), ['B2.C01.L01']); assert.equal(result['B2.C01.L01'].accuracy, 60);
  const { getLevelInventory } = loadCourseModule('lib/busuu/inventory.ts');
  assert.equal(m.chapterCompletion(getLevelInventory('B2').chapters[0], result), 17);
});
