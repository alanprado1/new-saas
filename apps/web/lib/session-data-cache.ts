type Entry<T> = { savedAt: number; value: T };
const PREFIX = "study-cache:v1:";
const FRESH_MS = 5 * 60_000;

/** Session storage is optional; memory always remains the source for rendering. */
export class SessionDataCache<T> {
  private entries = new Map<string, Entry<T>>();
  private pending = new Map<string, Promise<T>>();
  private invalidations = new Map<string, number>();
  private listeners = new Set<() => void>();
  private generation = 0;

  constructor(private storage: () => Storage, private now: () => number = Date.now) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private emit() { this.listeners.forEach(listener => listener()); }

  get(key: string): T | null {
    if (!this.entries.has(key)) {
      try {
        const raw = this.storage().getItem(PREFIX + key);
        if (raw) {
          const entry = JSON.parse(raw) as Entry<T>;
          if (typeof entry.savedAt === "number" && entry.value) this.entries.set(key, entry);
        }
      } catch { /* Private browsing and storage limits must not block study. */ }
    }
    return this.entries.get(key)?.value ?? null;
  }

  set(key: string, value: T) {
    const entry = { savedAt: this.now(), value };
    this.entries.set(key, entry);
    try { this.storage().setItem(PREFIX + key, JSON.stringify(entry)); } catch { }
    this.emit();
  }

  isFresh(key: string) {
    this.get(key);
    const entry = this.entries.get(key);
    return Boolean(entry && this.now() - entry.savedAt < FRESH_MS);
  }

  markStale(key: string) {
    const value = this.get(key);
    if (value) {
      this.entries.get(key)!.savedAt = -Infinity;
      try { this.storage().removeItem(PREFIX + key); } catch { }
    }
    this.invalidations.set(key, (this.invalidations.get(key) ?? 0) + 1);
    this.emit();
  }

  load(key: string, fetcher: () => Promise<T>, force = false): Promise<T> {
    const cached = this.get(key);
    const entry = this.entries.get(key);
    if (!force && cached && entry && this.now() - entry.savedAt < FRESH_MS) return Promise.resolve(cached);
    const pending = this.pending.get(key);
    if (pending) return pending;
    const generation = this.generation;
    const revision = this.invalidations.get(key) ?? 0;
    const request = Promise.resolve().then(fetcher).then(value => {
      if (generation !== this.generation) return value;
      if ((this.invalidations.get(key) ?? 0) !== revision) {
        this.pending.delete(key);
        return this.load(key, fetcher, true);
      }
      // A rating saved after this request began takes priority over old data.
      if (this.entries.get(key) !== entry) return this.get(key) ?? value;
      this.set(key, value);
      return value;
    }).finally(() => {
      if (this.pending.get(key) === request) this.pending.delete(key);
    });
    this.pending.set(key, request);
    return request;
  }

  clear() {
    this.generation++;
    this.entries.clear();
    this.pending.clear();
    this.invalidations.clear();
    try {
      const storage = this.storage();
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key?.startsWith(PREFIX)) storage.removeItem(key);
      }
    } catch { }
    this.emit();
  }
}
