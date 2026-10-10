import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { loadCourseModule } from './busuu-test-helpers.mjs';

const sync = () => loadCourseModule('lib/busuu/kanji-playback-sync.ts');
const runtimeModule = () => loadCourseModule('lib/busuu/kanji-animation.ts');
const settle = (n = 8) => new Promise(resolve => { let i = 0; const go = () => (++i >= n ? resolve() : setTimeout(go, 0)); go(); });

// ---- pure status-edge rules ------------------------------------------------------------------------------------------------------
function run(steps, reduced = false) {
  const { initialKanjiSync, onKanjiStatus, onKanjiPress } = sync();
  let s = initialKanjiSync(); const actions = [];
  for (const step of steps) {
    const r = step.press ? onKanjiPress(s) : onKanjiStatus(s, step.status, reduced);
    s = r.sync; actions.push(r.action);
  }
  return actions;
}
const press = { press: true };
const at = status => ({ status });

test('autoplay: playback leaving idle restarts once; loading to playing and the audio ending change nothing (the animation finishes alone)', () => {
  assert.deepEqual(run([at('loading'), at('playing'), at('idle')]), ['restart', null, null]);
});
test('autoplay under reduced motion shows completed ink instead of animating', () => {
  assert.deepEqual(run([at('loading'), at('playing')], true), ['finish', null]);
});
test('a press while loading or playing pauses; pressing play again restarts both, even under reduced motion', () => {
  assert.deepEqual(run([at('loading'), at('playing'), press, at('idle'), press, at('loading'), at('playing'), at('idle')]), ['restart', null, 'pause', null, 'restart', null, null, null]);
  assert.deepEqual(run([press, at('loading'), at('playing'), press, at('idle'), press, at('loading')], true), ['restart', null, null, 'pause', null, 'restart', null], 'a click animates; its status edge does not restart twice');
  assert.deepEqual(run([at('loading'), press, at('idle')]), ['restart', 'pause', null], 'cancel while still loading');
});
test('after a TTS failure the next press animates again (error counts as not playing)', () => {
  assert.deepEqual(run([at('loading'), at('error'), press, at('loading')]), ['restart', null, 'restart', null]);
  assert.deepEqual(run([press, at('error')]), ['restart', null], 'a press whose audio fails at once still animates');
});
test('the example speaker (readings stay idle) never changes the animation', () => {
  assert.deepEqual(run([at('idle'), at('idle')]), [null, null]);
});

