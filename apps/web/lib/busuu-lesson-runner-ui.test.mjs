import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from './busuu-test-helpers.mjs';
import { playLesson, replay, sha } from './busuu-playback-compat-player.mjs';

const css = new Proxy({}, { get: (_, key) => String(key) });
const overrides = { '@/app/busuu/runner.module.css': { __esModule: true, default: css } };
const registry = () => loadCourseModule('lib/busuu/content-registry.ts');
const runner = () => loadCourseModule('lib/busuu/runner.ts');
const present = () => loadCourseModule('lib/busuu/lesson-presentation.ts');
const fixture = JSON.parse(fs.readFileSync(new URL('./busuu-playback-compat.fixture.json', import.meta.url), 'utf8'));
const HEADINGS = /Well done!|Nice work|You got it|Amazing work!|You’re improving|Not quite|So close|Nearly there|Keep going/;
const walk = (v, out = []) => { if (!v || typeof v !== 'object') return out; out.push(v); for (const c of [v.props?.children].flat(Infinity)) walk(c, out); return out; };

// ---- compatibility: playback is optional, old attempts replay identically --------------------------------------------------------
test('attempts saved with playback events (fixtures recorded before the change) replay to identical states, results and fingerprints', () => {
  for (const [id, saved] of Object.entries(fixture)) {
    // a saved attempt resolves its exact recorded version, even after a newer text-polished version became current
    const pack = registry().getContentPack(id, saved.contentVersion);
    assert.equal(pack.contentVersion, saved.contentVersion, id);
    assert.equal(sha(pack), saved.packSha, `${id}: released content fingerprint unchanged`);
    assert.ok(saved.events.some(e => e.type === 'audio_ready'), `${id}: recorded stream contains playback events`);
    const out = replay(pack, saved.events);
    assert.deepEqual(out.steps, saved.steps, `${id}: every intermediate state identical`);
    assert.equal(sha(out.state), saved.finalStateSha, id);
    assert.deepEqual(out.result, saved.result, id);
  }
});
test('new attempts validate and finish without any playback event, with the same result as the legacy stream', () => {
  for (const [id, saved] of Object.entries(fixture)) {
    const pack = registry().getContentPack(id);
    const out = playLesson(pack, { withPlayback: false });
    assert.ok(!out.events.some(e => e.type === 'audio_ready'), id);
    assert.deepEqual(out.result, saved.result, `${id}: playback does not change grading`);
    assert.equal(out.state.phase, 'result');
  }
});
test('required-audio screens can be answered and continued without audio_ready, and a late audio_ready still validates', () => {
  const { transitionLesson, createLessonState, canContinue } = runner();
  const pack = registry().getContentPack('B2.C02.L01');
  let state = transitionLesson(pack, createLessonState(pack), { type: 'start' });
  assert.equal(state.audioReady, false);
  assert.equal(canContinue(pack, state), true, 'teaching Continue is enabled immediately');
  state = transitionLesson(pack, state, { type: 'continue', screenId: pack.screens[0].screenId });
  assert.equal(state.phase, 'response'); assert.equal(state.audioReady, false);
  state = transitionLesson(pack, state, { type: 'audio_ready', screenId: pack.screens[1].screenId });
  assert.equal(state.audioReady, true);
});
test('client session and server replay accept a no-playback stream and resume it', async () => {
  const attempt = loadCourseModule('lib/busuu/attempt.ts'), pack = registry().getContentPack('B2.C02.L01');
  const entries = new Map(), storage = { get length() { return entries.size; }, key: i => [...entries.keys()][i] ?? null, getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v), removeItem: k => entries.delete(k) };
  const hash = crypto.createHash('sha256').update(JSON.stringify(pack)).digest('hex');
  let saved = { id: 'a', user_id: 'u', record_id: pack.recordId, content_version: pack.contentVersion, content_hash: hash, revision: 0, active: true, completed_at: null, state: attempt.initialAttemptState(pack) };
  const transport = async (path, body, owner) => {
    if (path.includes('?attempt=')) { // the server: the same evaluateAction the API route uses
      const state = attempt.evaluateAction(pack, saved.state, body.action);
      saved = { ...saved, revision: body.sequence, state, result: attempt.attemptResult(pack, state) };
    }
    return { owner, attempt: structuredClone(saved) };
  };
  const Session = loadCourseModule('lib/busuu/attempt-client.ts').CourseAttemptSession;
  const s = new Session(pack, 'u', storage, transport, () => {}, 'w1'); await s.open();
  const first = pack.screens[0].screenId, second = pack.screens[1].screenId;
  s.dispatch({ type: 'continue', screenId: first });
  const answer = pack.screens[1].answer;
  const answers = answer.kind === 'truth' ? [{ type: 'truth', screenId: second, value: answer.accepted }] : answer.kind === 'choice' ? [{ type: 'choice', screenId: second, id: answer.acceptedOptionIds[0] }]
    : answer.slots.map(slot => ({ type: 'token', screenId: second, id: slot.acceptedTokenIds[0] }));
  for (const action of answers) s.dispatch(action);
  await s.retry();
  assert.equal(s.snapshot().pending, 0); assert.equal(saved.revision, 1 + answers.length); assert.equal(saved.state.phase, 'feedback');
  assert.equal(saved.state.audioReady, false); // never played, still accepted
  const resumed = new Session(pack, 'u', storage, transport, () => {}, 'w2'); await resumed.open();
  assert.equal(resumed.snapshot().state.index, saved.state.index);
});

