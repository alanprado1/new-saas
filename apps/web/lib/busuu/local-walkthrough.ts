// Local-only, development-only "walkthrough mode" for the Busuu course.
//
// Purpose: play the real course (map -> launch -> runner -> results -> reload/resume) in a browser
// at localhost without Supabase sign-in and without any hosted database reads or writes.
//
// SAFETY GATE. The mode is active ONLY when ALL of these hold:
//   1. NODE_ENV === 'development'   (inlined by Next at build time, so a production build can never enable it)
//   2. BUSUU_LOCAL_WALKTHROUGH === '1'   (explicit opt-in; set by scripts/busuu-walkthrough.mjs)
//   3. the request host is localhost, 127.0.0.1 or [::1]   (also blocks DNS-rebinding hosts)
// When any condition is false every caller falls through to the existing behavior unchanged.
//
// Scope: only /busuu/** pages, /api/course/attempts, /api/tts and /api/voices are opened, as one fixed synthetic owner.
// Persistence is a process-lifetime in-memory port of the course_start_attempt / course_save_event
// RPC contract in supabase/migrations/20261004011140_course_attempts.sql (the same contract the
// disposable adapters in content/busuu/*-validation/saved-path.mjs use). Restarting the dev server resets it.
import type { SupabaseClient } from '@supabase/supabase-js';

export const LOCAL_WALKTHROUGH_OWNER = 'local-walkthrough-owner';

type WalkthroughEnv = { NODE_ENV?: string; BUSUU_LOCAL_WALKTHROUGH?: string };

// Literal `process.env.X` reads are required so Next can inline NODE_ENV in production bundles.
const currentEnv = (): WalkthroughEnv => ({ NODE_ENV: process.env.NODE_ENV, BUSUU_LOCAL_WALKTHROUGH: process.env.BUSUU_LOCAL_WALKTHROUGH });

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Hostname (no port) of a `Host` header value or a URL; null when it cannot be parsed. */
function hostnameOf(value: string): string | null {
  try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `http://${value}`).hostname.toLowerCase(); } catch { return null; }
}
export function isLoopbackHost(value: string | null | undefined): boolean {
  if (!value) return false;
  const name = hostnameOf(value);
  return name !== null && LOOPBACK_HOSTS.has(name);
}

/** The full three-part gate. `hosts` are every host the request carries (URL host and Host header); all must be loopback. */
export function isLocalWalkthroughEnabled(hosts: ReadonlyArray<string | null | undefined>, env: WalkthroughEnv = currentEnv()): boolean {
  if (env.NODE_ENV !== 'development' || env.BUSUU_LOCAL_WALKTHROUGH !== '1') return false;
  const present = hosts.filter((host): host is string => Boolean(host));
  return present.length > 0 && present.every(isLoopbackHost);
}
export function isLocalWalkthroughRequest(request: Request, env?: WalkthroughEnv): boolean {
  return isLocalWalkthroughEnabled([request.url, request.headers.get('host')], env);
}

/** Only the course pages, the course attempt/progress API and the TTS/voice-list routes the runner calls are reachable without Supabase auth. */
export function isWalkthroughPath(pathname: string): boolean {
  return pathname === '/busuu' || pathname.startsWith('/busuu/') || pathname === '/api/course/attempts'
    || pathname === '/api/tts' || pathname === '/api/voices';
}