// ---- runtime: manifest filtering, shared loader, silent preload -------------------------------------------------------------------
const makeDeps = (extra = {}) => {
  const calls = { load: [], create: [], manifest: 0 };
  const loader = { load: async (c, options) => { calls.load.push(c); calls.options = options; if (c === '日' && extra.failLoad) throw new Error('offline'); return { character: c }; } };
  return { calls, deps: { loadEngine: async () => ({ createKanjiLoader: o => { calls.create.push(o); return loader; } }),
    fetchManifest: async () => { calls.manifest++; if (extra.manifest === 'fail') throw new Error('404'); return { defaultStyle: 'animcjk-brush-v1', characters: ['日', '本'], ...extra.data }; }, baseUrl: () => 'http://x/kanji/' } };
};
test('runtime: one loader with the course cache and base URL; preload filters by manifest, once, silently', async () => {
  const { createKanjiRuntime } = runtimeModule(); const { calls, deps } = makeDeps();
  const rt = createKanjiRuntime(deps);
  await rt.preload(['日', '参', '本', '日']);
  assert.deepEqual([...calls.load].sort(), ['日', '本']);
  await rt.preload(['日', '本', '参']);
  assert.deepEqual([...calls.load].sort(), ['日', '本'], 'already requested characters are not requested again');
  assert.deepEqual(calls.create, [{ baseUrl: 'http://x/kanji/', cacheName: 'course-kanji-brush-v1', maxEntries: 256 }]); assert.equal(calls.manifest, 1);
  await rt.loader(); assert.equal(calls.create.length, 1);
});
test('runtime: a failed character does not reject the preload and can be retried; an unavailable manifest means nothing is supported', async () => {
  const { createKanjiRuntime } = runtimeModule();
  const failing = makeDeps({ failLoad: true }); const rt = createKanjiRuntime(failing.deps);
  await rt.preload(['日', '本']); // resolves although 日 failed
  await rt.preload(['日']); assert.equal(failing.calls.load.filter(c => c === '日').length, 2);
  const missing = makeDeps({ manifest: 'fail' }); const rt2 = createKanjiRuntime(missing.deps);
  assert.equal((await rt2.supported()).size, 0); await rt2.preload(['日']); assert.deepEqual(missing.calls.load, []);
  assert.equal(missing.calls.manifest, 2, 'a failed manifest request is retried, not cached');
});
test('manifest: only an AnimCJK brush manifest is read; bad entries are ignored; an old Noto manifest supports nothing', () => {
  const { parseKanjiManifest } = runtimeModule();
  assert.deepEqual([...parseKanjiManifest({ defaultStyle: 'animcjk-brush-v1', characters: ['日', '本', 'ab', 3] })], ['日', '本']);
  assert.equal(parseKanjiManifest({ schemaVersion: 4, style: 'noto-sans-jp-regular-v2', characters: ['日'] }).size, 0);
  assert.equal(parseKanjiManifest({ defaultStyle: 'animcjk-brush-v1', characters: '日' }).size, 0);
  assert.equal(parseKanjiManifest(null).size, 0);
});
test('runtime: characters load with the engine default style (no per-character style folders)', async () => {
  const { createKanjiRuntime } = runtimeModule(); const { calls, deps } = makeDeps();
  await createKanjiRuntime(deps).preload(['日']);
  assert.equal(calls.options, undefined);
});
test('bundled geometry: public/kanji holds the AnimCJK brush set for every kanji screen, its manifest and licence notices only', async () => {
  const fs = await import('node:fs');
  const dir = new URL('../public/kanji/', import.meta.url);
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', dir), 'utf8'));
  assert.equal(manifest.defaultStyle, 'animcjk-brush-v1');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['ANIMCJK-COPYING.txt', 'ARPHICPL.TXT', 'THIRD_PARTY_LICENSES.md', 'animcjk-brush-v1', 'manifest.json']);
  const hex = c => `${c.codePointAt(0).toString(16).padStart(5, '0')}.json`;
  assert.deepEqual(fs.readdirSync(new URL('animcjk-brush-v1/', dir)).sort(), manifest.characters.map(hex).sort());
  for (const c of manifest.characters) {
    const data = JSON.parse(fs.readFileSync(new URL(`animcjk-brush-v1/${hex(c)}`, dir), 'utf8'));
    assert.equal(data.character, c); assert.equal(data.style, 'animcjk-brush-v1');
  }
  assert.ok(['参', '実', '優', '堂', '確', '観'].every(c => manifest.characters.includes(c)));
  const pack = loadCourseModule('lib/busuu/content-registry.ts').getContentPack('B2.C02.L02');
  assert.ok(pack.screens.every(s => s.renderer !== 'kanji' || manifest.characters.includes(s.kanji.character)));
  const style = fs.readFileSync(new URL('../lib/kanji-animator/src/styles/geometry-style.js', import.meta.url), 'utf8');
  assert.match(style, /DEFAULT_GEOMETRY_STYLE\s*=\s*'animcjk-brush-v1'/);
});
test('getLessonKanji lists the distinct characters of a lesson kanji screens', () => {
  const { getLessonKanji } = runtimeModule();
  const pack = loadCourseModule('lib/busuu/content-registry.ts').getContentPack('B2.C02.L02');
  assert.deepEqual(getLessonKanji(pack.screens), ['参', '実', '然', '特', '例']);
  assert.deepEqual(getLessonKanji([{ renderer: 'model' }, { renderer: 'kanji', kanji: { character: '日' } }, { renderer: 'kanji', kanji: { character: '日' } }]), ['日']);
});

