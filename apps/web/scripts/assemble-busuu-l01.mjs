// Offline transcription of retained L01 screenshots. No live capture or media extraction.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '../../..');
const evidenceRoot = 'planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01';
const capturePath = `${evidenceRoot}/B2-C01-L01-Evidence.json`;
const hash = file => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const ref = (n, state) => {
  const imagePath = `${evidenceRoot}/Desktop-State-Evidence/B2.C01.L01.A01.S${String(n).padStart(2, '0')}--${state}.jpg`;
  return { sourceId: `L01-S${n}-${state}`, packagedPath: imagePath, sourceHash: hash(imagePath), jsonPointerOrHeading: `visible ${state} text and controls`, classification: 'O' };
};
const jp = (text, secondary) => ({ kind: 'japanese', text, ...(secondary ? { secondary } : {}) });
const en = text => ({ kind: 'translation', text });
const explain = text => ({ kind: 'explanation', text });
const token = (id, text) => ({ id, text });
const slots = (accepted, tokens) => ({ kind: 'ordered_slots', slots: accepted.map((id, i) => ({ id: `gap-${i + 1}`, acceptedTokenIds: [id] })), tokens });
const s04 = '初めまして、村田真一と申します。京都からまいりました。';
const s05 = 'バルセロナからまいりました。';
const s06 = '初めまして。スミスと申します。アメリカのシカゴからまいりました。';
const screens = [
  {
    renderer: 'model', prompt: 'Look, something new!', answer: null, praise: null, visual: 'video',
    support: { before: [jp('私は山口ともうします。', '私は山口と申します。'), en('My name is Yamaguchi.')], after: [] },
    audio: { required: true, text: '私は山口ともうします。' }, states: ['model'],
  },
  {
    renderer: 'truth', prompt: 'True or false?', statement: 'The woman introduced herself formally.',
    answer: { kind: 'truth', accepted: true }, praise: 'Awesome!', visual: 'image',
    support: { before: [jp('私（わたくし）は田中と申します。よろしくお願いいたします。')],
      after: [explain('When we introduce ourselves formally, we say: (name)と申します。よろしくお願いいたします。')] },
    audio: { required: true, text: 'わたくしは田中と申します。よろしくお願いいたします。' }, states: ['before-answer', 'correct-feedback'],
  },
  {
    renderer: 'pairs', prompt: 'Match the self-introductions and the types of language used.', praise: 'You got it', visual: 'none',
    left: [token('left-1', 'おれは本田。よろしく。'), token('left-2', '私は本田です。よろしくお願いします。'), token('left-3', '私は本田と申します。よろしくお願いいたします。')].map((t, i) => ({ ...t, secondary: ['俺は本田。よろしく。', '私は本田です。よろしくお願いします。', '私は本田と申します。よろしくお願い致します。'][i] })),
    right: [token('right-1', 'extra polite and humble'), token('right-2', 'casual'), token('right-3', 'polite')],
    answer: { kind: 'pairs', pairs: [ { id: 'pair-1', leftId: 'left-1', rightId: 'right-2' }, { id: 'pair-2', leftId: 'left-2', rightId: 'right-3' }, { id: 'pair-3', leftId: 'left-3', rightId: 'right-1' } ] },
    support: { before: [], after: [explain('The extra polite and humble way of saying 私 / わたし is 私 / わたくし, and we use it in professional settings.')] },
    audio: { required: false, text: null }, states: ['before-answer', 'feedback-settled'],
  },
  {
    renderer: 'gaps', prompt: 'Complete the sentences.', scaffold: ['初めまして、村田真一と申します。京都から', 'ました。'],
    answer: slots(['token-1'], [token('token-1', 'まいり'), token('token-2', '来た')]), praise: 'Amazing work!', visual: 'video',
    support: { before: [], after: [jp(s04), en("Nice to meet you. My name is Shinichi Murata. I'm from Kyoto."), explain('まいる is the humble language of 来る (to come). ました is the past tense.')] },
    audio: { required: true, text: s04, feedbackText: s04 }, states: ['before-answer', 'correct-feedback'],
  },
  {
    renderer: 'choice', prompt: 'Select the humble way to say this sentence: バルセロナから来ました。',
    answer: { kind: 'choice', options: [ { id: 'choice-1', text: 'バルセロナから来た。', secondary: 'バルセロナから来た。' }, { id: 'choice-2', text: s05, secondary: 'バルセロナから参りました。' }, { id: 'choice-3', text: 'バルセロナから来てください。', secondary: 'バルセロナから来てください。' } ], acceptedOptionIds: ['choice-2'] },
    praise: "You're improving", visual: 'image',
    support: { before: [], after: [jp(s05), en("I'm from Barcelona."), explain('We change 来ました into まいりました to talk in a humble way.')] },
    audio: { required: true, text: 'バルセロナから来ました。', feedbackText: s05 }, states: ['before-answer', 'correct-feedback'],
  },
  {
    renderer: 'gaps', prompt: 'Complete the sentences using humble language.', scaffold: ['初めまして。スミスと', '。アメリカのシカゴから', '。'],
    answer: slots(['token-3', 'token-2'], [token('token-1', '来ました'), token('token-2', 'まいりました'), token('token-3', '申します'), token('token-4', '言います')]),
    praise: 'Great job!', visual: 'image',
    support: { before: [], after: [jp(s06), en("Nice to meet you. My name is Smith. I'm from Chicago, America."), explain('(place)からまいりました。 is a humble way to say where we are from.')] },
    audio: { required: true, text: s06, feedbackText: s06 }, states: ['before-answer', 'feedback-settled', 'first-gap-removed'],
  },
].map(({ states, ...s }, i) => ({ screenId: `B2.C01.L01.A01.S${String(i + 1).padStart(2, '0')}`, ...s,
  evidence: [ ...states.map(state => ref(i + 1, state)), { sourceId: 'LIVE-2026-10-03-B2-C01-L01', packagedPath: capturePath, sourceHash: hash(capturePath), jsonPointerOrHeading: `/screens/${i}`, classification: 'O' } ], unresolved: [] }));
