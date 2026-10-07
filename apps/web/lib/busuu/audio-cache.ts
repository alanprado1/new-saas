/**
 * Persistent browser cache for course TTS clips (Cache API).
 *
 * Privacy: entries are addressed only by a SHA-256 hash, so the stored request URLs never contain Japanese text, readings
 * or account ids. The cache is never rendered, logged or exposed through the DOM. Speed is intentionally not part of the key:
 * `/api/tts` does not receive it (it is applied client-side as `playbackRate`), so the same bytes serve every speed.
 */
export const CLIP_CACHE_NAME = 'course-tts-v1';
export const CLIP_KEY_VERSION = 'v1';
export const CLIP_CACHE_LIMITS = { maxEntries: 1000, maxBytes: 100 * 1024 * 1024, maxAgeMs: 30 * 24 * 60 * 60 * 1000, maxClipBase64: 8_000_000, pruneEvery: 25 };
const ORIGIN = 'https://course-tts-cache.invalid';
const STAMP = 'x-clip-at', SIZE = 'x-clip-size';

export type ClipKeyInput = { text: string; reading?: string; provider: 'edge' | 'voicevox'; voice: string | number };

export interface ClipStore {
  get(hash: string): Promise<string | null>;
  has(hash: string): Promise<boolean>;
  put(hash: string, base64: string): Promise<boolean>;
  delete(hash: string): Promise<void>;
  prune(): Promise<void>;
}
export interface CacheLike {
  match(request: string): Promise<Response | undefined>;
  put(request: string, response: Response): Promise<void>;
  delete(request: string): Promise<boolean>;
  keys(): Promise<readonly { url: string }[]>;
}
export interface CacheStorageLike { open(name: string): Promise<CacheLike> }

/** The same shape check used before any clip is played or stored. Empty or malformed audio is never cached. */
export function isPlayableClip(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

/** Hash of every input that changes the synthesized bytes: account, provider, voice, reading and text. Null when hashing is unavailable. */
export async function clipCacheKey(account: string, item: ClipKeyInput): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  try {
    const bytes = new TextEncoder().encode(JSON.stringify([CLIP_KEY_VERSION, account, item.provider, item.voice, item.reading ?? '', item.text]));
    return [...new Uint8Array(await subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

function toBytes(base64: string) {
  const binary = atob(base64), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function createCacheApiClipStore(storage: CacheStorageLike, now: () => number = Date.now, limits = CLIP_CACHE_LIMITS): ClipStore {
  let opened: Promise<CacheLike> | null = null;
  let puts = 0, pruning: Promise<void> | null = null;
  const open = () => opened ??= storage.open(CLIP_CACHE_NAME);
  const url = (hash: string) => `${ORIGIN}/${CLIP_KEY_VERSION}/${hash}`;
  const fresh = (response: Response) => {
    const at = Number(response.headers.get(STAMP));
    return Number.isFinite(at) && at > 0 && now() - at <= limits.maxAgeMs && at <= now() + 60_000;
  };
  const store: ClipStore = {
    async get(hash) {
      try {
        const cache = await open(), request = url(hash), response = await cache.match(request);
        if (!response) return null;
        if (!fresh(response)) { await cache.delete(request); return null; }
        const clip = toBase64(await response.arrayBuffer());
        if (!isPlayableClip(clip) || clip.length > limits.maxClipBase64) { await cache.delete(request); return null; }
        return clip;
      } catch { return null; }
    },
    async has(hash) {
      try {
        const response = await (await open()).match(url(hash));
        return Boolean(response && fresh(response) && Number(response.headers.get(SIZE)) > 0);
      } catch { return false; }
    },
    async put(hash, base64) {
      if (!isPlayableClip(base64) || base64.length > limits.maxClipBase64) return false;
      try {
        const bytes = toBytes(base64);
        if (!bytes.length) return false;
        await (await open()).put(url(hash), new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream', [STAMP]: String(now()), [SIZE]: String(bytes.length) } }));
        if (++puts % limits.pruneEvery === 0) void store.prune();
        return true;
      } catch { return false; }
    },
    async delete(hash) { try { await (await open()).delete(url(hash)); } catch { /* A missing entry is already gone. */ } },
    prune() {
      return pruning ??= (async () => {
        try {
          const cache = await open();
          const rows: { url: string; at: number; size: number }[] = [];
          for (const request of await cache.keys()) {
            const response = await cache.match(request.url);
            const at = response ? Number(response.headers.get(STAMP)) : NaN;
            if (!response || !Number.isFinite(at) || now() - at > limits.maxAgeMs) { await cache.delete(request.url); continue; }
            rows.push({ url: request.url, at, size: Number(response.headers.get(SIZE)) || 0 });
          }
          rows.sort((a, b) => a.at - b.at);
          let bytes = rows.reduce((n, row) => n + row.size, 0), count = rows.length;
          for (const row of rows) {
            if (count <= limits.maxEntries && bytes <= limits.maxBytes) break;
            await cache.delete(row.url); count--; bytes -= row.size;
          }
        } catch { /* Pruning is best effort. */ } finally { pruning = null; }
      })();
    },
  };
  return store;
}

/** The browser store, or null where Cache API/crypto are unavailable (insecure origin, private modes, old browsers). */
export function createBrowserClipStore(): ClipStore | null {
  try {
    if (typeof caches === 'undefined' || !globalThis.crypto?.subtle) return null;
    return createCacheApiClipStore(caches as unknown as CacheStorageLike);
  } catch { return null; }
}