// ---- grading triggers ------------------------------------------------------------------------------------------------------------
test('tapping a choice grades at once; the last required multi-select pick sends toggle_option then selection_check (same event shapes)', () => {
  const { transitionLesson } = runner();
  const Screen = loadCourseModule('components/busuu/LessonScreen.tsx', overrides).default;
  const initial = loadCourseModule('lib/busuu/attempt.ts').initialAttemptState;
  const pack = registry().getContentPack('B2.C09.L02');
  const index = pack.screens.findIndex(s => s.renderer === 'multi_choice'), screen = pack.screens[index];
  let state = { ...initial(pack), index, phase: 'response', audioReady: false, selectedOptionIds: [], slots: [] };
  const sent = [];
  const dispatch = action => { sent.push(action); state = transitionLesson(pack, state, action); };
  const buttons = () => walk(Screen({ screen, state, dispatch })).filter(n => n.type === 'button' && n.props['data-shortcut']);
  const ids = screen.answer.acceptedOptionIds;
  for (const [i, id] of ids.entries()) {
    assert.equal(state.phase, 'response');
    buttons().find(b => b.props['aria-keyshortcuts'] === String(screen.answer.options.findIndex(o => o.id === id) + 1)).props.onClick();
    if (i < ids.length - 1) assert.equal(state.phase, 'response');
  }
  assert.equal(state.phase, 'feedback'); assert.equal(state.outcomes[index].correct, true);
  assert.deepEqual(sent.map(a => a.type), [...ids.map(() => 'toggle_option'), 'selection_check']);
  for (const a of sent) assert.deepEqual(Object.keys(a).sort(), a.type === 'selection_check' ? ['screenId', 'type'] : ['id', 'screenId', 'type']);
  assert.ok(!walk(Screen({ screen, state: { ...state, phase: 'response' }, dispatch })).some(n => n.type === 'button' && /Check/.test(String(n.props.children))), 'no separate Check');

  const choicePack = registry().getContentPack('B2.C02.L01'), ci = choicePack.screens.findIndex(s => s.renderer === 'choice'), choice = choicePack.screens[ci];
  state = { ...initial(choicePack), index: ci, phase: 'response', slots: [] }; sent.length = 0;
  const pick = walk(Screen({ screen: choice, state, dispatch: a => { sent.push(a); state = transitionLesson(choicePack, state, a); } })).find(n => n.type === 'button' && n.props['aria-keyshortcuts'] === '1');
  pick.props.onClick();
  assert.deepEqual(sent, [{ type: 'choice', screenId: choice.screenId, id: choice.answer.options[0].id }]); assert.equal(state.phase, 'feedback');
});
test('Enter and number keys follow the visible action, skip editable fields and never act during IME composition', () => {
  const { handleLessonKey } = present();
  const clicks = [];
  const root = { querySelector: s => /data-primary-action/.test(s) ? { click: () => clicks.push('primary') } : /data-shortcut="2"/.test(s) ? { click: () => clicks.push('option2') } : null };
  const key = (k, extra = {}) => handleLessonKey({ key: k, target: { tagName: 'H1', closest: () => null }, preventDefault() {}, ...extra }, root);
  assert.equal(key('Enter'), true); assert.equal(key('2'), true); assert.equal(key('3'), false);
  assert.deepEqual(clicks, ['primary', 'option2']);
  for (const extra of [{ isComposing: true }, { keyCode: 229 }, { repeat: true }, { ctrlKey: true }, { defaultPrevented: true }]) assert.equal(key('Enter', extra), false);
  const input = { target: { tagName: 'INPUT', closest: () => null } };
  assert.equal(key('Enter', input), false); assert.equal(key('2', input), false);
  assert.equal(key('Enter', { target: { tagName: 'BUTTON', closest: () => ({}) } }), false, 'a focused button keeps its own Enter');
  assert.equal(clicks.length, 2);
});

