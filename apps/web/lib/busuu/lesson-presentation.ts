// Pure presentation helpers for the shared lesson runner. Nothing here changes grading, events or saved state: it only decides what
// the learner sees (progress per activity, feedback headings, which support blocks are not repeated, Japanese run markup).
import { getVisibleSupport, type LessonState } from './runner';
import type { LessonContentPack, LessonContentScreen, SupportBlock } from './types';

export const activityKey = (screen: LessonContentScreen) => screen.screenId.split('.S')[0];

/** Support blocks the learner sees before answering. Kanji screens show their examples in the model, so the joined support copies are dropped. */
export function getPreAnswerSupport(screen: LessonContentScreen): SupportBlock[] {
  if (screen.sceneContext) return [];
  return getVisibleSupport(screen, 'response').filter(block =>
    (screen.renderer !== 'dialogue' || screen.dialogue?.translationVisible !== false || block.kind !== 'translation') &&
    !(screen.renderer === 'kanji' && screen.kanji && block.kind !== 'explanation'));
}
const blockKey = (block: SupportBlock) => `${block.kind}|${block.text}|${block.secondary ?? ''}`;
/** Post-answer support (the feedback sheet): the retained `after` blocks, without anything already visible before answering or shown twice. */
export function getFeedbackSupport(screen: LessonContentScreen): SupportBlock[] {
  const seen = new Set(getPreAnswerSupport(screen).map(blockKey));
  return screen.support.after.filter(block => { const key = blockKey(block); return !seen.has(key) && seen.add(key); });
}

const CORRECT_HEADINGS = ['Well done!', 'Nice work', 'You got it', 'Amazing work!', 'You’re improving'] as const;
const WRONG_HEADINGS = ['Not quite', 'So close', 'Nearly there', 'Keep going'] as const;
export const FEEDBACK_HEADINGS = { correct: CORRECT_HEADINGS, wrong: WRONG_HEADINGS };
/** Varies by screen but is stable for a given screen (no server/client mismatch, no change on re-render). */
export function getFeedbackHeading(correct: boolean, seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const set = correct ? CORRECT_HEADINGS : WRONG_HEADINGS;
  return set[hash % set.length];
}

/** Progress for the current canonical activity, including its boundary retries. Presentation only: counters in state are untouched. */
export function getActivityProgress(pack: LessonContentPack, state: LessonState) {
  const screen = pack.screens[state.index];
  if (!screen) return { value: 0, max: 1 };
  // Like Busuu, the bar counts the screen the learner is on (screen 1 of 7 shows 1/7), not only answered screens.
  const answered = 1;
  if (state.retry && state.retry.returnIndex === undefined) { // end-of-lesson retry pass: its own bar
    const max = Math.max(1, state.retry.queue.length);
    return { value: Math.min(max, state.retry.position + answered), max };
  }
  const key = activityKey(screen);
  const members = pack.screens.flatMap((s, i) => activityKey(s) === key ? [i] : []);
  if (state.retry) {
    const max = members.length + state.retry.queue.length;
    return { value: Math.min(max, members.length + state.retry.position + answered), max };
  }
  const retryIds = pack.retryPolicy?.kind === 'after_activity_once' ? pack.retryPolicy.screenIds : [];
  const misses = members.filter(i => retryIds.includes(pack.screens[i].screenId) && state.outcomes[i]?.correct === false).length;
  const done = members.filter(i => state.visited.includes(i)).length + (state.visited.includes(state.index) ? 0 : answered);
  const max = members.length + misses;
  return { value: Math.min(max, done), max };
}

export const isCheckpointPack = (pack: LessonContentPack) => /\.CP$/.test(pack.recordId);

// Japanese runs (kana, kanji, full-width punctuation) so mixed English/Japanese copy can be marked up with lang="ja".
const JAPANESE_RUN = /[　-ヿ㐀-䶿一-鿿＀-￯]+/g;
export function splitJapaneseRuns(text: string): { text: string; ja: boolean }[] {
  const out: { text: string; ja: boolean }[] = []; let last = 0;
  for (const match of text.matchAll(JAPANESE_RUN)) {
    if (match.index > last) out.push({ text: text.slice(last, match.index), ja: false });
    out.push({ text: match[0], ja: true }); last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), ja: false });
  return out;
}

/** The answer text to emphasise in the corrected sentence, only where the answer data names it exactly. */
export function getFeedbackTargets(screen: LessonContentScreen): string[] {
  const answer = screen.answer;
  if (answer?.kind === 'ordered_slots') return answer.slots.flatMap(slot => answer.tokens.filter(t => t.id === slot.acceptedTokenIds[0]).map(t => t.text));
  if (answer?.kind === 'typed') return answer.acceptedForms;
  if (answer?.kind === 'choice') return answer.options.filter(o => answer.acceptedOptionIds.includes(o.id)).map(o => o.text);
  return [];
}
export function highlightSegments(text: string, targets: string[]): { text: string; mark: boolean }[] {
  const ranges: [number, number][] = []; let from = 0;
  for (const target of targets) {
    if (!target) continue;
    const at = text.indexOf(target, from);
    if (at >= 0) { ranges.push([at, at + target.length]); from = at + target.length; }
  }
  if (!ranges.length) return [{ text, mark: false }];
  const out: { text: string; mark: boolean }[] = []; let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) out.push({ text: text.slice(cursor, start), mark: false });
    out.push({ text: text.slice(start, end), mark: true }); cursor = end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), mark: false });
  return out;
}

/** Splits scaffold text so a gap never separates from the characters touching it (no line break inside a word at a gap). */
export function groupScaffold(parts: string[], gapCount: number) {
  const chars = parts.map(part => Array.from(part));
  const lead = chars.map((c, i) => i > 0 && i <= gapCount && c.length ? c[0] : '');
  const trail = chars.map((c, i) => i < gapCount && c.length > (lead[i] ? 1 : 0) ? c[c.length - 1] : '');
  const middle = chars.map((c, i) => c.slice(lead[i] ? 1 : 0, c.length - (trail[i] ? 1 : 0)).join(''));
  return { lead, trail, middle };
}

export type KeyEventLike = {
  key: string; keyCode?: number; isComposing?: boolean; repeat?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean;
  defaultPrevented?: boolean; target?: unknown; preventDefault?: () => void;
};
type Clickable = { click(): void };
/**
 * Enter = the visible primary action (Check or Continue) anywhere on the page; 1-9 pick the numbered option, tile, chip or pair item.
 * Native controls keep their own Enter, text fields keep their digits, and IME composition (isComposing / keyCode 229) never triggers anything.
 */
export function handleLessonKey(event: KeyEventLike, root: { querySelector(selector: string): Clickable | null }): boolean {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return false;
  const target = event.target as { isContentEditable?: boolean; tagName?: string; closest?: (selector: string) => unknown } | null | undefined;
  const editing = Boolean(target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName ?? '')));
  if (event.key === 'Enter') {
    if (editing || target?.closest?.('button, a, summary')) return false;
    const action = root.querySelector('[data-primary-action]:not(:disabled)');
    if (!action) return false;
    event.preventDefault?.(); action.click(); return true;
  }
  if (/^[1-9]$/.test(event.key) && !editing) {
    const choice = root.querySelector(`[data-shortcut="${event.key}"]:not(:disabled)`);
    if (!choice) return false;
    choice.click(); return true;
  }
  return false;
}
