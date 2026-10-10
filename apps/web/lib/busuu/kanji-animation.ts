/**
 * Client runtime for the vendored Kanji Stroke Animation Engine (lib/kanji-animator, synced by scripts/sync-kanji-animator.mjs).
 * The engine touches the DOM and the Cache API, so it is imported lazily and only ever from the browser. Everything here is
 * presentation: which characters have stroke data, one shared geometry loader, and silent lesson preloading.
 */
import type { KanjiLoader } from '@/lib/kanji-animator/src';
import type { LessonContentScreen } from './types';

export type KanjiEngine = typeof import('@/lib/kanji-animator/src');
export const KANJI_DATA_PATH = '/kanji/'; // the bundled set in public/kanji: manifest.json + animcjk-brush-v1/<hex>.json
export const KANJI_CACHE_NAME = 'course-kanji-brush-v1'; // AnimCJK brush geometry
export const KANJI_MAX_ENTRIES = 256; // memory and persistent cache entries: comfortably more than a lesson's working set
export const KANJI_STYLE = 'animcjk-brush-v1'; // the engine's default geometry style

/** Reads a manifest: the supported characters. A manifest for any other style (an old Noto set) supports nothing. */
export function parseKanjiManifest(data: unknown): Set<string> {
  const manifest = data as { defaultStyle?: unknown; characters?: unknown } | null;
  if (manifest?.defaultStyle !== KANJI_STYLE || !Array.isArray(manifest.characters)) return new Set();
  return new Set(manifest.characters.filter((c): c is string => typeof c === 'string' && [...c].length === 1));
}

export type KanjiRuntimeDeps = {
  loadEngine: () => Promise<KanjiEngine>;
  /** Resolves the parsed <base>/manifest.json; rejects when it is unavailable. */
  fetchManifest: () => Promise<unknown>;
  baseUrl: () => string;
};

/** One lazy engine, one geometry loader and one manifest per runtime (the app uses the module singleton below). */
export function createKanjiRuntime(deps: KanjiRuntimeDeps) {
  let engine: Promise<KanjiEngine> | undefined;
  let loader: Promise<KanjiLoader> | undefined;
  let manifest: Promise<Set<string>> | undefined;
  const requested = new Set<string>();

  const getEngine = () => (engine ??= deps.loadEngine().catch(error => { engine = undefined; throw error; }));
  const getLoader = () => (loader ??= getEngine().then(mod => mod.createKanjiLoader({ baseUrl: deps.baseUrl(), cacheName: KANJI_CACHE_NAME, maxEntries: KANJI_MAX_ENTRIES })).catch(error => { loader = undefined; throw error; }));
  /** Characters that have stroke data. An unavailable manifest means "none", so every character keeps its static glyph; it is retried next time. */
  const getSupported = () => (manifest ??= deps.fetchManifest().then(parseKanjiManifest).catch(() => { manifest = undefined; return new Set<string>(); }));

  /** Preload each supported character once. Silent: never throws, never reports, failed characters can be retried by a later call. */
  async function preload(characters: Iterable<string>): Promise<void> {
    try {
      const supported = await getSupported();
      const wanted = [...new Set(characters)].filter(c => supported.has(c) && !requested.has(c));
      if (!wanted.length) return;
      wanted.forEach(c => requested.add(c));
      const kanjiLoader = await getLoader();
      const results = await Promise.allSettled(wanted.map(c => kanjiLoader.load(c)));
      results.forEach((result, i) => { if (result.status === 'rejected') requested.delete(wanted[i]); });
    } catch { /* Preloading is an optimisation only. */ }
  }
  return { engine: getEngine, loader: getLoader, supported: getSupported, preload };
}

const baseUrl = () => new URL(KANJI_DATA_PATH, window.location.origin).href;
export const kanjiRuntime = createKanjiRuntime({
  loadEngine: () => import('@/lib/kanji-animator/src'),
  fetchManifest: async () => {
    const response = await fetch(`${baseUrl()}manifest.json`);
    if (!response.ok) throw new Error(`Kanji manifest unavailable: HTTP ${response.status}`);
    return response.json();
  },
  baseUrl,
});

/** The distinct kanji characters taught on a lesson's kanji screens. */
export function getLessonKanji(screens: readonly Pick<LessonContentScreen, 'renderer' | 'kanji'>[]): string[] {
  const out = new Set<string>();
  for (const screen of screens) {
    const character = screen.renderer === 'kanji' ? screen.kanji?.character : undefined;
    if (character && [...character].length === 1) out.add(character);
  }
  return [...out];
}