const pack = {
  schemaVersion: '1.0', contentVersion: '1.0.0', recordId: 'B2.C01.L01', status: 'reviewed', baseScreenCount: 6,
  provenance: { origin: 'source_observation', note: 'Transcribed and visually reviewed from retained before-answer and feedback screenshots. Evidence applies to visible fields on each occurrence; local option IDs identify the transcribed fixed banks. Audio scripts are app adaptations of displayed Japanese, including the explicit わたくし reading; no original recordings or exact waveform/timing equivalence is claimed.' },
  policies: {
    assessment: 'App local assessment: five graded base screens, equal weight; the model is ungraded. No saved learner progress, rewards or source-account scores.',
    incorrectResponses: 'App choice, since wrong paths were not captured: choices and completed gaps lock and show the correction. Wrong pairs clear the selection and allow another pair; any mismatch makes that screen incorrect. No automatic retry or extra base screens.',
    audio: 'Japanese synthesis through the existing /api/tts options. Required source audio must start successfully before responses/Continue are enabled. Replay never adds a screen or attempt.',
    visuals: 'Replaceable neutral slots preserve video/image geometry. Original visual media are deferred and do not block completion.',
  },
  unresolvedSourceFacts: ['Original recordings, portraits and video are deferred.', 'Wrong-answer/retry policy, source score formula and millisecond transition timing were not observed; the app uses the explicit local policies above.', 'Raw source option IDs, shuffle rules and hidden accepted variants are unknown. The app uses local IDs and only the fully visible fixed answer configurations.'],
  screens,
};
fs.writeFileSync(path.join(root, 'apps/web/content/busuu/b2-c01-l01.v1.json'), JSON.stringify(pack, null, 2) + '\n');
console.log('Assembled reviewed L01 pack: six screens; retained sources unchanged.');
