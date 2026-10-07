import type { LessonContentScreen, ScreenSpec } from './types';

export function reproducesFeedbackSource(screen: LessonContentScreen): boolean {
  const compact = (value: string) => value.normalize('NFKC').replace(/\s+/gu, '');
  const scripts = [screen.audio.text, screen.audio.reading].filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map(compact);
  return screen.support.after.some(block => [block.text, block.secondary].some(value =>
    typeof value === 'string' && scripts.some(script => compact(value).includes(script))));
}

// Nullable broad flags may be resolved only by explicit, bound occurrence prose.
// Raw source evidence and the released false-flag omission contract stay intact.
export function hasRetainedFeedbackOmission(screen: LessonContentScreen, source?: ScreenSpec): boolean {
  const c = screen.sourceContract, r = c?.feedbackTranscriptResolution;
  if (!c || !r || c.feedbackTranscript !== 'omitted' || c.recordedSupport.transcript_in_feedback !== null ||
    r.version !== '1.0' || r.kind !== 'retained_prose' || r.field !== 'rawFeedbackParaphrase' ||
    typeof r.quote !== 'string' || !/(?:^|[\s,;])(?:no|without) (?:full|complete) (?:(?:feedback|source) )?transcript\b/i.test(r.quote) ||
    !['truth', 'choice'].includes(screen.renderer) || (screen.renderer === 'truth' && screen.truthMode !== 'audio_only') ||
    c.transcriptBeforeAnswer !== false || !screen.audio.required || !r.evidence || r.evidence.classification !== 'O' ||
    !/^[a-f0-9]{64}$/.test(r.evidence.sourceHash)) return false;
  const matches = (e: typeof r.evidence) => e.sourceId === r.evidence.sourceId && e.packagedPath === r.evidence.packagedPath &&
    e.sourceHash === r.evidence.sourceHash && e.jsonPointerOrHeading === r.evidence.jsonPointerOrHeading && e.classification === r.evidence.classification;
  if (!screen.evidence.some(matches)) return false;
  return !source || (source.screenId === screen.screenId && source.rawSupport.transcript_in_feedback === null &&
    source.rawSupport.japanese_transcript_before_answer === false && source.rawFeedbackParaphrase === r.quote && source.evidence.some(matches));
}
