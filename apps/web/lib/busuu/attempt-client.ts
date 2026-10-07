import { initialAttemptState, type AttemptEvent, type SavedAttempt } from './attempt';
import { transitionLesson, type LessonAction, type LessonState } from './runner';
import type { LessonContentPack } from './types';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
type Start = { requestId: string; recordId: string; contentVersion: string; contentHash: string; restart: boolean };
type Reply = { owner: string; attempt: SavedAttempt };
type Transport = (path: string, body: unknown, owner: string, signal: AbortSignal) => Promise<Reply>;
export type SaveSnapshot = {
  ready: boolean; state: LessonState; pending: number; status: 'loading' | 'saving' | 'saved' | 'error';
  message: string; storageWarning: string; confirmed: SavedAttempt | null;
};
export const courseTransport: Transport = async (path, body, owner, signal) => {
  const response = await fetch(path, { method: 'POST', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    headers: { 'Content-Type': 'application/json', 'X-Course-Owner': owner }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Save failed. Retry your retained response.');
  return data;
};

// One controller belongs to one mounted account/pack. No global learner cache.
export class CourseAttemptSession {
  private acknowledged: SavedAttempt | null = null;
  private queue: AttemptEvent[] = [];
  private local: LessonState;
  private status: SaveSnapshot['status'] = 'loading';
  private message = 'Loading your saved attempt…';
  private warning = '';
  private retired = false;
  private loading = false;
  private flight: Promise<void> | null = null;
  private controller = new AbortController();
  private start: Start | null = null;
  private key: string;
  private baseKey: string;
  private previousKey: string | null = null;
  private recovered: { key: string; value: string } | null = null;
  private hash: string | null = null;
  constructor(private pack: LessonContentPack, private owner: string, private storage: Storage | null,
    private transport: Transport, private changed: (snapshot: SaveSnapshot) => void, writerId?: string) {
    this.local = initialAttemptState(pack);
    this.baseKey = `course-outbox:1:${owner}:${pack.recordId}:${pack.contentVersion}`;
    // sessionStorage is tab-scoped and survives refresh. Different writers never replace each other's queues.
    if (!writerId) {
      try {
        const previous = sessionStorage.getItem(`${this.baseKey}:writer`);
        if (previous) this.previousKey = `${this.baseKey}:writer:${previous}`;
        // A duplicated browser tab may clone sessionStorage. Each mount still gets a unique writer.
        writerId = crypto.randomUUID();
        sessionStorage.setItem(`${this.baseKey}:writer`, writerId);
      } catch { writerId = crypto.randomUUID(); }
    }
    this.key = `${this.baseKey}:writer:${writerId}`;
    try { this.start = JSON.parse(storage?.getItem(`${this.previousKey ?? this.key}:start`) ?? 'null'); } catch { this.storageFailure(); }
  }
  snapshot(): SaveSnapshot {
    return { ready: !!this.acknowledged && !this.loading && !this.retired, state: this.local, pending: this.queue.length,
      status: this.status, message: this.message, storageWarning: this.warning, confirmed: this.acknowledged };
  }
  private emit() { if (!this.retired) this.changed(this.snapshot()); }
  private storageFailure() { this.warning = 'Browser recovery storage is unavailable. Keep this page open until saves are confirmed.'; }
  private persist() {
    try {
      if (!this.storage) { this.storageFailure(); return; }
      if (this.start) this.storage.setItem(`${this.key}:start`, JSON.stringify(this.start));
      else this.storage.removeItem(`${this.key}:start`);
      if (this.acknowledged) this.storage.setItem(this.key, JSON.stringify({ attemptId: this.acknowledged.id, events: this.queue }));
    } catch { this.storageFailure(); }
  }
  private check(reply: Reply) {
    const a = reply.attempt;
    if (reply.owner !== this.owner || a?.user_id !== this.owner) throw new Error('Your account changed. Reopen the lesson.');
    if (a.record_id !== this.pack.recordId || a.content_version !== this.pack.contentVersion || a.content_hash !== this.hash || !a.active) throw new Error('Saved content version changed. Reload and restart this lesson.');
    return a;
  }
  private project() {
    if (!this.acknowledged) return;
    this.local = this.queue.filter(e => e.sequence > this.acknowledged!.revision)
      .reduce((state, e) => transitionLesson(this.pack, state, e.action), this.acknowledged.state);
  }
  async open() {
    if (this.retired || this.loading) return;
    this.loading = true; this.status = 'loading'; this.message = this.start?.restart ? 'Starting a new attempt…' : 'Loading your saved attempt…'; this.emit();
    try {
      this.hash ??= [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(this.pack))))].map(b => b.toString(16).padStart(2, '0')).join('');
      if (this.retired) return;
      this.start ??= { requestId: crypto.randomUUID(), recordId: this.pack.recordId, contentVersion: this.pack.contentVersion, contentHash: this.hash, restart: false };
      // A pending restart is retried only with the pack for which it was created.
      if (this.start.contentHash !== this.hash) throw new Error('Pending content version changed. Reload the lesson.');
      const starting = this.start; this.persist();
      const reply = await this.transport('/api/course/attempts', starting, this.owner, this.controller.signal);
      if (this.retired) return;
      const saved = this.check(reply);
      if (!starting.restart) {
        try {
          let raw = this.storage?.getItem(this.key) ?? null;
          if (!raw && this.previousKey && this.storage) {
            const value = this.storage.getItem(this.previousKey);
            const candidate = JSON.parse(value ?? 'null');
            if (candidate?.attemptId === saved.id && candidate.events?.length) {
              raw = value; this.recovered = { key: this.previousKey, value: value! };
            }
          }
          if (!raw && this.storage) {
            // A newly opened tab may recover a retired tab's pending queue. Copy it to this writer;
            // leave the source intact until those exact requests have been acknowledged.
            for (let i = 0; i < this.storage.length; i++) {
              const key = this.storage.key(i);
              if (!key?.startsWith(`${this.baseKey}:writer:`) || key.endsWith(':start')) continue;
              const value = this.storage.getItem(key);
              const candidate = JSON.parse(value ?? 'null');
              if (candidate?.attemptId === saved.id && candidate.events?.length) {
                raw = value; this.recovered = { key, value: value! }; break;
              }
            }
          }
          const cached = JSON.parse(raw ?? 'null');
          if (cached?.attemptId === saved.id && Array.isArray(cached.events)) this.queue = cached.events;
        } catch { this.storageFailure(); }
      } else this.queue = [];
      this.acknowledged = saved; this.start = null; this.loading = false;
      this.project(); this.persist(); this.status = 'saved'; this.message = 'Saved to your account.'; this.emit();
      await this.retry();
    } catch (error) {
      if (this.retired) return;
      this.loading = false; this.status = 'error'; this.message = error instanceof Error ? error.message : 'Could not load your attempt.'; this.emit();
    }
  }
  dispatch(action: LessonAction) {
    if (!this.snapshot().ready || this.start) return;
    const next = transitionLesson(this.pack, this.local, action);
    if (JSON.stringify(next) === JSON.stringify(this.local)) return;
    this.local = next;
    this.queue.push({ requestId: crypto.randomUUID(), sequence: (this.queue.at(-1)?.sequence ?? this.acknowledged!.revision) + 1, action });
    this.persist(); this.emit();
    if (this.status !== 'error') void this.retry();
  }
  async retry() {
    if (this.retired) return;
    if (!this.acknowledged || this.start) { await this.open(); return; }
    if (this.flight) { await this.flight; return; }
    this.flight = this.flush();
    await this.flight; this.flight = null;
  }
  private async flush() {
    while (this.queue.length && !this.retired) {
      const event = this.queue[0], id = this.acknowledged!.id;
      this.status = 'saving'; this.message = 'Saving your responses…'; this.emit();
      try {
        const reply = await this.transport(`/api/course/attempts?attempt=${id}`, { ...event, contentVersion: this.pack.contentVersion, contentHash: this.hash }, this.owner, this.controller.signal);
        if (this.retired) return;
        const saved = this.check(reply);
        if (saved.id !== id || saved.revision < event.sequence) throw new Error('Save acknowledgement did not match. Retry your response.');
        this.acknowledged = saved; this.queue.shift(); this.project(); this.persist(); this.emit();
      } catch (error) {
        if (this.retired) return;
        this.status = 'error'; this.message = error instanceof Error ? error.message : 'Save failed. Your response is retained.'; this.emit(); return;
      }
    }
    if (this.recovered) {
      try { if (this.storage?.getItem(this.recovered.key) === this.recovered.value) this.storage.removeItem(this.recovered.key); } catch { this.storageFailure(); }
      this.recovered = null;
    }
    this.status = 'saved'; this.message = 'Saved to your account.'; this.emit();
  }
  async restart() {
    if (this.retired || this.loading) return;
    // Wait for the existing request; restarting cannot let its acknowledgement overwrite the new attempt.
    if (this.flight) await this.flight;
    if (this.retired) return;
    this.hash ??= [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(this.pack))))].map(b => b.toString(16).padStart(2, '0')).join('');
    if (this.retired) return;
    if (!this.start?.restart) this.start = { requestId: crypto.randomUUID(), recordId: this.pack.recordId, contentVersion: this.pack.contentVersion, contentHash: this.hash, restart: true };
    this.persist(); await this.open();
  }
  dispose() { this.retired = true; this.controller.abort(); }
}
