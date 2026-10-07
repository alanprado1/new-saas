import { getPackReadiness } from './content-readiness';
import { assertContentAlignment } from './content-registry';
import type { LessonSpec, ReadinessGap, ReadinessReport } from './types';

export function getLessonReadiness(spec: LessonSpec, capabilities = { audioAdapterAvailable: true, runnerEnabled: true }): ReadinessReport {
  const sourceSequenceComplete = spec.baseScreenCount !== null && spec.baseScreenCount > 0 &&
    spec.screens.length === spec.baseScreenCount && spec.activities.length > 0 &&
    spec.activities.every(a => a.baseScreenCount === a.screenIds.length) &&
    spec.activities.flatMap(a => a.screenIds).join('|') === spec.screens.map(s => s.screenId).join('|');
  const pack = spec.contentPack;
  const executable = pack ? getPackReadiness(pack) : null;
  let aligned = false;
  if (pack) { try { assertContentAlignment(pack, spec); aligned = true; } catch { /* Report alignment as a readiness gap. */ } }
  const authoredSequence = Boolean(pack?.structuralContract && aligned);
  const sequenceComplete = sourceSequenceComplete || authoredSequence;
  const textGaps: ReadinessGap[] = executable ? [...executable.textGaps] : spec.screens.flatMap(s => {
    const gaps: ReadinessGap[] = [];
    if (s.prompt.availability !== 'available' || !s.prompt.value) gaps.push({ screenId: s.screenId, field: 'prompt', reason: 'Complete question or instruction text is missing.' });
    if (s.modelOrScaffold.availability !== 'available' || !s.modelOrScaffold.value) gaps.push({ screenId: s.screenId, field: 'model_or_scaffold', reason: 'Complete Japanese models, scaffolds, readings and permitted support text are missing.' });
    if (s.submission.value !== 'continue_ungraded' && (s.answerSpec.availability !== 'available' || !s.answerSpec.value)) gaps.push({ screenId: s.screenId, field: 'answer_spec', reason: 'Complete options, slot or token identities and reviewed answer keys are missing.' });
    if (s.submission.value !== 'continue_ungraded' && (s.feedback.availability !== 'available' || !s.feedback.value)) gaps.push({ screenId: s.screenId, field: 'feedback', reason: 'Complete correction and explanation text is missing.' });
    return gaps;
  });
  if (!spec.screens.length && !authoredSequence) textGaps.push({ screenId: null, field: 'reviewed_content', reason: 'Executable lesson text and answer keys are not available.' });
  if (pack && !aligned) textGaps.push({ screenId: null, field: 'content_alignment', reason: 'The content pack does not match the recorded lesson sequence.' });
  const audioGaps: ReadinessGap[] = executable ? [...executable.audioGaps] : [{ screenId: null, field: 'audio', reason: 'Required Japanese audio scripts have not been assembled for the app TTS adapter.' }];
  if (pack?.screens.some(s => s.audio.required) && !capabilities.audioAdapterAvailable) audioGaps.push({ screenId: null, field: 'audio_adapter', reason: 'The required audio adapter is unavailable.' });
  const visualGaps: ReadinessGap[] = pack ? pack.screens.filter(s => s.visual !== 'none').map(s => ({ screenId: s.screenId, field: s.visual, reason: 'Original visuals are deferred; a replaceable neutral placeholder preserves their space.' })) :
    spec.screens.filter(s => s.liveObservation?.media.observed_modality === 'speaker_video').map(s => ({ screenId: s.screenId, field: 'video', reason: 'Original speaker video is deferred; a neutral visual placeholder preserves its layout.' }));
  const textComplete = textGaps.length === 0;
  const audioReady = audioGaps.length === 0;
  const runnerAvailable = Boolean(capabilities.runnerEnabled && executable?.runnerAvailable && aligned);
  return {
    structure: { navigationReady: true, lessonSequenceComplete: sequenceComplete, knownScreenRows: spec.screens.length, expectedBaseScreens: spec.baseScreenCount,
      ...(authoredSequence ? { authoredScreenRows: pack!.screens.length } : {}) },
    textAnswers: { complete: textComplete, gaps: textGaps },
    audio: { ready: audioReady, requiredScreens: pack?.screens.filter(s => s.audio.required).length ?? 0, gaps: audioGaps,
      delivery: 'Existing Japanese TTS options; generated on demand, cached for this account/session. Runtime loading and recovery are separate from content readiness.' },
    media: { ready: audioReady, visualsDeferred: true, gaps: [...audioGaps, ...visualGaps],
      replacementPolicy: 'App TTS audio replacements and replaceable neutral image/video placeholders.' },
    runnerAvailable,
    scoredLaunchReady: sequenceComplete && textComplete && audioReady && runnerAvailable && pack?.status === 'reviewed',
    previewAvailable: Boolean(capabilities.runnerEnabled && aligned && executable?.sequenceComplete),
  };
}
