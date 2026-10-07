import type { LessonContentPack, LessonContentScreen, ReadinessGap } from './types';
import { normalizeTyped, validTypedDraft } from './typed-input';
import { getDialogueContentGaps, getSceneContextGaps, type SceneContextResolver } from './scene-context';
import { getContentPack } from './content-registry';
import { hasRetainedFeedbackOmission, reproducesFeedbackSource } from './feedback-evidence';

export const RUNNER_RENDERERS = ['model', 'kanji', 'table', 'dialogue', 'truth', 'pairs', 'gaps', 'choice', 'multi_choice', 'ordering', 'typed'] as const;
export const isTeachingScreen = (s: LessonContentScreen) => ['model', 'kanji', 'table', 'dialogue'].includes(s.renderer);
export const allowsEnglishOnlyTeaching = (s: LessonContentScreen) => s.renderer === 'table' && s.answer === null &&
  s.sourceContract?.transcriptBeforeAnswer === false && s.sourceContract.translationBeforeAnswer === true;
const kanjiExamples = (s: LessonContentScreen) => s.renderer === 'kanji' && s.kanji?.examples.length ? s.kanji.examples : null;
/** Kanji screens play their example words (not the example sentences), e.g. "参る、参加". */
export const getAudioScript =(s: LessonContentScreen) => s.renderer === 'dialogue'
  ? s.dialogue?.turns.length && s.dialogue.turns.every(t => text(t.japanese)) ? s.dialogue.turns.map(t => t.japanese).join('\n') : null
  : kanjiExamples(s) ? kanjiExamples(s)!.map(e => e.word).join('、') : s.audio.text;
/** TTS pronunciation reading for the screen's source audio; kanji screens use the example word readings, e.g. "まいる、さんか". */
export const getAudioReading = (s: LessonContentScreen) => kanjiExamples(s) ? kanjiExamples(s)!.map(e => e.reading).join('、') : s.audio.reading;
export function getSceneReuse(pack: LessonContentPack, screen: LessonContentScreen) {
  const index = pack.screens.findIndex(s => s.screenId === screen.screenId);
  return pack.screens.slice(0, Math.max(0, index)).find(s => s.screenId === screen.sourceContract?.sceneReuse && s.renderer === 'dialogue') ?? null;
}
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const unique = (ids: string[]) => ids.every(text) && new Set(ids).size === ids.length;

