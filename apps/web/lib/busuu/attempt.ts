import { getPackReadiness } from './content-readiness';
import { createLessonState, getLessonResult, transitionLesson, type LessonAction, type LessonState } from './runner';
import type { LessonContentPack } from './types';
import { validTypedDraft } from './typed-input';

export class AttemptError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type SavedAttempt = {
  id: string; user_id: string; record_id: string; content_version: string; content_hash: string;
  revision: number; state: LessonState; result: ReturnType<typeof getLessonResult>;
  completed_at: string | null; active: boolean;
};
export type AttemptEvent = { requestId: string; sequence: number; action: LessonAction };
export function initialAttemptState(pack: LessonContentPack) {
  if (!getPackReadiness(pack).playable) throw new AttemptError('This content cannot create a saved attempt.');
  return transitionLesson(pack, createLessonState(pack), { type: 'start' });
}
export function assertAttemptPack(attempt: Pick<SavedAttempt, 'record_id' | 'content_version' | 'content_hash'>, pack: LessonContentPack, hash: string) {
  if (attempt.record_id !== pack.recordId || attempt.content_version !== pack.contentVersion || attempt.content_hash !== hash) {
    throw new AttemptError('Content version changed. Keep the saved attempt and restart with the current lesson.', 409);
  }
}
// Exact action shapes: no client outcomes, scores, completion flags or state are accepted.
export function validateAction(input: unknown): LessonAction {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AttemptError('Invalid response.');
  const a = input as Record<string, unknown>;
  const shapes: Record<string, string[]> = { audio_ready: [], continue: [], truth: ['value'], choice: ['id'], toggle_option: ['id'], selection_check: [], token: ['id'], remove_token: ['slot'], pair: ['side', 'id'], typed_draft: ['text'], typed_check: [] };
  if (typeof a.type !== 'string' || !Object.hasOwn(shapes, a.type) || typeof a.screenId !== 'string' || a.screenId.length > 100) throw new AttemptError('Invalid response type or screen.');
  const keys = ['type', 'screenId', ...shapes[a.type]];
  if (Object.keys(a).length !== keys.length || keys.some(k => !Object.hasOwn(a, k))) throw new AttemptError('Unexpected response fields.');
  if (keys.includes('id') && (typeof a.id !== 'string' || a.id.length > 100)) throw new AttemptError('Invalid answer ID.');
  if (a.type === 'truth' && typeof a.value !== 'boolean') throw new AttemptError('Invalid truth response.');
  if (a.type === 'typed_draft' && !validTypedDraft(a.text)) throw new AttemptError('Invalid typed draft.');
  if (a.type === 'pair' && a.side !== 'left' && a.side !== 'right') throw new AttemptError('Invalid matching side.');
  if (a.type === 'remove_token' && (!Number.isInteger(a.slot) || (a.slot as number) < 0)) throw new AttemptError('Invalid gap.');
  return Object.fromEntries(keys.map(k => [k, a[k]])) as LessonAction;
}
export function evaluateAction(pack: LessonContentPack, state: LessonState, input: unknown) {
  const action = validateAction(input);
  const next = transitionLesson(pack, state, action);
  if (JSON.stringify(next) === JSON.stringify(state)) throw new AttemptError('Response is invalid for the current screen or event order.', 409);
  return next;
}
export const attemptResult = getLessonResult;
