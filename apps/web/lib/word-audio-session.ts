export interface WordClipItem {
  key: string;
  text: string;
  reading: string;
  provider: "voicevox" | "edge";
  voice: string | number;
}

export type WordClipFetcher = (item: WordClipItem, signal: AbortSignal) => Promise<string | null>;

export class WordAudioSession {
  readonly lessonId: string;
  private fetcher: WordClipFetcher;
  private clips = new Map<string, string>();
  private queue: WordClipItem[] = [];
  private pending = new Map<string, { promise: Promise<string | null>; resolve: (value: string | null) => void }>();
  private running = false;
  private suspended = false;
  private activeKey: string | null = null;
  private controller: AbortController | null = null;
  private generation = 0;

  constructor(lessonId: string, fetcher: WordClipFetcher) {
    this.lessonId = lessonId;
    this.fetcher = fetcher;
  }

  setFetcher(fetcher: WordClipFetcher): void {
    this.fetcher = fetcher;
  }

  get(key: string): string | undefined {
    return this.clips.get(key);
  }

  setSuspended(suspended: boolean): void {
    this.suspended = suspended;
    if (!suspended) void this.pump();
  }

  setItems(items: WordClipItem[]): void {
    const priorityKeys = this.queue.filter(item => this.pending.has(item.key)).map(item => item.key);
    const seen = new Set<string>();
    const available = items.filter(item => {
      if (seen.has(item.key) || this.clips.has(item.key) || this.activeKey === item.key) return false;
      seen.add(item.key);
      return true;
    });
    this.queue = [
      ...priorityKeys.map(key => available.find(item => item.key === key)).filter((item): item is WordClipItem => Boolean(item)),
      ...available.filter(item => !priorityKeys.includes(item.key)),
    ];
    for (const [key, waiter] of this.pending) {
      if (key !== this.activeKey && !seen.has(key)) {
        waiter.resolve(null);
        this.pending.delete(key);
      }
    }
    void this.pump();
  }

  request(item: WordClipItem): Promise<string | null> {
    const cached = this.clips.get(item.key);
    if (cached) return Promise.resolve(cached);
    const waiting = this.pending.get(item.key);
    if (waiting) {
      if (this.activeKey !== item.key) {
        this.queue = this.queue.filter(queued => queued.key !== item.key);
        this.queue.unshift(item);
      }
      void this.pump();
      return waiting.promise;
    }
    let resolve!: (value: string | null) => void;
    const promise = new Promise<string | null>(done => { resolve = done; });
    this.pending.set(item.key, { promise, resolve });
    if (this.activeKey !== item.key) {
      this.queue = this.queue.filter(queued => queued.key !== item.key);
      this.queue.unshift(item);
    }
    void this.pump();
    return promise;
  }

  clear(): void {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
    this.activeKey = null;
    this.queue = [];
    this.clips.clear();
    for (const waiter of this.pending.values()) waiter.resolve(null);
    this.pending.clear();
  }

  private async pump(): Promise<void> {
    if (this.running || this.suspended) return;
    this.running = true;
    const generation = this.generation;
    try {
      while (!this.suspended && this.queue.length > 0 && generation === this.generation) {
        const item = this.queue.shift()!;
        if (this.clips.has(item.key)) continue;
        this.activeKey = item.key;
        this.controller = new AbortController();
        let clip: string | null = null;
        try {
          clip = await this.fetcher(item, this.controller.signal);
        } catch {
          // A failed preload remains eligible for a later tap to retry.
        }
        if (generation !== this.generation) return;
        if (clip) this.clips.set(item.key, clip);
        this.pending.get(item.key)?.resolve(clip);
        this.pending.delete(item.key);
        this.activeKey = null;
        this.controller = null;
      }
    } finally {
      this.running = false;
      if (!this.suspended && this.queue.length > 0) void this.pump();
    }
  }
}

let currentSession: WordAudioSession | null = null;

export function getWordAudioSession(lessonId: string, fetcher: WordClipFetcher): WordAudioSession {
  if (typeof window === "undefined") {
    return new WordAudioSession(lessonId, fetcher);
  }
  if (currentSession?.lessonId !== lessonId) {
    currentSession?.clear();
    currentSession = new WordAudioSession(lessonId, fetcher);
  } else {
    currentSession.setFetcher(fetcher);
  }
  return currentSession;
}

export function clearWordAudioSession(): void {
  currentSession?.clear();
  currentSession = null;
}

export function retainWordAudioForPath(pathname: string): void {
  if (pathname === "/") return;
  const lessonPath = pathname.match(/^\/lesson\/([^/]+)\/?$/);
  if (lessonPath && currentSession?.lessonId === decodeURIComponent(lessonPath[1])) return;
  clearWordAudioSession();
}