// ---- progress, headings, support -------------------------------------------------------------------------------------------------
test('progress is per activity, resets at the next activity and fills through boundary retries', () => {
  const { getActivityProgress, activityKey } = present();
  const m = loadCourseModule('lib/busuu/attempt.ts');
  for (const id of ['B2.C09.L02', 'B2.C10.L06', 'B2.C04.CP']) {
    const pack = registry().getContentPack(id);
    let state = m.initialAttemptState(pack), last = null, resets = 0, sawRetry = false;
    const base = key => key.replace('retry:', '');
    const actions = [null, ...playLesson(pack, { withPlayback: false }).events];
    for (const action of actions) {
      if (action) state = m.evaluateAction(pack, state, action);
      if (!['presentation', 'response', 'feedback'].includes(state.phase)) continue;
      const p = getActivityProgress(pack, state), key = (state.retry ? 'retry:' : '') + activityKey(pack.screens[state.index]);
      assert.ok(p.value >= 0 && p.value <= p.max && p.max >= 1, `${id}: ${JSON.stringify(p)}`);
      if (!last) assert.equal(p.value, 1, `${id}: like Busuu, the first screen already counts on the bar`);
      if (state.retry) sawRetry = true;
      if (last && base(last.key) === base(key)) assert.ok(p.value >= last.value, `${id}: progress never goes backwards inside an activity`);
      else if (last) { resets++; assert.ok(p.value <= 1, `${id}: a new activity starts near empty`); }
      last = { key, value: p.value };
    }
    if (id === 'B2.C09.L02') assert.ok(sawRetry, 'retry exercised');
    if (pack.screens.some(s => activityKey(s) !== activityKey(pack.screens[0]))) assert.ok(resets > 0, `${id}: resets between activities`);
  }
});
test('feedback headings come from the fixed sets and are stable per screen', () => {
  const { getFeedbackHeading, FEEDBACK_HEADINGS } = present();
  for (const seed of ['a', 'b', 'B2.C02.L01.A01.S05:', 'x'.repeat(40)]) {
    assert.ok(FEEDBACK_HEADINGS.correct.includes(getFeedbackHeading(true, seed))); assert.ok(FEEDBACK_HEADINGS.wrong.includes(getFeedbackHeading(false, seed)));
    assert.equal(getFeedbackHeading(true, seed), getFeedbackHeading(true, seed));
  }
  assert.deepEqual([...FEEDBACK_HEADINGS.wrong], ['Not quite', 'So close', 'Nearly there', 'Keep going']);
  assert.equal(new Set(Array.from({ length: 60 }, (_, i) => getFeedbackHeading(true, `s${i}`))).size, 5);
});
test('support is not repeated in the post-answer view and kanji examples are not repeated as support blocks', () => {
  const { getFeedbackSupport, getPreAnswerSupport, splitJapaneseRuns } = present();
  let checked = 0, kanji = 0;
  for (const id of ['B2.C04.CP', 'B2.C04.L04', 'B2.C09.CP']) for (const s of registry().getContentPack(id).screens) {
    const key = b => `${b.kind}|${b.text}|${b.secondary ?? ''}`, keys = getFeedbackSupport(s).map(key);
    assert.equal(new Set(keys).size, keys.length, s.screenId);
    const before = new Set(getPreAnswerSupport(s).map(key));
    for (const k of keys) assert.ok(!before.has(k), `${s.screenId} repeats a pre-answer block`);
    if (s.renderer === 'kanji') { kanji++; assert.ok(getPreAnswerSupport(s).every(b => b.kind === 'explanation')); }
    checked++;
  }
  assert.ok(checked > 40 && kanji > 0);
  assert.deepEqual(splitJapaneseRuns('Use 食べる（たべる）and 飲む.').filter(r => r.ja).map(r => r.text), ['食べる（たべる）', '飲む']);
});

