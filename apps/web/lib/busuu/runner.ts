import { allowsEnglishOnlyTeaching, getPackReadiness, getScreenContentGaps, isTeachingScreen } from './content-readiness';
import type { LessonContentPack, LessonContentScreen } from './types';
import { canCheckTyped, normalizeTyped, validTypedDraft } from './typed-input';

export type LessonPhase = 'launch' | 'presentation' | 'response' | 'feedback' | 'result' | 'exit';
export type LessonState = {
  phase: LessonPhase; index: number; preview: boolean; completionEligible: boolean;
  audioReady: boolean; visited: number[];
  outcomes: Record<number, { correct: boolean }>;
  selectedChoice: string | boolean | null; slots: (string | null)[];
  endpoint: { side: 'left' | 'right'; id: string } | null;
  matches: string[]; pairMistake: boolean; notice: string;
  typedDraft?: string;
  selectedOptionIds?: string[];
  // Conditional on actual traversal; legacy end retries retain their exact state shape.
  retry?: { queue: number[]; position: number; outcomes: Record<number, { correct: boolean }>; returnIndex?: number };
  retryOutcomes?: Record<number, { correct: boolean }>;
};
export type LessonAction =
  | { type: 'start' | 'start_preview' | 'exit' }
  | { type: 'continue' | 'audio_ready' | 'preview_skip'; screenId: string }
  | { type: 'truth'; screenId: string; value: boolean }
  | { type: 'choice' | 'token' | 'toggle_option'; screenId: string; id: string }
  | { type: 'selection_check'; screenId: string }
  | { type: 'remove_token'; screenId: string; slot: number }
  | { type: 'pair'; screenId: string; side: 'left' | 'right'; id: string }
  | { type: 'typed_draft'; screenId: string; text: string }
  | { type: 'typed_check'; screenId: string };

