import { clipCacheKey, isPlayableClip, type ClipStore } from './audio-cache';

export const COURSE_EDGE_VOICES = [
  { name: 'ja-JP-NanamiNeural', label: 'Nanami' }, { name: 'ja-JP-KeitaNeural', label: 'Keita' },
  { name: 'ja-JP-AoiNeural', label: 'Aoi' }, { name: 'ja-JP-DaichiNeural', label: 'Daichi' },
  { name: 'ja-JP-MayuNeural', label: 'Mayu' }, { name: 'ja-JP-NaokiNeural', label: 'Naoki' },
  { name: 'ja-JP-ShioriNeural', label: 'Shiori' },
];
export type CourseAudioItem = { text: string; reading?: string; provider: 'edge' | 'voicevox'; voice: string | number; speed: number };
export type CourseAudioState = { status: 'idle' | 'loading' | 'playing' | 'error'; message: string };
type Fetcher = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;
type Player = Pick<HTMLAudioElement, 'play' | 'pause' | 'removeAttribute' | 'playbackRate' | 'onended' | 'onerror'>;

export function readCourseAudioPreferences(storage: Pick<Storage, 'getItem'>) {
  let provider: 'edge' | 'voicevox' = 'edge', edgeVoice = COURSE_EDGE_VOICES[0].name, voiceVoxId = 1;
  try {
    if (storage.getItem('pref_ttsProvider') === 'voicevox') provider = 'voicevox';
    const saved = storage.getItem('pref_edgeVoice');
    if (COURSE_EDGE_VOICES.some(v => v.name === saved)) edgeVoice = saved!;
    const id = Number(storage.getItem('pref_voiceVoxId'));
    if (Number.isInteger(id) && id >= 0 && storage.getItem('pref_voiceVoxId') !== null) voiceVoxId = id;
  } catch { /* Storage restrictions do not disable audio. */ }
  return { provider, edgeVoice, voiceVoxId };
}

const MAX_CLIP_BASE64 = 8_000_000;

/** One runner owns one adapter. Cache and playback never outlive its account. */
export class CourseAudioAdapter {
  private account: string | null = null;
  private screen = '';
  private generation = 0;
  private disposed = false;
  private controller: AbortController | null = null;
  private requestTimer: ReturnType<typeof setTimeout> | null = null;
  private player: Player | null = null;
  private finishTurn: ((completed: boolean) => void) | null = null;
  private cache = new Map<string, string>();
  private pending: { key: string; promise: Promise<boolean> } | null = null;
  // Silent whole-lesson prefetch. It is independent of playback: a screen change never aborts it and it never notifies the UI.
  private prefetchQueue: CourseAudioItem[] = [];
  private prefetchActive = 0;
  private prefetchRun = 0;
  private prefetchControllers = new Set<AbortController>();
  private prefetching = new Map<string, Promise<string | null>>();
  private prefetchFailures = new Map<string, number>();
  private pruned = false;
  constructor(private fetcher: Fetcher, private makePlayer: (src: string) => Player, private notify: (state: CourseAudioState) => void, private timeoutMs = 65_000,
    private store: ClipStore | null = null, private prefetchConcurrency = 2) {}

  setAccount(account: string | null) {
    if (account === this.account) return;
    this.cancel(); this.cache.clear(); this.stopPrefetch(); this.account = account;
  }
  setScreen(screen: string) {
    if (screen === this.screen) return;
    this.cancel(); this.screen = screen;
  }
  cancel() {
    this.generation++;
    this.finishTurn?.(false); this.finishTurn = null;
    this.controller?.abort(); this.controller = null; this.pending = null;
    if (this.requestTimer !== null) clearTimeout(this.requestTimer);
    this.requestTimer = null;
    if (this.player) {
      this.player.onended = null; this.player.onerror = null;
      this.player.pause(); this.player.removeAttribute('src'); this.player = null;
    }
    if (!this.disposed) this.notify({ status: 'idle', message: '' });
  }
  dispose() { this.cancel(); this.cache.clear(); this.stopPrefetch(); this.disposed = true; }

