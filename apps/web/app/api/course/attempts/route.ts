import { createClient as createAdmin } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { AttemptError } from '@/lib/busuu/attempt';
import { saveAttemptEvent, startAttempt } from '@/lib/busuu/attempt-server';
import { LOCAL_WALKTHROUGH_OWNER, getLocalWalkthroughDb, isLocalWalkthroughRequest } from '@/lib/busuu/local-walkthrough';

export const dynamic = 'force-dynamic';
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, X-Course-Owner' } });
async function account(request: Request) {
  // Gated local walkthrough (dev + env opt-in + loopback host): fixed synthetic owner, in-memory storage, no Supabase.
  if (isLocalWalkthroughRequest(request)) {
    if (request.headers.get('X-Course-Owner') !== LOCAL_WALKTHROUGH_OWNER) throw new AttemptError('Your account changed. Reopen the lesson.', 409);
    return { db: getLocalWalkthroughDb(), user: LOCAL_WALKTHROUGH_OWNER, local: true };
  }
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new AttemptError('Sign in to save course progress.', 401);
  if (request.headers.get('X-Course-Owner') !== user.id) throw new AttemptError('Your account changed. Reopen the lesson.', 409);
  return { db, user: user.id, local: false };
}
function failure(error: unknown) {
  return reply({ error: error instanceof AttemptError ? error.message : 'Course save unavailable. Retry to keep your response.' }, error instanceof AttemptError ? error.status : 503);
}
export async function GET(request: Request) {
  try {
    const { db, user } = await account(request);
    // Read through the authenticated client: owner RLS applies as well as the explicit filter.
    const { data, error } = await db.from('course_attempts').select('*').eq('user_id', user).not('completed_at', 'is', null).order('completed_at', { ascending: false });
    if (error) throw new AttemptError('Saved progress is unavailable. Retry loading it.', 503);
    // Optional map presentation read: active, unfinished attempts (record and visited-screen count only).
    if (new URL(request.url).searchParams.get('include') === 'active') {
      const { data: active, error: activeError } = await db.from('course_attempts').select('*').eq('user_id', user).eq('active', true);
      if (activeError) throw new AttemptError('Saved progress is unavailable. Retry loading it.', 503);
      const inProgress = (active ?? []).filter((a: { completed_at: string | null }) => !a.completed_at)
        .map((a: { record_id: string; state?: { visited?: unknown[] } }) => ({ record_id: a.record_id, visited: Array.isArray(a.state?.visited) ? a.state.visited.length : 0 }));
      return reply({ owner: user, attempts: data, inProgress });
    }
    return reply({ owner: user, attempts: data });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const { db, user, local } = await account(request);
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) throw new AttemptError('Invalid request origin.', 403);
    if (Number(request.headers.get('Content-Length') ?? 0) > 8192) throw new AttemptError('Response too large.', 413);
    const text = await request.text();
    if (text.length > 8192) throw new AttemptError('Response too large.', 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(text); } catch { throw new AttemptError('Invalid request.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AttemptError('Invalid request.');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!local && !key) throw new AttemptError('Course saving needs server configuration.', 503);
    const admin = local ? db : createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
    const url = new URL(request.url), id = url.searchParams.get('attempt');
    const attempt = id ? await saveAttemptEvent(admin, user, id, body) : await startAttempt(admin, user, body);
    return reply({ owner: user, attempt });
  } catch (error) { return failure(error); }
}