// ---- the component, with a mocked engine and a minimal hook harness ---------------------------------------------------------------
function createHooks() {
  const hooks = []; let idx = 0, effects = [], dirty = false;
  const slot = make => { const i = idx++; return (hooks[i] ??= make()); };
  const react = { ...React,
    useRef: init => { const first = idx === 0; return slot(() => ({ current: first ? { fakeHost: true } : init })); }, // the component's first ref is the engine host element
    useState: init => { const s = slot(() => ({ v: typeof init === 'function' ? init() : init })); return [s.v, v => { const next = typeof v === 'function' ? v(s.v) : v; if (!Object.is(next, s.v)) { s.v = next; dirty = true; } }]; },
    useEffect: (fn, deps) => { const s = slot(() => ({})); effects.push(() => { if (s.deps && deps && deps.every((d, i) => Object.is(d, s.deps[i]))) return; s.cleanup?.(); s.deps = deps; s.cleanup = fn(); }); } };
  return { react,
    async render(Component, props) { let out; do { dirty = false; idx = 0; effects = []; out = Component(props); effects.forEach(runEffect => runEffect()); await settle(); } while (dirty); return out; },
    unmount() { hooks.forEach(h => h?.cleanup?.()); } };
}
class FakeAnimator {
  static instances = [];
  constructor(host, options) {
    this.host = host; this.options = options; this.calls = []; this.destroyed = false;
    this.svg = { attrs: { role: 'img' }, querySelector: () => null, setAttribute: (k, v) => { this.svg.attrs[k] = v; }, removeAttribute: k => { delete this.svg.attrs[k]; } };
    FakeAnimator.instances.push(this);
    this.ready = options.character === '壊' ? Promise.reject(new Error('bad geometry')) : Promise.resolve({}); this.ready.catch(() => {});
  }
  restart() { this.calls.push('restart'); } finish() { this.calls.push('finish'); } pause() { this.calls.push('pause'); } destroy() { this.destroyed = true; }
}
function mount({ supported = ['日', '壊', '本'], reduced = false, engineDelay = 0 } = {}) {
  FakeAnimator.instances = [];
  const runtime = { supported: async () => new Set(supported), loader: async () => ({ load() {} }),
    engine: async () => { await settle(engineDelay); return { KanjiAnimator: FakeAnimator }; } };
  const previous = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: reduced }) };
  const hooks = createHooks();
  const Component = loadCourseModule('components/busuu/KanjiAnimation.tsx', { react: hooks.react, '@/lib/busuu/kanji-animation': { kanjiRuntime: runtime } }).default;
  const base = { character: '日', status: 'idle', pressCount: 0, standalone: false };
  let props = base;
  return {
    show: async patch => { props = { ...props, ...patch }; return hooks.render(Component, props); },
    get current() { return FakeAnimator.instances.at(-1); },
    end: () => { hooks.unmount(); globalThis.window = previous; },
  };
}
const asText = node => [node.props.children].flat(Infinity).map(c => (typeof c === 'string' ? c : c?.props?.children ?? '')).join('');