function enter(pack: LessonContentPack, state: LessonState, index: number): LessonState {
  const s = pack.screens[index];
  const next = { ...state }; delete next.typedDraft; delete next.selectedOptionIds;
  return { ...next, ...(s.renderer === 'typed' ? { typedDraft: '' } : {}), ...(s.renderer === 'multi_choice' ? { selectedOptionIds: [] } : {}), index, phase: isTeachingScreen(s) ? 'presentation' : 'response',
    audioReady: !s.audio.required, slots: s.answer?.kind === 'ordered_slots' ? s.answer.slots.map(() => null) : s.answer?.kind === 'ordered_tokens' ? s.answer.tokens.map(() => null) : [],
    selectedChoice: null, endpoint: null, matches: [], pairMistake: false, notice: '' };
}
export function createLessonState(pack: LessonContentPack): LessonState {
  return { phase: 'launch', index: 0, preview: false, completionEligible: false, audioReady: Boolean(pack.screens[0] && !pack.screens[0].audio.required), visited: [],
    outcomes: {}, selectedChoice: null, slots: [], endpoint: null, matches: [], pairMistake: false, notice: '' };
}
export function getVisibleSupport(screen: LessonContentScreen, phase: LessonPhase) {
  const before = screen.sourceContract?.transcriptBeforeAnswer === false
    ? allowsEnglishOnlyTeaching(screen) ? screen.support.before.filter(b => b.kind !== 'japanese' && !b.secondary) : [] : screen.support.before;
  return phase === 'feedback' ? [...before, ...screen.support.after] : before;
}
export function getTokenBank(screen: LessonContentScreen, state: LessonState) {
  return screen.answer?.kind === 'ordered_slots' || screen.answer?.kind === 'ordered_tokens' ? screen.answer.tokens.filter(t => !state.slots.includes(t.id)) : [];
}
export function getRightOrder(screen: LessonContentScreen, state: LessonState) {
  if (screen.answer?.kind !== 'pairs') return screen.right ?? [];
  const pairs = screen.answer.pairs, items = screen.right ?? [];
  const used = new Set<string>();
  const ordered = (screen.left ?? []).map(left => {
    const match = pairs.find(p => p.leftId === left.id && state.matches.includes(p.id));
    const item = match ? items.find(r => r.id === match.rightId) : undefined;
    if (item) used.add(item.id);
    return item;
  });
  const remaining = items.filter(item => !used.has(item.id));
  return ordered.map(item => item ?? remaining.shift()!);
}
function grade(state: LessonState, correct: boolean): LessonState {
  if (state.retry) return { ...state, phase: 'feedback', notice: '',
    retry: { ...state.retry, outcomes: { ...state.retry.outcomes, [state.index]: { correct } } } };
  return { ...state, phase: 'feedback', notice: '', outcomes: { ...state.outcomes, [state.index]: { correct } } };
}
export function getCurrentOutcome(state: LessonState) {
  return state.retry ? state.retry.outcomes[state.index] : state.outcomes[state.index];
}
function retryQueue(pack: LessonContentPack, state: LessonState) {
  return pack.retryPolicy ? pack.screens.flatMap((s, i) => pack.retryPolicy!.screenIds.includes(s.screenId) && state.outcomes[i]?.correct === false ? [i] : []) : [];
}
export function canContinue(pack: LessonContentPack, state: LessonState) {
  const s = pack.screens[state.index];
  // Playback is optional: Busuu lets learners answer and continue without playing audio. audioReady stays in state (set by audio_ready, which
  // is still accepted) so saved attempts and their event streams replay to identical states.
  return Boolean(s && getScreenContentGaps(s).length === 0 &&
    (state.phase === 'feedback' || state.phase === 'presentation'));
}
export function getLessonResult(pack: LessonContentPack, state: LessonState) {
  const graded = pack.screens.filter(s => !isTeachingScreen(s)).length;
  const correct = Object.values(state.outcomes).filter(o => o.correct).length;
  const queue = retryQueue(pack, state);
  const retryOutcomes = { ...state.retryOutcomes, ...state.retry?.outcomes };
  const retried = Object.values(retryOutcomes);
  const retry = { attempted: retried.length, correct: retried.filter(o => o.correct).length, total: queue.length,
    complete: queue.length === retried.length && queue.every(i => retryOutcomes[i] !== undefined) };
  const complete = state.phase === 'result' && !state.preview && getPackReadiness(pack).playable &&
    state.visited.length === pack.baseScreenCount && Object.keys(state.outcomes).length === graded && (!pack.retryPolicy || retry.complete);
  return { correct, graded, percent: complete && graded ? Math.round(correct / graded * 100) : null, completionEligible: complete,
    ...(pack.retryPolicy ? { retry } : {}) };
}
// Separate reporting only: thresholds never change core completion or saved result shape.
export function getPassOutcome(pack: LessonContentPack, result: ReturnType<typeof getLessonResult>): boolean | null {
  return pack.passPolicy?.kind === 'accuracy_threshold' && result.completionEligible && result.graded > 0
    ? result.correct / result.graded * 100 >= pack.passPolicy.minimumPercent : null;
}
export function transitionLesson(pack: LessonContentPack, state: LessonState, action: LessonAction): LessonState {
  if (action.type === 'exit') return { ...state, phase: 'exit', completionEligible: false };
  if (action.type === 'start' || action.type === 'start_preview') {
    if (state.phase !== 'launch') return state;
    const readiness = getPackReadiness(pack);
    if (action.type === 'start' && !readiness.playable) return state;
    if (!readiness.sequenceComplete) return state;
    return enter(pack, { ...state, preview: action.type === 'start_preview' }, 0);
  }
  const screen = pack.screens[state.index];
  if (!screen || !('screenId' in action) || action.screenId !== screen.screenId || !['presentation', 'response', 'feedback'].includes(state.phase)) return state;
  if (action.type === 'audio_ready') return { ...state, audioReady: true };
  if (action.type === 'continue' || action.type === 'preview_skip') {
    if (action.type === 'preview_skip' ? !state.preview : !canContinue(pack, state)) return state;
    let next = { ...state, visited: [...new Set([...state.visited, state.index])] };
    if (state.retry) {
      const position = state.retry.position + 1;
      if (position < state.retry.queue.length) return enter(pack, { ...next, retry: { ...state.retry, position } }, state.retry.queue[position]);
      if (state.retry.returnIndex !== undefined) {
        next = { ...next, retryOutcomes: { ...state.retryOutcomes, ...state.retry.outcomes } };
        delete next.retry;
        if (state.retry.returnIndex < pack.screens.length) return enter(pack, next, state.retry.returnIndex);
      }
    } else {
      if (pack.retryPolicy?.kind === 'after_activity_once' && !state.preview &&
        screen.screenId.split('.S')[0] !== pack.screens[state.index + 1]?.screenId.split('.S')[0]) {
        const queue = retryQueue(pack, state).filter(i => pack.screens[i].screenId.split('.S')[0] === screen.screenId.split('.S')[0] && !state.retryOutcomes?.[i]);
        if (queue.length) return enter(pack, { ...next, retry: { queue, position: 0, outcomes: {}, returnIndex: state.index + 1 } }, queue[0]);
      }
      if (state.index + 1 < pack.screens.length) return enter(pack, next, state.index + 1);
      const queue = state.preview || pack.retryPolicy?.kind !== 'end_once' ? [] : retryQueue(pack, state);
      if (queue.length) return enter(pack, { ...next, retry: { queue, position: 0, outcomes: {} } }, queue[0]);
    }
    const result = { ...next, phase: 'result' as const };
    return { ...result, completionEligible: getLessonResult(pack, result).completionEligible };
  }
  if (state.phase !== 'response' || getScreenContentGaps(screen).length) return state;
  const answer = screen.answer;
  if (action.type === 'typed_draft' && answer?.kind === 'typed' && validTypedDraft(action.text)) return { ...state, typedDraft: action.text };
  if (action.type === 'typed_check' && answer?.kind === 'typed' && canCheckTyped(state.typedDraft ?? '', false)) {
    return grade(state, answer.acceptedForms.some(form => normalizeTyped(form) === normalizeTyped(state.typedDraft!)));
  }
  if (action.type === 'truth' && answer?.kind === 'truth' && typeof action.value === 'boolean') {
    return grade({ ...state, selectedChoice: action.value }, action.value === answer.accepted);
  }
  if (action.type === 'choice' && answer?.kind === 'choice' && answer.options.some(o => o.id === action.id)) {
    return grade({ ...state, selectedChoice: action.id }, answer.acceptedOptionIds.includes(action.id));
  }
  if (action.type === 'toggle_option' && answer?.kind === 'multi_choice' && answer.options.some(o => o.id === action.id)) {
    const ids = state.selectedOptionIds ?? [];
    if (ids.includes(action.id)) return { ...state, selectedOptionIds: ids.filter(id => id !== action.id) };
    if (ids.length < answer.requiredCount) return { ...state, selectedOptionIds: [...ids, action.id] };
  }
  if (action.type === 'selection_check' && answer?.kind === 'multi_choice' && state.selectedOptionIds?.length === answer.requiredCount) {
    return grade(state, state.selectedOptionIds.every(id => answer.acceptedOptionIds.includes(id)));
  }
  if (action.type === 'remove_token' && (answer?.kind === 'ordered_slots' || answer?.kind === 'ordered_tokens') && Number.isInteger(action.slot) && action.slot >= 0 && action.slot < state.slots.length) {
    return { ...state, slots: state.slots.map((id, i) => i === action.slot ? null : id) };
  }
  if (action.type === 'token' && (answer?.kind === 'ordered_slots' || answer?.kind === 'ordered_tokens') && answer.tokens.some(t => t.id === action.id) && !state.slots.includes(action.id)) {
    const empty = state.slots.indexOf(null);
    if (empty === -1) return state;
    const slots = state.slots.map((id, i) => i === empty ? action.id : id);
    const next = { ...state, slots };
    return slots.includes(null) ? next : grade(next, answer.kind === 'ordered_slots'
      ? slots.every((id, i) => answer.slots[i].acceptedTokenIds.includes(id!))
      : answer.acceptedOrders.some(order => order.every((id, i) => slots[i] === id)));
  }
  if (action.type === 'pair' && answer?.kind === 'pairs') {
    const items = action.side === 'left' ? screen.left : screen.right;
    if (!items?.some(item => item.id === action.id) || answer.pairs.some(p => state.matches.includes(p.id) && (action.side === 'left' ? p.leftId : p.rightId) === action.id)) return state;
    const endpoint = { side: action.side, id: action.id };
    if (!state.endpoint || state.endpoint.side === action.side) return { ...state, endpoint: state.endpoint?.id === action.id ? null : endpoint, notice: '' };
    const leftId = action.side === 'left' ? action.id : state.endpoint.id;
    const rightId = action.side === 'right' ? action.id : state.endpoint.id;
    const pair = answer.pairs.find(p => p.leftId === leftId && p.rightId === rightId);
    if (!pair) return { ...state, endpoint: null, pairMistake: true, notice: 'Those do not match. Choose another pair.' };
    const next = { ...state, endpoint: null, notice: '', matches: [...state.matches, pair.id] };
    return next.matches.length === answer.pairs.length ? grade(next, !state.pairMistake) : next;
  }
  return state;
}
