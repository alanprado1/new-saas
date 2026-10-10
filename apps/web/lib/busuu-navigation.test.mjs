import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from './busuu-test-helpers.mjs';

const css = new Proxy({}, { get: (_, key) => String(key) });
const pushes = [];
const overrides = {
  '@/app/busuu/busuu.module.css': { __esModule: true, default: css },
  'next/link': ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children),
  'next/navigation': { useRouter: () => ({ push: href => pushes.push(href) }), usePathname: () => null },
};
function component(name, extra = {}) {
  assert.ok(fs.existsSync(new URL(`../components/busuu/${name}.tsx`, import.meta.url)), `${name} course view is required`);
  return loadCourseModule(`components/busuu/${name}.tsx`, { ...overrides, ...extra }).default;
}
const presentation = () => loadCourseModule('lib/busuu/map-presentation.ts');
const inventoryModule = () => loadCourseModule('lib/busuu/inventory.ts');
const viewsFor = levelId => {
  const { getLevelInventory } = inventoryModule();
  const level = getLevelInventory(levelId);
  return { level, views: loadCourseModule('lib/busuu/map-views.ts').buildLevelViews(level) };
};

test('course chrome puts map pages in the app shell (course active) with a Credits link, and leaves lessons full-screen', () => {
  const shellCalls = [];
  const AppShell = ({ active, children }) => { shellCalls.push(active); return React.createElement('div', { 'data-shell': active }, children); };
  const chrome = pathname => loadCourseModule('components/busuu/CourseChrome.tsx', { ...overrides, 'next/navigation': { usePathname: () => pathname },
    '@/components/shell/AppShell': { __esModule: true, default: AppShell } });
  const render = pathname => renderToStaticMarkup(React.createElement(chrome(pathname).default, null, React.createElement('main', null, 'child')));
  const map = render('/busuu/B2');
  assert.match(map, /data-shell="course"/); assert.match(map, /href="\/busuu\/credits"/); assert.match(map, />child</);
  assert.doesNotMatch(map, /courseRootLesson/);
  shellCalls.length = 0;
  const lesson = render('/busuu/B2/lesson/B2.C01.L01');
  assert.doesNotMatch(lesson, /data-shell/); assert.doesNotMatch(lesson, /href="\/busuu\/credits"/); assert.deepEqual(shellCalls, []);
  assert.match(lesson, /courseRootLesson/); assert.match(lesson, />child</);
  assert.equal(chrome('/x').isLessonPath('/busuu/B2/lesson/B2.C01.L01'), true);
  assert.equal(chrome('/x').isLessonPath('/busuu/B2'), false);
  assert.equal(fs.existsSync(new URL('../components/busuu/CourseHeader.tsx', import.meta.url)), false, 'the old course header is replaced by the app shell');
});

