import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCourseModule } from './busuu-test-helpers.mjs';

const sentinel = new Error('not-found');
const overrides = {
  'next/navigation': { notFound: () => { throw sentinel; }, redirect: url => { throw new Error(`redirect:${url}`); } },
  '@/app/busuu/busuu.module.css': { __esModule: true, default: {} },
  '../busuu.module.css': { __esModule: true, default: {} },
};
test('course root opens A1, and invalid levels and cross-level records fail closed', async () => {
  const index = loadCourseModule('app/busuu/page.tsx', overrides).default;
  assert.throws(index, /redirect:\/busuu\/A1/);
  const level = loadCourseModule('app/busuu/[level]/page.tsx', overrides).default;
  const lesson = loadCourseModule('app/busuu/[level]/lesson/[recordId]/page.tsx', overrides).default;
  await assert.rejects(level({ params: Promise.resolve({ level: 'N5' }), searchParams: Promise.resolve({}) }), e => e === sentinel);
  await assert.rejects(lesson({ params: Promise.resolve({ level: 'A1', recordId: 'B2.C01.L01' }) }), e => e === sentinel);
  await assert.rejects(lesson({ params: Promise.resolve({ level: 'B2', recordId: 'B2.C01.L99' }) }), e => e === sentinel);
  for (const id of ['A1', 'A2', 'B1', 'B2']) {
    const view = await level({ params: Promise.resolve({ level: id }), searchParams: Promise.resolve({}) });
    assert.equal(view.props.children[1].props.level.id, id);
  }
  for (const recordId of ['B2.C01.L01', 'B2.C01.L02', 'B2.C01.L03', 'B2.C01.L04', 'B2.C01.L05', 'B2.C01.CP']) {
    const launch = await lesson({ params: Promise.resolve({ level: 'B2', recordId }) });
    assert.equal(launch.props.readiness.scoredLaunchReady, true);
    assert.equal(launch.props.spec.recordId, recordId);
  }
});