test('component: unsupported characters keep exactly the static glyph text, with no engine and no animated flag', async () => {
  const view = mount({ supported: ['日'] });
  const tile = await view.show({ character: '参', status: 'loading' });
  assert.equal(FakeAnimator.instances.length, 0);
  assert.equal(tile.props.lang, 'ja'); assert.equal(tile.props['data-animated'], undefined); assert.equal(asText(tile), '参');
  view.end();
});
test('component: a supported character shows the empty outline (not autoplayed) and keeps the character as text; the svg is hidden from assistive tech', async () => {
  const view = mount();
  const tile = await view.show({ character: '日' });
  const a = view.current;
  assert.equal(FakeAnimator.instances.length, 1);
  assert.equal(tile.props['data-animated'], 'true'); assert.equal(asText(tile), '日'); assert.equal(tile.props.lang, 'ja');
  assert.equal(a.options.autoplay, false); assert.equal(a.options.character, '日'); assert.equal(a.options.geometryStyle, undefined, 'engine default (AnimCJK brush)');
  assert.equal(a.options.style.fillColor, 'currentColor', 'ink follows the tile text colour'); assert.equal(a.options.style.backgroundColor, 'transparent');
  assert.equal(a.svg.attrs['aria-hidden'], 'true'); assert.equal(a.svg.attrs.role, undefined);
  assert.deepEqual(a.calls, [], 'idle player: outline only');
  view.end();
});
test('component: readings playback starting restarts the animation; the audio ending first lets it finish; a press pauses; play again restarts', async () => {
  const view = mount(); await view.show({ character: '日' }); const a = view.current;
  await view.show({ status: 'loading' }); await view.show({ status: 'playing' });
  assert.deepEqual(a.calls, ['restart']);
  await view.show({ status: 'idle' }); assert.deepEqual(a.calls, ['restart'], 'TTS ended: the animation continues alone');
  await view.show({ status: 'loading' }); await view.show({ status: 'playing' });
  await view.show({ pressCount: 1 }); assert.deepEqual(a.calls, ['restart', 'restart', 'pause'], 'press while playing pauses (the player cancels its audio)');
  await view.show({ status: 'idle' });
  await view.show({ pressCount: 2, status: 'loading' }); assert.deepEqual(a.calls.slice(3), ['restart'], 'one restart for press + its loading edge');
  view.end();
});
test('component: after a TTS error a press still animates', async () => {
  const view = mount(); await view.show({ character: '日' }); const a = view.current;
  await view.show({ status: 'loading' }); await view.show({ status: 'error' });
  await view.show({ pressCount: 1 }); await view.show({ status: 'loading' });
  assert.deepEqual(a.calls, ['restart', 'restart']);
  view.end();
});
test('component: reduced motion shows completed ink for the autoplay start but a click animates', async () => {
  const view = mount({ reduced: true }); await view.show({ character: '日' }); const a = view.current;
  await view.show({ status: 'loading' }); assert.deepEqual(a.calls, ['finish']);
  await view.show({ status: 'idle' }); await view.show({ pressCount: 1, status: 'loading' });
  assert.deepEqual(a.calls, ['finish', 'restart']);
  view.end();
});
test('component: playback that began before the geometry arrived starts the animation when it is ready; a pause before then cancels it', async () => {
  const view = mount({ engineDelay: 20 });
  await view.show({ character: '日', status: 'loading' }); // setState-free first render; geometry still loading
  const a = view.current;
  assert.deepEqual(a?.calls ?? [], []);
  await settle(40); assert.deepEqual(view.current.calls, ['restart']);
  view.end();
  const paused = mount({ engineDelay: 20 });
  const first = paused.show({ character: '日', status: 'loading' });
  await paused.show({ pressCount: 1 }); await first; await settle(40);
  assert.deepEqual(paused.current?.calls ?? [], [], 'paused before ready: stays an outline');
  paused.end();
});
test('component: no player (standalone) plays once by itself, honouring reduced motion', async () => {
  const view = mount(); await view.show({ character: '日', standalone: true }); assert.deepEqual(view.current.calls, ['restart']); view.end();
  const reduced = mount({ reduced: true }); await reduced.show({ character: '日', standalone: true }); assert.deepEqual(reduced.current.calls, ['finish']); reduced.end();
});
test('component: latest character wins (previous engine destroyed); a character whose geometry fails to load falls back to the glyph without throwing', async () => {
  const view = mount();
  await view.show({ character: '日' }); const first = view.current;
  const next = await view.show({ character: '本' });
  assert.equal(first.destroyed, true); assert.equal(FakeAnimator.instances.length, 2); assert.equal(next.props['data-animated'], 'true');
  const broken = await view.show({ character: '壊' });
  assert.equal(view.current.destroyed, true); assert.equal(broken.props['data-animated'], undefined); assert.equal(asText(broken), '壊');
  view.end();
  const unmounted = mount(); await unmounted.show({ character: '日' }); const live = unmounted.current; unmounted.end(); assert.equal(live.destroyed, true);
});