// ---------------------------------------------------------------------------------------------
// Browser side: a synthetic auth source so the course components see the fixed local owner.
// next.config.ts mirrors the opt-in into NEXT_PUBLIC_BUSUU_LOCAL_WALKTHROUGH (development only).
// ---------------------------------------------------------------------------------------------
export function isLocalWalkthroughClient(): boolean {
  if (process.env.NODE_ENV !== 'development' || process.env.NEXT_PUBLIC_BUSUU_LOCAL_WALKTHROUGH !== '1') return false;
  return typeof window !== 'undefined' && isLoopbackHost(window.location.host);
}
/** Returns an auth-only stand-in for the Supabase browser client, or null when walkthrough mode is off (use the real client). */
export function localWalkthroughAuthClient(): SupabaseClient | null {
  if (!isLocalWalkthroughClient()) return null;
  const stub = {
    auth: {
      onAuthStateChange(callback: (event: string, session: { user: { id: string } } | null) => void) {
        let live = true;
        // Real auth delivers INITIAL_SESSION asynchronously; keep that ordering.
        queueMicrotask(() => { if (live) callback('INITIAL_SESSION', { user: { id: LOCAL_WALKTHROUGH_OWNER } }); });
        return { data: { subscription: { unsubscribe() { live = false; } } } };
      },
    },
  };
  return stub as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------------------------
// Server side: in-memory storage with the same call surface the attempt server uses
// (rpc + from().select().eq().not().order() + maybeSingle()).
// ---------------------------------------------------------------------------------------------
type Row = Record<string, unknown>;
type Result = { data: unknown; error: { code?: string; message: string } | null };
type MemoryStore = { attempts: Row[]; events: Row[] };

const STORE_KEY = Symbol.for('busuu.localWalkthrough.memoryStore');
// Held on globalThis so route bundles and dev hot reloads share one store for the process lifetime.
function memoryStore(): MemoryStore {
  const holder = globalThis as unknown as Record<symbol, MemoryStore | undefined>;
  return holder[STORE_KEY] ??= { attempts: [], events: [] };
}
const copy = <T,>(value: T): T => structuredClone(value);
const ok = (row: Row | null): Result => ({ data: row ? copy(row) : null, error: null });
// Mirrors `raise exception`, which the attempt server maps from code P0001 to HTTP 409.
const conflict = (message: string): Result => ({ data: null, error: { code: 'P0001', message } });

function startAttempt(p: Row): Result {
  const { attempts } = memoryStore(), now = new Date().toISOString();
  const existing = attempts.find(a => a.id === p.p_id);
  if (existing) {
    if (existing.user_id !== p.p_user || existing.record_id !== p.p_record || existing.content_version !== p.p_version
      || existing.content_hash !== p.p_hash || existing.is_restart !== p.p_restart || !existing.active) return conflict('Attempt start conflict');
    return ok(existing);
  }
  const mine = (a: Row) => a.user_id === p.p_user && a.record_id === p.p_record && a.active;
  if (!p.p_restart) { const active = attempts.find(mine); if (active) return ok(active); }
  for (const a of attempts) if (mine(a)) { a.active = false; a.updated_at = now; }
  const row: Row = { id: p.p_id, user_id: p.p_user, record_id: p.p_record, content_version: p.p_version, content_hash: p.p_hash,
    revision: 0, state: copy(p.p_state), result: copy(p.p_result), completed_at: null, active: true, is_restart: p.p_restart, created_at: now, updated_at: now };
  attempts.push(row);
  return ok(row);
}
function saveEvent(p: Row): Result {
  const { attempts, events } = memoryStore();
  const attempt = attempts.find(a => a.id === p.p_attempt && a.user_id === p.p_user);
  if (!attempt) return conflict('Attempt not found');
  if (!attempt.active) return conflict('Attempt was restarted');
  if (attempt.content_version !== p.p_version || attempt.content_hash !== p.p_hash) return conflict('Content version conflict');
  const duplicate = events.find(e => e.attempt_id === p.p_attempt && e.request_id === p.p_request);
  if (duplicate) {
    if (duplicate.sequence !== p.p_sequence || JSON.stringify(duplicate.action) !== JSON.stringify(p.p_action)) return conflict('Conflicting duplicate request');
    return ok(attempt);
  }
  if (attempt.completed_at !== null || p.p_sequence !== (attempt.revision as number) + 1) return conflict('Event order conflict');
  const now = new Date().toISOString();
  events.push({ attempt_id: p.p_attempt, user_id: p.p_user, sequence: p.p_sequence, request_id: p.p_request, action: copy(p.p_action), created_at: now });
  Object.assign(attempt, { revision: p.p_sequence, state: copy(p.p_state), result: copy(p.p_result), completed_at: p.p_complete ? now : null, updated_at: now });
  return ok(attempt);
}

function query(table: string) {
  const source = () => (table === 'course_attempts' ? memoryStore().attempts : table === 'course_attempt_events' ? memoryStore().events : []);
  const filters: Array<(row: Row) => boolean> = [];
  let order: { column: string; ascending: boolean } | null = null;
  const rows = () => {
    const found = source().filter(row => filters.every(filter => filter(row)));
    if (order) { const { column, ascending } = order; found.sort((a, b) => (String(a[column] ?? '') < String(b[column] ?? '') ? -1 : String(a[column] ?? '') > String(b[column] ?? '') ? 1 : 0) * (ascending ? 1 : -1)); }
    return found;
  };
  const builder = {
    select() { return builder; },
    eq(column: string, value: unknown) { filters.push(row => row[column] === value); return builder; },
    // Only the `is null` form is used by the course API: .not('completed_at', 'is', null).
    not(column: string, operator: string, value: unknown) {
      if (operator !== 'is' || value !== null) throw new Error('Unsupported walkthrough filter');
      filters.push(row => row[column] !== null && row[column] !== undefined); return builder;
    },
    order(column: string, options?: { ascending?: boolean }) { order = { column, ascending: options?.ascending !== false }; return builder; },
    async maybeSingle(): Promise<Result> { return ok(rows()[0] ?? null); },
    then<A, B = never>(resolve?: (value: Result) => A | PromiseLike<A>, reject?: (reason: unknown) => B | PromiseLike<B>) {
      return Promise.resolve<Result>({ data: copy(rows()), error: null }).then(resolve, reject);
    },
  };
  return builder;
}

const memoryDb = {
  async rpc(name: string, params: Row): Promise<Result> {
    if (name === 'course_start_attempt') return startAttempt(params);
    if (name === 'course_save_event') return saveEvent(params);
    throw new Error(`Unexpected walkthrough RPC ${name}`);
  },
  from: query,
};
export function getLocalWalkthroughDb(): SupabaseClient { return memoryDb as unknown as SupabaseClient; }
/** Test helper: clears the process-lifetime store. */
export function resetLocalWalkthroughStore() { const store = memoryStore(); store.attempts.length = 0; store.events.length = 0; }
