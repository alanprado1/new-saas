import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLessonSpec } from './inventory';
import { assertContentAlignment, getContentPack } from './content-registry';
import { AttemptError, assertAttemptPack, attemptResult, evaluateAction, initialAttemptState, validateAction, type SavedAttempt } from './attempt';

export const coursePack = (record: string, version?: string) => {
  const spec = getLessonSpec(record), pack = getContentPack(record, version);
  if (!spec || !pack) throw new AttemptError('Lesson content version unavailable.', 409);
  assertContentAlignment(pack, spec);
  return { pack, hash: createHash('sha256').update(JSON.stringify(pack)).digest('hex') };
};
export function uuid(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
const stable = (v: unknown): string => v && typeof v === 'object' && !Array.isArray(v)
  ? JSON.stringify(Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, JSON.parse(stable(x))]))) : JSON.stringify(v);
function databaseError(error: { code?: string; message: string }) {
  if (error.code === 'P0001' || error.code === '23505') throw new AttemptError(error.message, 409);
  // Do not expose database configuration or backend messages to the learner.
  throw new AttemptError('Course save unavailable. Your response is retained; retry the save.', 503);
}
export async function startAttempt(db: SupabaseClient, user: string, input: Record<string, unknown>) {
  if (!uuid(input.requestId) || typeof input.recordId !== 'string' || typeof input.contentVersion !== 'string' || typeof input.contentHash !== 'string' || typeof input.restart !== 'boolean' || Object.keys(input).some(k => !['requestId','recordId','contentVersion','contentHash','restart'].includes(k))) throw new AttemptError('Invalid attempt request.');
  const { pack, hash } = coursePack(input.recordId, input.contentVersion);
  if (input.contentHash !== hash) throw new AttemptError('Lesson content version changed. Reload before starting.', 409);
  const state = initialAttemptState(pack);
  const { data, error } = await db.rpc('course_start_attempt', { p_id: input.requestId, p_user: user, p_record: pack.recordId,
    p_version: pack.contentVersion, p_hash: hash, p_restart: input.restart, p_state: state, p_result: attemptResult(pack, state) });
  if (error) databaseError(error);
  const attempt = data as SavedAttempt;
  assertAttemptPack(attempt, pack, hash);
  return attempt;
}
export async function saveAttemptEvent(db: SupabaseClient, user: string, id: string, input: Record<string, unknown>) {
  if (!uuid(id) || !uuid(input.requestId) || !Number.isInteger(input.sequence) || (input.sequence as number) < 1 || (input.sequence as number) > 5000 || typeof input.contentVersion !== 'string' || typeof input.contentHash !== 'string' || Object.keys(input).some(k => !['requestId','sequence','contentVersion','contentHash','action'].includes(k))) throw new AttemptError('Invalid save request.');
  const action = validateAction(input.action);
  const { data, error } = await db.from('course_attempts').select('*').eq('id', id).eq('user_id', user).maybeSingle();
  if (error) databaseError(error);
  if (!data) throw new AttemptError('Attempt not found.', 404);
  const attempt = data as SavedAttempt;
  const { pack, hash } = coursePack(attempt.record_id, input.contentVersion);
  if (input.contentHash !== hash) throw new AttemptError('Lesson content version changed. Reload before saving.', 409);
  assertAttemptPack(attempt, pack, hash);
  if (!attempt.active) throw new AttemptError('Attempt was restarted. Reopen the saved lesson.', 409);
  const previous = await db.from('course_attempt_events').select('sequence,action').eq('attempt_id', id).eq('user_id', user).eq('request_id', input.requestId).maybeSingle();
  if (previous.error) databaseError(previous.error);
  if (previous.data) {
    if (previous.data.sequence !== input.sequence || stable(previous.data.action) !== stable(action)) throw new AttemptError('Conflicting duplicate request.', 409);
    return attempt;
  }
  if (input.sequence !== attempt.revision + 1 || attempt.completed_at) throw new AttemptError('Event order conflict. Another tab may have saved this attempt.', 409);
  const state = evaluateAction(pack, attempt.state, action);
  const result = attemptResult(pack, state);
  const saved = await db.rpc('course_save_event', { p_attempt: id, p_user: user, p_request: input.requestId,
    p_sequence: input.sequence, p_action: action, p_version: pack.contentVersion, p_hash: hash,
    p_state: state, p_result: result, p_complete: result.completionEligible });
  if (saved.error) databaseError(saved.error);
  return saved.data as SavedAttempt;
}