test('entry subtitles never leak raw inventory keys: kanji, fluency and checkpoint mapping', () => {
  const { describeEntry } = presentation();
  const { level } = viewsFor('B2');
  const byId = id => level.chapters.flatMap(c => c.entries).find(e => e.id === id);
  const kanji = describeEntry(byId('B2.C02.L02'));
  assert.equal(kanji.title, 'Kanji: 参 然 実 特 例'); assert.equal(kanji.subtitle, 'Learn 5 new kanji'); assert.equal(kanji.glyph, '参'); assert.equal(kanji.variant, 'kanji');
  const fluency = describeEntry(byId('B2.C01.L05'));
  assert.equal(fluency.title, 'Developing fluency'); assert.equal(fluency.subtitle, 'Practise lists'); assert.equal(fluency.variant, 'fluency');
  assert.equal(describeEntry(byId('B2.C06.L02')).subtitle, 'Practise taste');
  const checkpoint = describeEntry(byId('B2.C01.CP'));
  assert.equal(checkpoint.title, 'Checkpoint'); assert.equal(checkpoint.subtitle, 'Test your skills to access the next chapter'); assert.equal(checkpoint.variant, 'checkpoint');
  // Earlier levels have no source labels: titles come from the mapped objective, key formats still never show.
  const a2 = viewsFor('A2').level.chapters.flatMap(c => c.entries).find(e => e.id === 'A2.C02.L05');
  assert.equal(describeEntry(a2).title, 'Kanji: 奥 親 彼 仕 事'); assert.equal(describeEntry(a2).subtitle, 'Learn 5 new kanji');
  for (const id of ['A1', 'A2', 'B1', 'B2']) {
    const { views } = viewsFor(id);
    for (const view of Object.values(views)) {
      assert.doesNotMatch(`${view.title} ${view.subtitle} ${view.objective}`, /K\[|^F:|\bF: /, view.id);
      assert.equal(view.durationTag, null);
    }
  }
  // Raw evidence is untouched by the presentation mapping.
  assert.equal(byId('B2.C02.L02').mappedObjective.value, 'K[参 然 実 特 例]');
  assert.equal(byId('B2.C01.L05').mappedObjective.value, 'F: lists');
});

test('timeline exposes source order, distinct avatars, a neutral loading state and the selected lesson popover', () => {
  const Timeline = component('ChapterTimeline');
  const { level, views } = viewsFor('B2');
  const html = renderToStaticMarkup(React.createElement(Timeline, { level, views, selected: 'B2.C01.L05' }));
  assert.ok(html.indexOf('id="B2.C01.L04"') < html.indexOf('id="B2.C01.L05"'));
  assert.ok(html.indexOf('id="B2.C01.L05"') < html.indexOf('id="B2.C01.CP"'));
  assert.match(html, /href="\/busuu\/B2\/lesson\/B2.C01.L05"/);
  assert.match(html, /aria-valuenow="0"/);
  assert.match(html, /avatarKanji/); assert.match(html, /avatarCheckpoint/); assert.match(html, /avatarFluency/);
  assert.match(html, /id="B2.C01"/); // chapter anchor for returning from a lesson
  assert.doesNotMatch(html, /83%|90%|Restart lesson|Completed|View lesson details|Ready to practise|Development preview/);
  const loading = renderToStaticMarkup(React.createElement(Timeline, { level, views, loading: true }));
  assert.doesNotMatch(loading, /aria-valuenow|progressPill|0%/); assert.match(loading, /aria-busy/);
  const earlier = renderToStaticMarkup(React.createElement(Timeline, { level: viewsFor('A1').level }));
  assert.doesNotMatch(earlier, /Mapped objective|pending/);
});

test('popover buttons follow lesson progress and the rings show completed and in-progress states', () => {
  const Timeline = component('ChapterTimeline');
  const { level, views } = viewsFor('B2');
  const open = (id, extra) => renderToStaticMarkup(React.createElement(Timeline, { level, views, selected: id, ...extra }));
  const fresh = open('B2.C01.L01', {});
  assert.match(fresh, />Start lesson</); assert.doesNotMatch(fresh, /Continue lesson|Restart lesson/);
  assert.match(fresh, />MIXED</); assert.doesNotMatch(fresh, /MIN</);
  const partial = open('B2.C01.L01', { inProgress: { 'B2.C01.L01': { visited: 3 } } });
  assert.match(partial, />Continue lesson</); assert.doesNotMatch(partial, />Start lesson</);
  assert.match(partial, /stroke-dasharray="\d+(\.\d)? 100"/); assert.doesNotMatch(partial, /doneBadge/);
  const done = open('B2.C01.L01', { progress: { 'B2.C01.L01': { accuracy: 80 } } });
  assert.match(done, />Restart lesson</); assert.match(done, /href="\/busuu\/B2\/lesson\/B2.C01.L01\?restart=1"/);
  assert.match(done, /doneBadge/); assert.match(done, /stroke-dasharray="100 100"/); assert.match(done, /Accuracy 80%/);
  const allDone = renderToStaticMarkup(React.createElement(Timeline, { level, views, progress: Object.fromEntries(level.chapters[0].entries.map(e => [e.id, { accuracy: 90 }])) }));
  assert.match(allDone, /chapterDone/); assert.match(allDone, /chapterCheck/); assert.match(allDone, /aria-valuenow="100"/);
  // A lesson whose content is not ready never offers a start action.
  const pending = renderToStaticMarkup(React.createElement(Timeline, { level: viewsFor('A1').level, views: viewsFor('A1').views, selected: 'A1.C01.L01' }));
  assert.match(pending, /disabled="">Coming soon</); assert.doesNotMatch(pending, />Start lesson</);
});

test('ring fractions and row statuses reuse saved progress without changing completion', () => {
  const { rowStatus, ringFraction, savedInProgress, chapterCompletion } = loadCourseModule('lib/busuu/progress.ts');
  const completed = { A: { accuracy: 50 } };
  assert.equal(rowStatus('A', completed, {}), 'completed'); assert.equal(rowStatus('B', completed, { B: { visited: 2 } }), 'in_progress'); assert.equal(rowStatus('C', completed, {}), 'not_started');
  assert.equal(ringFraction('completed'), 1); assert.equal(ringFraction('not_started'), 0);
  assert.equal(ringFraction('in_progress', 5, 20), 0.25); assert.ok(ringFraction('in_progress', 20, 20) < 1); assert.ok(ringFraction('in_progress', 1, 400) > 0);
  assert.deepEqual(savedInProgress([{ record_id: 'A', visited: 3 }, { record_id: 'B', visited: 2 }, { record_id: 'C', visited: 0 }, null], completed), { B: { visited: 2 } });
  assert.deepEqual(savedInProgress(undefined, completed), {});
  assert.equal(chapterCompletion({ entries: [{ id: 'A', kind: 'teaching_review_card' }, { id: 'B', kind: 'teaching_review_card' }] }, completed), 50);
});

test('unavailable lessons show a plain notice and return to the chapter on the map', () => {
  const { getCourseEntry, getLessonSpec } = inventoryModule();
  const { getLessonReadiness } = loadCourseModule('lib/busuu/readiness.ts');
  const spec = { ...getLessonSpec('B2.C01.CP'), contentPack: undefined }; // Retained evidence alone cannot launch practice.
  const { entry, chapter } = getCourseEntry('B2', spec.recordId);
  const html = renderToStaticMarkup(React.createElement(component('LessonLaunch'), { levelId: 'B2', entry, chapter, spec, readiness: getLessonReadiness(spec) }));
  assert.match(html, /href="\/busuu\/B2#B2.C01"/);
  assert.match(html, /Coming soon/);
  assert.doesNotMatch(html, /Structure|Text and answers|Required audio|Lesson runner|Media|Ready to practise|Start or resume|href="\/lesson\//);
});

test('production lessons go straight into the runner with a map return and no readiness page', () => {
  const { getCourseEntry, getLessonSpec } = inventoryModule();
  const { getLessonReadiness } = loadCourseModule('lib/busuu/readiness.ts');
  const runner = ({ pack, returnHref, preview }) => React.createElement('div', { 'data-runner': pack.recordId, 'data-return': returnHref, 'data-preview': String(preview) });
  for (const recordId of ['B2.C01.L01', 'B2.C01.L02', 'B2.C01.L03', 'B2.C01.L04', 'B2.C01.L05', 'B2.C01.CP']) {
    const spec = getLessonSpec(recordId), { entry, chapter } = getCourseEntry('B2', recordId);
    const html = renderToStaticMarkup(React.createElement(component('LessonLaunch', { './LessonRunner': { __esModule: true, default: runner } }), { levelId: 'B2', entry, chapter, spec, readiness: getLessonReadiness(spec) }));
    assert.match(html, new RegExp(`data-runner="${recordId}"`)); assert.match(html, /data-preview="false"/);
    assert.match(html, /data-return="\/busuu\/B2#B2.C01"/);
    assert.doesNotMatch(html, /Start or resume|Ready to practise|Structure|Open development preview|retained screenshots|source observation|disabled=""/);
  }
});

test('the launch hands exit to the runner (which confirms first) and returns to the course map at its chapter', () => {
  const { getCourseEntry, getLessonSpec } = inventoryModule();
  const { getLessonReadiness } = loadCourseModule('lib/busuu/readiness.ts');
  const spec = getLessonSpec('B2.C01.L01'), { entry, chapter } = getCourseEntry('B2', spec.recordId);
  const states = [];
  const fakeReact = { ...React, useState: initial => { const i = states.length; states.push(initial); return [states[i], v => { states[i] = typeof v === 'function' ? v(states[i]) : v; }]; },
    useEffect: () => {}, useRef: () => ({ current: null }), useCallback: fn => fn };
  const props = { levelId: 'B2', entry, chapter, spec, readiness: getLessonReadiness(spec) };
  const Launch = component('LessonLaunch', { react: fakeReact, './LessonRunner': { __esModule: true, default: () => null } });
  pushes.length = 0;
  const runnerEl = Launch(props);
  assert.equal(runnerEl.props.returnHref, '/busuu/B2#B2.C01');
  assert.equal(runnerEl.props.preview, false);
  // The runner's own leave dialog gates onExit; the launch has no second confirmation and navigates straight to the map.
  runnerEl.props.onExit();
  assert.deepEqual(pushes, ['/busuu/B2#B2.C01']);
});

test('selector wraps keyboard focus at both ends and restores its trigger on close', () => {
  const focus = { activeElement: null };
  const nodes = ['close', 'A1', 'A2', 'B1', 'B2'].map(id => ({ id, focus() { focus.activeElement = this; } }));
  let open = true;
  const modal = { ownerDocument: focus, querySelectorAll: () => nodes, close: () => { open = false; } };
  const trigger = { id: 'trigger', focus() { focus.activeElement = this; } };
  const refs = [{ current: modal }, { current: trigger }];
  const Selector = loadCourseModule('components/busuu/LevelSelector.tsx', { ...overrides, react: { ...React, useRef: () => refs.shift() } }).default;
  const view = Selector({ current: 'B2', choices: [ { id: 'B2', name: 'Upper Intermediate', chapterCount: 10 } ] });
  const dialog = view.props.children[1];
  assert.equal(typeof dialog.props.onKeyDown, 'function', 'selector must keep keyboard focus within its controls');
  let prevented = 0;
  const event = shiftKey => ({ key: 'Tab', shiftKey, currentTarget: modal, preventDefault: () => { prevented++; } });
  focus.activeElement = nodes[0];
  dialog.props.onKeyDown(event(true));
  assert.equal(focus.activeElement.id, 'B2');
  dialog.props.onKeyDown(event(false));
  assert.equal(focus.activeElement.id, 'close');
  assert.equal(prevented, 2);
  dialog.props.children[0].props.children[2].props.onClick();
  assert.equal(open, false);
  assert.equal(focus.activeElement.id, 'trigger');
});

test('level selector shows the level and percentage only once progress is known', () => {
  const Selector = component('LevelSelector');
  const choices = [{ id: 'B2', name: 'Upper Intermediate', chapterCount: 10 }];
  const unknown = renderToStaticMarkup(React.createElement(Selector, { current: 'B2', choices }));
  assert.match(unknown, /Upper Intermediate B2/); assert.doesNotMatch(unknown, /· \d+%/);
  assert.match(renderToStaticMarkup(React.createElement(Selector, { current: 'B2', choices, percent: 90 })), /· 90%/);
});