// ---- rendered runner -------------------------------------------------------------------------------------------------------------
// useState order in LessonRunner: 1 state, 2 save, 9 learner name, 11 leave-confirmation.
function renderRunner(pack, state, { preview = true, save = null, name = '', confirm = false } = {}) {
  let n = 0;
  const Runner = loadCourseModule('components/busuu/LessonRunner.tsx', { ...overrides, react: { ...React, useState(initial) {
    n++; return React.useState(n === 1 ? state : n === 2 ? save : n === 9 ? name : n === 11 ? confirm : initial); } } }).default;
  return renderToStaticMarkup(React.createElement(Runner, { pack, preview, title: 'Lesson title', returnHref: '/busuu/B2#c', onExit() {} }));
}
const feedbackState = (pack, index, correct) => ({ ...loadCourseModule('lib/busuu/attempt.ts').initialAttemptState(pack), index, phase: 'feedback', audioReady: false, outcomes: { [index]: { correct } }, visited: [], slots: [], selectedChoice: null, matches: [] });
test('the feedback sheet re-hosts the retained feedback with a random heading, the card, the explanation and Continue', () => {
  const pack = registry().getContentPack('B2.C04.CP');
  for (const correct of [true, false]) {
    const html = renderRunner(pack, feedbackState(pack, 0, correct));
    assert.match(html, HEADINGS); assert.doesNotMatch(html, /Review the answer/);
    assert.ok(html.includes('I will consider this plan'), 'English translation in the card');
    const text = html.replace(/<[^>]+>/g, ''), explanation = pack.screens[0].support.after.find(b => b.kind === 'explanation').text;
    assert.ok(text.includes(explanation.slice(0, 30)), 'explanation under the card');
    assert.match(html, />Replay corrected sentence</); assert.match(html, />Continue</); assert.match(html, /<mark/);
  }
});
test('the feedback sheet keeps cue-only and hidden-truth rules: no source before answering, none in feedback that omits it', () => {
  let omitted = 0, hidden = 0;
  for (const id of ['B2.C06.CP', 'B2.C07.CP', 'B2.C08.CP', 'B2.C09.CP', 'B2.C10.CP', 'B2.C04.CP']) {
    const pack = registry().getContentPack(id);
    pack.screens.forEach((s, index) => {
      if (s.sourceContract?.transcriptBeforeAnswer === false && s.audio.text) {
        hidden++;
        const before = renderRunner(pack, { ...feedbackState(pack, index, true), phase: 'response' });
        assert.ok(!before.includes(s.audio.text), `${s.screenId}: hidden source stays out of the DOM before answering`);
      }
      if (s.sourceContract?.feedbackTranscript === 'omitted' || !s.audio.feedbackText) {
        omitted++;
        const html = renderRunner(pack, feedbackState(pack, index, false));
        assert.doesNotMatch(html, /Replay corrected sentence/, s.screenId);
        if (s.sourceContract?.feedbackTranscript === 'omitted' && s.sourceContract.transcriptBeforeAnswer === false && s.audio.text) assert.ok(!html.includes(s.audio.text), `${s.screenId}: cue-only feedback omits the source`);
      }
    });
  }
  assert.ok(hidden > 0 && omitted > 0, `${hidden} hidden / ${omitted} omitted examples exercised`);
});
test('retried screens look like the originals: no retry banner or label', () => {
  const pack = registry().getContentPack('B2.C09.L02');
  const index = pack.screens.findIndex(s => s.renderer === 'truth' || s.renderer === 'choice');
  const state = { ...feedbackState(pack, index, true), phase: 'response', retry: { queue: [index], position: 0, outcomes: {}, returnIndex: index + 1 } };
  const html = renderRunner(pack, state);
  assert.doesNotMatch(html, /retry|Retry|once more|base screens|reviewed/);
  assert.match(html, /aria-label="Activity progress"/);
});
test('results screen: full page, Score card, Continue to the course map, Restart, no threshold wording; checkpoints say completed', () => {
  const save = { ready: true, status: 'saved', pending: 0, message: '', storageWarning: '', confirmed: null };
  for (const [id, heading] of [['B2.C02.L01', /Well done, Aiko!/], ['B2.C04.CP', /Checkpoint completed!/]]) {
    const pack = registry().getContentPack(id), done = playLesson(pack, { withPlayback: false });
    const html = renderRunner(pack, done.state, { preview: false, save: { ...save, state: done.state }, name: 'Aiko' });
    assert.match(html, heading); assert.match(html, />Score</); assert.match(html, new RegExp(`${done.result.percent}%`));
    assert.match(html, /href="\/busuu\/B2#c"[^>]*>Continue</); assert.match(html, />Restart lesson</);
    assert.doesNotMatch(html, /pass threshold|No pass|Lesson completion saved|server-confirmed|base screens|aria-label="Activity progress"|Exit lesson/i);
  }
  const pack = registry().getContentPack('B2.C02.L01');
  assert.doesNotMatch(renderRunner(pack, playLesson(pack, { withPlayback: false }).state, { preview: true }), />Restart lesson</);
});
test('a failed save is the only save message shown, with Retry save; normal saving is silent', () => {
  const pack = registry().getContentPack('B2.C02.L01');
  const state = { ...feedbackState(pack, 1, true), phase: 'response' };
  const base = { ready: true, pending: 2, storageWarning: '', confirmed: null, state };
  const quiet = renderRunner(pack, state, { preview: false, save: { ...base, status: 'saving', message: 'Saving your responses…' } });
  assert.doesNotMatch(quiet, /Saving|Saved to your account|changes pending/);
  const failed = renderRunner(pack, state, { preview: false, save: { ...base, status: 'error', message: 'Offline' } });
  assert.match(failed, /role="alert"/); assert.match(failed, /Offline/); assert.match(failed, />Retry save</);
});
test('leaving mid-lesson asks inside the runner before anything is disposed', () => {
  const pack = registry().getContentPack('B2.C02.L01');
  const state = { ...feedbackState(pack, 1, true), phase: 'response' };
  assert.doesNotMatch(renderRunner(pack, state), /Leave this lesson/);
  const html = renderRunner(pack, state, { confirm: true });
  assert.match(html, /role="dialog"/); assert.match(html, /Leave this lesson\?/); assert.match(html, /Your progress is saved\./);
  assert.match(html, />Keep practising</); assert.match(html, />Leave lesson</);
});
test('learner UI has no developer wording, and the palette lives in one place with a light-only shell', () => {
  const pack = registry().getContentPack('B2.C01.L03'), index = pack.screens.findIndex(s => s.renderer === 'dialogue');
  const save = { ready: true, status: 'saved', pending: 0, message: '', storageWarning: '', confirmed: null };
  const dialogue = renderRunner(pack, { ...feedbackState(pack, index, true), phase: 'presentation' }, { preview: false, save });
  assert.doesNotMatch(dialogue, /app TTS|replacement|Hotel scene|Static shape|Ungraded|Reuses the|Development preview|Visual placeholder/i);
  const cssText = fs.readFileSync(new URL('../app/busuu/runner.module.css', import.meta.url), 'utf8');
  assert.match(cssText, /color-scheme: light/); assert.match(cssText, /Noto Sans JP/); assert.match(cssText, /Hiragino Sans/);
  assert.match(cssText, /--c-primary: var\(--course-accent/);
});
