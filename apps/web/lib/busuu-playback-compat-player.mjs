import crypto from 'node:crypto';
import { loadCourseModule } from './busuu-test-helpers.mjs';

const attempt = () => loadCourseModule('lib/busuu/attempt.ts');
export const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Deterministic learner for any registered pack. `wrongEvery` makes every n-th graded screen (and its first retry) wrong; `withPlayback` adds
// the audio_ready event a pre-change client sent before answering required-audio screens.
function answerActions(screen, wrong) {
  const a = screen.answer, id = screen.screenId;
  if (!a) return [];
  if (a.kind === 'truth') return [{ type: 'truth', screenId: id, value: wrong ? !a.accepted : a.accepted }];
  if (a.kind === 'choice') return [{ type: 'choice', screenId: id, id: wrong ? a.options.find(o => !a.acceptedOptionIds.includes(o.id)).id : a.acceptedOptionIds[0] }];
  if (a.kind === 'multi_choice') {
    const ids = wrong ? [a.options.find(o => !a.acceptedOptionIds.includes(o.id)).id, ...a.acceptedOptionIds.slice(1)] : a.acceptedOptionIds;
    return [...ids.map(x => ({ type: 'toggle_option', screenId: id, id: x })), { type: 'selection_check', screenId: id }];
  }
  if (a.kind === 'typed') return [{ type: 'typed_draft', screenId: id, text: wrong ? 'x' : a.acceptedForms[0] }, { type: 'typed_check', screenId: id }];
  if (a.kind === 'ordered_slots') {
    const ids = a.slots.map(s => s.acceptedTokenIds[0]);
    if (wrong) { const other = a.tokens.find(t => !a.slots[0].acceptedTokenIds.includes(t.id)); if (other && !ids.includes(other.id)) ids[0] = other.id; }
    return ids.map(x => ({ type: 'token', screenId: id, id: x }));
  }
  if (a.kind === 'ordered_tokens') {
    const ids = [...a.acceptedOrders[0]]; if (wrong) ids.reverse();
    return ids.map(x => ({ type: 'token', screenId: id, id: x }));
  }
  if (a.kind === 'pairs') {
    const out = [];
    if (wrong && a.pairs.length > 1) out.push({ type: 'pair', screenId: id, side: 'left', id: a.pairs[0].leftId }, { type: 'pair', screenId: id, side: 'right', id: a.pairs[1].rightId });
    return [...out, ...a.pairs.flatMap(p => [{ type: 'pair', screenId: id, side: 'left', id: p.leftId }, { type: 'pair', screenId: id, side: 'right', id: p.rightId }])];
  }
  return [];
}
const isTeaching = s => ['model', 'kanji', 'table', 'dialogue'].includes(s.renderer);

/** Plays a whole lesson and returns { events, steps: [state sha per event], state, result }. */
export function playLesson(pack, { withPlayback, wrongEvery = 3 }) {
  const m = attempt();
  let state = m.initialAttemptState(pack), graded = 0;
  const events = [], steps = [];
  const send = action => { state = m.evaluateAction(pack, state, action); events.push(action); steps.push(sha(state)); };
  for (let guard = 0; state.phase !== 'result' && guard < 400; guard++) {
    const screen = pack.screens[state.index], id = screen.screenId;
    if (withPlayback && !state.audioReady) send({ type: 'audio_ready', screenId: id });
    if (!isTeaching(screen)) {
      graded++;
      const wrong = state.retry ? false : graded % wrongEvery === 0;
      for (const action of answerActions(screen, wrong)) send(action);
    }
    send({ type: 'continue', screenId: id });
  }
  if (state.phase !== 'result') throw new Error('lesson did not finish');
  return { events, steps, state, result: m.attemptResult(pack, state) };
}
export function replay(pack, events) {
  const m = attempt();
  let state = m.initialAttemptState(pack); const steps = [];
  for (const action of events) { state = m.evaluateAction(pack, state, action); steps.push(sha(state)); }
  return { steps, state, result: m.attemptResult(pack, state) };
}