export function getScreenContentGaps(s: LessonContentScreen): ReadinessGap[] {
  const gaps: ReadinessGap[] = [];
  const gap = (field: string, reason: string) => gaps.push({ screenId: s.screenId, field, reason });
  if (!text(s.prompt)) gap('prompt', 'The complete instruction is missing.');
  if (s.sceneContext && (s.renderer !== 'choice' || s.support.before.length || s.audio.required || s.audio.text !== null || s.audio.feedbackText || s.dialogue || s.hint || s.sourceContract?.sceneReuse)) {
    gap('sceneContext.presentation', 'A delayed scene question must keep source support, transcript, hint and all replay/player audio absent.');
  }
  if (s.fixedPrefix !== undefined && (s.renderer !== 'ordering' || !text(s.fixedPrefix))) gap('fixedPrefix', 'A fixed start belongs to sentence ordering and must contain text.');
  const recap = s.sourceContract?.transcriptAccess === 'scene_recap' && s.sourceContract.transcriptBeforeAnswer === true && Boolean(s.sourceContract.sceneReuse);
  if (s.sourceContract?.transcriptAccess && !recap) gap('transcriptAccess', 'Optional recap requires recorded Japanese access and a bound earlier scene.');
  if (s.sourceContract?.feedbackTranscriptResolution && !hasRetainedFeedbackOmission(s)) gap('feedbackTranscriptResolution', 'Cue-only feedback requires explicit omission prose bound to this retained listening occurrence.');
  if (s.sourceContract?.feedbackTranscript && (s.sourceContract.feedbackTranscript !== 'omitted' || (s.sourceContract.recordedSupport.transcript_in_feedback !== false && !hasRetainedFeedbackOmission(s)) ||
    s.audio.feedbackText || reproducesFeedbackSource(s))) gap('feedbackTranscript', 'Omitted feedback transcript must be documented and must not reproduce or replay the complete source.');
  if (s.sourceContract?.transcriptBeforeAnswer === false && s.support.before.length &&
    !(allowsEnglishOnlyTeaching(s) && s.support.before.every(b => b.kind !== 'japanese' && !b.secondary))) gap('support.before', 'Transcript-free listening must not expose script or translation before answering.');
  if (s.sourceContract?.transcriptBeforeAnswer === true && !s.support.before.some(b => b.kind === 'japanese' && text(b.text)) &&
    !recap && !(s.renderer === 'dialogue' && s.dialogue?.japaneseVisible && s.dialogue.turns.length && s.dialogue.turns.every(t => text(t.japanese)))) gap('support.japanese', 'The recorded visible Japanese support is missing.');
  if (s.renderer === 'dialogue' && s.dialogue?.translationVisible === false && s.support.before.some(b => b.kind === 'translation')) gap('support.translation', 'Japanese-only dialogue must not include a pre-answer translation layer.');
  if (s.sourceContract?.translationBeforeAnswer === true && s.renderer !== 'dialogue' && !s.support.before.some(b => b.kind === 'translation' && text(b.text))) gap('support.english', 'The recorded visible English support is missing.');
  if (s.sourceContract?.parallelReadingBeforeAnswer && !s.support.before.some(b => b.kind === 'japanese' && text(b.secondary))) gap('support.reading', 'The recorded parallel Japanese script/reading is missing.');
  if (s.sourceContract?.hintBeforeAnswer && !text(s.hint?.text)) gap('hint.text', 'The recorded pre-answer hint is missing.');
  if (s.sourceContract?.sceneReuse && !s.sourceContract.sceneReuse.startsWith(`${s.screenId.split('.A')[0]}.`)) gap('sceneReuse', 'Scene reuse must belong to the same lesson.');
  if (!s.support || !Array.isArray(s.support.before) || !Array.isArray(s.support.after) ||
    [...s.support.before, ...s.support.after].some(b => !text(b.text) || (b.secondary !== undefined && !text(b.secondary)))) {
    gap('support', 'A required support layer is missing.');
  }
  if (isTeachingScreen(s)) {
    if (s.renderer === 'kanji') {
      const k = s.kanji;
      if (!k || !/^\p{Script=Han}$/u.test(k.character) || !text(k.shapeNote) || !text(k.meaning) || !k.readings.length ||
        !k.readings.every(r => text(r.text) && text(r.note)) || !k.examples.length ||
        !k.examples.every(e => [e.word, e.reading, e.meaning, e.sentence, e.sentenceReading, e.translation].every(text))) gap('kanji', 'Complete shape, readings, meaning and contextual examples are required.');
    }
    if (s.renderer === 'model' && !s.support?.before.some(b => b.kind === 'japanese' && text(b.text))) gap('model', 'The complete Japanese model is missing.');
    if (s.answer !== null) gap('answer_spec', 'Ungraded teaching cannot contain an answer key.');
    if (s.renderer === 'table') {
      const t = s.table;
      if (!t || !text(t.caption) || !t.columns.length || !t.columns.every(text) || !t.rows.length || !unique(t.rows.map(r => r.id)) ||
        !t.rows.every(r => r.cells.length === t.columns.length && r.cells.every(text))) gap('table', 'The complete table caption, headings and cells are required.');
    }
    if (s.renderer === 'dialogue') {
      gaps.push(...getDialogueContentGaps(s));
    }
  } else {
    if (!text(s.praise) || !s.support?.after.some(b => b.kind === 'explanation' && text(b.text))) gap('feedback', 'The feedback explanation is missing.');
    const a = s.answer;
    let valid = false;
    if (s.renderer === 'truth') {
      const audioOnly = s.truthMode === 'audio_only';
      if (!text(s.statement) || (audioOnly ? !s.audio.required || !text(s.audio.text) || s.sourceContract?.transcriptBeforeAnswer !== false ||
        s.support.before.length > 0 || (s.sourceContract?.feedbackTranscript !== 'omitted' &&
          (!s.support.after.some(b => b.kind === 'japanese' && b.text === s.audio.text) || !s.support.after.some(b => b.kind === 'translation' && text(b.text))))
        : !s.support?.before.some(b => b.kind === 'japanese' && text(b.text)))) gap('statement', 'The full judgment and supported source or explicit audio-only playback/feedback contract are required.');
      valid = a?.kind === 'truth' && typeof a.accepted === 'boolean';
    } else if (s.renderer === 'typed' && a?.kind === 'typed') {
      valid = a.normalization === 'nfkc_trim' && a.acceptedForms.length > 0 && a.acceptedForms.every(f => validTypedDraft(f) && text(normalizeTyped(f))) &&
        unique(a.acceptedForms.map(normalizeTyped)) && Boolean(s.typed && text(s.typed.label) && typeof s.typed.before === 'string' && typeof s.typed.after === 'string');
    } else if ((s.renderer === 'choice' && a?.kind === 'choice') || (s.renderer === 'multi_choice' && a?.kind === 'multi_choice')) {
      const ids = a.options.map(o => o.id);
      valid = ids.length >= 2 && unique(ids) && a.options.every(o => text(o.text) && (o.secondary === undefined || text(o.secondary))) &&
        a.acceptedOptionIds.length > 0 && unique(a.acceptedOptionIds) && a.acceptedOptionIds.every(id => ids.includes(id));
      if (a.kind === 'multi_choice') valid = valid && a.grading === 'exact_set' && Number.isInteger(a.requiredCount) &&
        a.requiredCount >= 2 && a.requiredCount < ids.length && a.acceptedOptionIds.length === a.requiredCount;
    } else if (s.renderer === 'pairs' && a?.kind === 'pairs') {
      const left = s.left ?? [], right = s.right ?? [];
      valid = left.length > 0 && left.length === right.length && left.length === a.pairs.length &&
        unique(left.map(p => p.id)) && unique(right.map(p => p.id)) && unique(a.pairs.map(p => p.id)) &&
        unique(a.pairs.map(p => p.leftId)) && unique(a.pairs.map(p => p.rightId)) &&
        [...left, ...right].every(p => text(p.text) && (p.secondary === undefined || text(p.secondary))) &&
        a.pairs.every(p => left.some(l => l.id === p.leftId) && right.some(r => r.id === p.rightId));
    } else if (s.renderer === 'ordering' && a?.kind === 'ordered_tokens') {
      const ids = a.tokens.map(t => t.id);
      valid = ids.length > 1 && unique(ids) && a.tokens.every(t => text(t.text)) && a.acceptedOrders.length > 0 &&
        a.acceptedOrders.every(order => order.length === ids.length && unique(order) && order.every(id => ids.includes(id)));
    } else if (s.renderer === 'gaps' && a?.kind === 'ordered_slots') {
      const ids = a.tokens.map(t => t.id);
      // Verify there is at least one feasible assignment without reusing a token.
      const assignable = (i: number, used: Set<string>): boolean => i === a.slots.length ||
        a.slots[i].acceptedTokenIds.some(id => !used.has(id) && assignable(i + 1, new Set([...used, id])));
      valid = a.slots.length > 0 && unique(a.slots.map(slot => slot.id)) && ids.length >= a.slots.length && unique(ids) &&
        a.tokens.every(t => text(t.text)) && s.scaffold?.length === a.slots.length + 1 && s.scaffold.every(part => typeof part === 'string') &&
        s.scaffold.some(text) && a.slots.every(slot => slot.acceptedTokenIds.length > 0 && unique(slot.acceptedTokenIds) && slot.acceptedTokenIds.every(id => ids.includes(id))) && assignable(0, new Set());
    }
    if (!valid) gap('answer_spec', 'The visible options, response slots or complete answer mapping are missing or invalid.');
    const count = s.sourceContract?.responseSlotCount;
    if (typeof count === 'number') {
      const actual = a?.kind === 'pairs' ? a.pairs.length : a?.kind === 'ordered_slots' ? a.slots.length : a?.kind === 'ordered_tokens' ? a.tokens.length : a?.kind === 'multi_choice' ? a.requiredCount : a ? 1 : 0;
      if (actual !== count) gap('response_slots', 'Response configuration differs from the recorded occurrence.');
    }
  }
  return [...gaps, ...s.unresolved.filter(g => !g.field.startsWith('audio'))];
}