  /**
   * Replaces the background queue (first item is fetched first) and stores missing clips in the persistent cache with bounded
   * concurrency. Without a persistent store this does nothing, so unpersisted prefetch cannot waste requests. Failures are silent.
   */
  prefetch(items: CourseAudioItem[]) {
    if (this.disposed || !this.account || !this.store) return;
    if (!this.pruned) { this.pruned = true; void this.store.prune(); }
    this.prefetchQueue = items.filter(item => item.text.trim() && (this.prefetchFailures.get(this.keyOf(item)) ?? 0) < 2);
    this.pumpPrefetch();
  }
  private stopPrefetch() {
    this.prefetchRun++; this.prefetchQueue = []; this.prefetchActive = 0;
    for (const controller of this.prefetchControllers) controller.abort();
    this.prefetchControllers.clear(); this.prefetching.clear(); this.prefetchFailures.clear();
  }
  private pumpPrefetch() {
    const run = this.prefetchRun;
    while (!this.disposed && run === this.prefetchRun && this.prefetchActive < this.prefetchConcurrency && this.prefetchQueue.length) {
      const item = this.prefetchQueue.shift()!, key = this.keyOf(item);
      if (this.cache.has(key) || this.prefetching.has(key)) continue;
      this.prefetchActive++;
      const work = this.prefetchOne(key, item, run);
      this.prefetching.set(key, work);
      void work.finally(() => {
        if (run !== this.prefetchRun) return;
        this.prefetching.delete(key); this.prefetchActive--; this.pumpPrefetch();
      });
    }
  }
  /** Resolves the clip when it was fetched from the network, otherwise null (already stored, failed or retired). Never rejects. */
  private async prefetchOne(key: string, item: CourseAudioItem, run: number): Promise<string | null> {
    const store = this.store, account = this.account;
    if (!store || !account) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    this.prefetchControllers.add(controller);
    try {
      const hash = await clipCacheKey(account, item);
      if (!hash || run !== this.prefetchRun || await store.has(hash) || run !== this.prefetchRun) return null;
      const response = await this.fetcher('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: this.requestBody(item), signal: controller.signal });
      if (run !== this.prefetchRun) return null;
      if (!response.ok) throw new Error('prefetch');
      const data = await response.json();
      if (run !== this.prefetchRun) return null;
      if (!isPlayableClip(data?.audioBase64) || data.audioBase64.length > MAX_CLIP_BASE64) throw new Error('prefetch');
      await store.put(hash, data.audioBase64);
      return data.audioBase64;
    } catch {
      if (run === this.prefetchRun) this.prefetchFailures.set(key, (this.prefetchFailures.get(key) ?? 0) + 1);
      return null;
    } finally {
      clearTimeout(timer); this.prefetchControllers.delete(controller);
    }
  }
  private keyOf(item: CourseAudioItem) { return JSON.stringify([this.account, item.provider, item.voice, item.text, item.reading ?? '']); }
  private requestBody(item: CourseAudioItem) {
    return JSON.stringify({ text: item.text, ...(item.reading ? { reading: item.reading } : {}), provider: item.provider, voice: item.voice, targetLanguage: 'ja', learningDirection: 'en-ja' });
  }
  private remember(key: string, clip: string) {
    // Bound this in-memory cache to 32 clips / approximately 8 MB of base64.
    while (this.cache.size && (this.cache.size >= 32 || [...this.cache.values()].reduce((n, v) => n + v.length, 0) + clip.length > MAX_CLIP_BASE64)) this.cache.delete(this.cache.keys().next().value!);
    if (clip.length <= MAX_CLIP_BASE64) this.cache.set(key, clip);
  }
  /** Best-effort, non-blocking write of a clip fetched during playback. */
  private persist(item: CourseAudioItem, clip: string) {
    const store = this.store, account = this.account;
    if (!store || !account) return;
    void clipCacheKey(account, item).then(hash => { if (hash && !this.disposed && account === this.account) return store.put(hash, clip); }).catch(() => {});
  }
  /** A clip the player rejected must not be served from the persistent cache again. */
  private forget(item: CourseAudioItem) {
    const store = this.store, account = this.account;
    if (!store || !account) return;
    void clipCacheKey(account, item).then(hash => { if (hash) return store.delete(hash); }).catch(() => {});
  }

  /** Dialogue is one base screen: only a completed sequence satisfies its audio requirement. */
  async playDialogue(items: CourseAudioItem[]): Promise<boolean> {
    this.cancel();
    if (this.disposed || !this.account || !this.screen || !items.length || items.some(item => !item.text.trim())) return false;
    const run = this.generation;
    for (const item of items) {
      if (run !== this.generation) return false;
      const key = this.keyOf(item);
      if (!await this.loadAndPlay(key, item, run, true)) return false;
    }
    return run === this.generation;
  }

  play(item: CourseAudioItem): Promise<boolean> {
    if (this.disposed || !this.account || !this.screen || !item.text.trim()) return Promise.resolve(false);
    const key = this.keyOf(item);
    if (this.pending?.key === key) return this.pending.promise;
    this.cancel();
    const run = this.generation;
    const promise = this.loadAndPlay(key, item, run);
    this.pending = { key, promise };
    void promise.finally(() => { if (this.pending?.promise === promise) this.pending = null; });
    return promise;
  }
  private async loadAndPlay(key: string, item: CourseAudioItem, run: number, waitForEnd = false): Promise<boolean> {
    const current = () => !this.disposed && run === this.generation;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    this.notify({ status: 'loading', message: 'Preparing Japanese audio…' });
    try {
      let clip = this.cache.get(key);
      if (!clip && this.store && this.account) {
        // Memory first, then a running prefetch of this exact clip (joined, not duplicated), then the persistent cache, then the network.
        const joined = this.prefetching.get(key);
        if (joined) { clip = await joined ?? undefined; if (!current()) return false; }
        if (!clip) {
          const hash = await clipCacheKey(this.account, item);
          if (!current()) return false;
          clip = (hash ? await this.store.get(hash) : null) ?? undefined;
          if (!current()) return false;
        }
        if (clip) this.remember(key, clip);
      }
      if (!clip) {
        const controller = new AbortController();
        this.controller = controller;
        timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeoutMs);
        this.requestTimer = timer;
        const response = await this.fetcher('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: this.requestBody(item), signal: controller.signal });
        if (!current()) return false;
        if (!response.ok) throw new Error(response.status === 401 ? 'Sign in again to play Japanese audio.' : 'Japanese audio could not be prepared. Try replay or another voice.');
        const data = await response.json();
        if (!current()) return false;
        clearTimeout(timer); this.requestTimer = null;
        if (!isPlayableClip(data.audioBase64)) throw new Error('The audio response was empty or invalid. Try again.');
        clip = data.audioBase64 as string;
        this.remember(key, clip);
        this.persist(item, clip);
      }
      if (!current()) return false;
      const mime = item.provider === 'voicevox' ? 'audio/wav' : 'audio/mpeg';
      const player = this.makePlayer(`data:${mime};base64,${clip}`);
      this.player = player;
      player.playbackRate = item.speed === 0.75 ? 0.75 : 1;
      const ended = waitForEnd ? new Promise<boolean>(resolve => { this.finishTurn = resolve; }) : null;
      player.onended = () => {
        if (!current() || this.player !== player) return;
        this.finishTurn?.(true); this.finishTurn = null;
        player.onended = null; player.onerror = null;
        this.notify({ status: 'idle', message: '' });
      };
      player.onerror = () => {
        if (!current() || this.player !== player) return;
        this.cache.delete(key); this.forget(item); this.cancel();
        this.notify({ status: 'error', message: 'Audio playback failed. Try replay or another voice.' });
      };
      await player.play();
      if (!current()) { player.pause(); return false; }
      this.notify({ status: 'playing', message: 'Playing Japanese audio' });
      return ended ? await ended : true;
    } catch (error) {
      if (!current()) return false;
      this.cache.delete(key);
      this.cancel();
      this.notify({ status: 'error', message: timedOut ? 'Japanese audio took too long. Retry or choose another voice.' : error instanceof Error ? error.message : 'Japanese audio failed. Try again.' });
      return false;
    } finally {
      if (timer !== null) clearTimeout(timer);
      if (this.requestTimer === timer) this.requestTimer = null;
    }
  }
}
