import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadAppModule } from './test-loader.mjs';
import { loadCourseModule } from './busuu-test-helpers.mjs';

function course() {
  assert.ok(fs.existsSync(new URL('./busuu/inventory.ts', import.meta.url)), 'course inventory implementation is required');
  return loadCourseModule('lib/busuu/inventory.ts');
}

test('local course map preserves every level, chapter, card and certificate in source order', () => {
  const { inventory, getLevelInventory } = course();
  assert.equal(inventory.version, '1.0.0');
  assert.deepEqual(inventory.levels.map(l => [l.id, l.chapters.length, l.chapters.flatMap(c => c.entries).length]),
    [['A1', 31, 249], ['A2', 22, 208], ['B1', 18, 174], ['B2', 10, 73]]);
  const entries = inventory.levels.flatMap(l => l.chapters.flatMap(c => c.entries));
  assert.equal(entries.length, 704);
  assert.equal(new Set(entries.map(e => e.id)).size, 704);
  assert.equal(entries.filter(e => e.kind === 'teaching_review_card').length, 623);
  assert.equal(entries.filter(e => e.kind === 'checkpoint').length, 78);
  assert.equal(entries.filter(e => e.kind === 'certificate_entry').length, 3);
  assert.deepEqual(entries.filter(e => e.kind === 'certificate_entry').map(e => e.id), ['A1.C31.LT', 'A2.C22.LT', 'B1.C18.LT']);
  assert.deepEqual(getLevelInventory('B2').chapters[0].entries.map(e => e.id),
    ['B2.C01.L01', 'B2.C01.L02', 'B2.C01.L03', 'B2.C01.L04', 'B2.C01.L05', 'B2.C01.CP']);
  assert.equal(getLevelInventory('A1').chapters[0].entries[0].sourceLabel.value, null);
  assert.equal(getLevelInventory('A1').chapters[0].entries[0].mappedObjective.value, 'Initial greetings');
  assert.equal(getLevelInventory('B2').chapters[0].entries[4].sourceLabel.value, 'Developing fluency');
  assert.equal(getLevelInventory('B2').chapters[0].entries[4].recordedSourceLabel, 'Developing fluency — lists');
  assert.ok(entries.every(e => e.evidence[0].sourceHash && e.evidence[0].jsonPointerOrHeading));
});

test('navigation validates level and record ownership and returns to the selected card', () => {
  const { getLevelInventory, getCourseEntry, getTimelineHref, getInitialProgress } = course();
  for (const level of ['A1', 'A2', 'B1', 'B2']) {
    assert.equal(getLevelInventory(level).id, level);
    assert.equal(getTimelineHref(level), `/busuu/${level}`);
  }
  assert.equal(getLevelInventory('b2'), null);
  assert.equal(getLevelInventory('N5'), null);
  assert.equal(getCourseEntry('A1', 'B2.C01.L01'), null);
  assert.equal(getCourseEntry('B2', 'B2.C01.L99'), null);
  assert.equal(getTimelineHref('B2', 'B2.C01.L05'), '/busuu/B2?selected=B2.C01.L05#B2.C01.L05');
  assert.equal(getTimelineHref('B2', 'A1.C01.L01'), '/busuu/B2');
  assert.deepEqual(getInitialProgress(), { completedEntries: 0, percent: 0, score: null });
});

test('schema rejects duplicate IDs, broken placements and runtime external paths', () => {
  const { inventory } = course();
  const { validateInventory } = loadAppModule('lib/busuu/schema.ts');
  const duplicate = structuredClone(inventory);
  duplicate.levels[0].chapters[0].entries[1].id = 'A1.C01.L01';
  assert.throws(() => validateInventory(duplicate));
  const misplaced = structuredClone(inventory);
  misplaced.levels[3].chapters[0].entries.at(-1).afterCardOrder = 4;
  assert.throws(() => validateInventory(misplaced));
  const external = structuredClone(inventory);
  external.levels[0].chapters[0].entries[0].evidence[0].packagedPath = 'C:/external/lesson.json';
  assert.throws(() => validateInventory(external));
});