export function getScreenAudioGaps(screen: LessonContentScreen): ReadinessGap[] {
  return [...(screen.audio.required && !text(getAudioScript(screen)) ? [{ screenId: screen.screenId, field: 'audio', reason: 'Required Japanese audio script is missing.' }] : []),
    ...(screen.audio.required && screen.audio.beforeAnswer === false ? [{ screenId: screen.screenId, field: 'audio.beforeAnswer', reason: 'Required playback cannot be disabled before answering.' }] : []),
    ...screen.unresolved.filter(g => g.field.startsWith('audio'))];
}

export function getPackReadiness(pack: LessonContentPack, resolveSceneContext?: SceneContextResolver) {
  let activity = 1, ordinal = 0;
  const canonicalOrder = pack.screens.every(screen => {
    const prefix = `${pack.recordId}.`;
    if (!screen.screenId.startsWith(prefix)) return false;
    const parts = /^A(\d{2})\.S(\d{2})$/.exec(screen.screenId.slice(prefix.length));
    if (!parts) return false;
    const nextActivity = Number(parts[1]), nextOrdinal = Number(parts[2]);
    if (nextActivity === activity && nextOrdinal === ordinal + 1) { ordinal = nextOrdinal; return true; }
    if (ordinal > 0 && nextActivity === activity + 1 && nextOrdinal === 1) { activity = nextActivity; ordinal = 1; return true; }
    return false;
  });
  const coreIds = pack.screens.map(s => s.screenId);
  const contract = pack.completion;
  const completionValid = pack.schemaVersion === '1.0' ? !contract : pack.schemaVersion === '1.1' && Boolean(contract &&
    contract.contractVersion === '1.0' && contract.requiredScreenIds.join('|') === coreIds.join('|') &&
    unique([...coreIds, ...contract.optionalSurfaces.map(s => s.screenId)]) && contract.optionalSurfaces.every((s, i) =>
      s.screenId === `${pack.recordId}.A01.S${String(coreIds.length + i + 1).padStart(2, '0')}` &&
      text(s.prompt) && text(s.hint) && text(s.purpose) && s.modes.length === 1 && s.modes[0] === 'write'));
  const passValid = !pack.passPolicy || pack.passPolicy.kind === 'none' || (pack.passPolicy.kind === 'accuracy_threshold' &&
    Number.isFinite(pack.passPolicy.minimumPercent) && pack.passPolicy.minimumPercent >= 0 && pack.passPolicy.minimumPercent <= 100);
  const sequenceComplete = completionValid && passValid && pack.baseScreenCount > 0 && pack.screens.length === pack.baseScreenCount &&
    canonicalOrder;
  const textGaps = [...pack.screens.flatMap(getScreenContentGaps), ...getSceneContextGaps(pack, resolveSceneContext ?? getContentPack)];
  const retryScreenValid = (id: string) => pack.screens.some(s => {
    const listening = ['truth', 'choice'].includes(s.renderer) && s.audio.required && s.sourceContract?.transcriptBeforeAnswer === false;
    const tokens = (s.renderer === 'gaps' && s.answer?.kind === 'ordered_slots') || (s.renderer === 'ordering' && s.answer?.kind === 'ordered_tokens');
    return s.screenId === id && s.answer !== null && (listening || (pack.retryPolicy?.kind === 'after_activity_once' && tokens));
  });
  if (pack.retryPolicy && (!['end_once', 'after_activity_once'].includes(pack.retryPolicy.kind) || !pack.retryPolicy.screenIds.length || !unique(pack.retryPolicy.screenIds) ||
    !pack.retryPolicy.screenIds.every(retryScreenValid))) {
    textGaps.push({ screenId: null, field: 'retryPolicy', reason: 'Retries require unique graded transcript-free listening screens; after-activity retries also allow validated gap/token tasks.' });
  }
  for (const screen of pack.screens) if (screen.sourceContract?.sceneReuse && !getSceneReuse(pack, screen)) {
    textGaps.push({ screenId: screen.screenId, field: 'sceneReuse', reason: 'Scene reuse must resolve to an existing earlier dialogue screen in this lesson.' });
  }
  for (const screen of pack.screens) if (screen.sourceContract?.transcriptAccess === 'scene_recap') {
    const scene = getSceneReuse(pack, screen);
    if (!scene?.dialogue?.japaneseVisible || scene.sourceContract?.transcriptBeforeAnswer === false || getDialogueContentGaps(scene).length)
      textGaps.push({ screenId: screen.screenId, field: 'transcriptAccess', reason: 'Optional recap must resolve to a complete visible earlier dialogue.' });
  }
  if (!sequenceComplete) textGaps.push({ screenId: null, field: 'sequence', reason: 'The complete canonical ordered lesson sequence is required.' });
  const audioGaps = pack.screens.flatMap(getScreenAudioGaps);
  const runnerAvailable = sequenceComplete && pack.screens.every(s => (RUNNER_RENDERERS as readonly string[]).includes(s.renderer));
  return { sequenceComplete, textGaps, audioGaps, runnerAvailable,
    playable: pack.status === 'reviewed' && textGaps.length === 0 && audioGaps.length === 0 && runnerAvailable };
}
