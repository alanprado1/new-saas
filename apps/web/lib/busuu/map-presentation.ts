// Presentation-only mapping from inventory entries to what the course map shows.
// Raw evidence (inventory.json, b2-structure.json) is never edited: titles, subtitles and objectives are derived here.
import type { CourseEntry, CourseLevelId } from './types';

export type EntryVariant = 'lesson' | 'kanji' | 'fluency' | 'checkpoint' | 'certificate';
export type EntryView = {
  id: string; variant: EntryVariant; title: string; subtitle: string; objective: string;
  /** First kanji for the kanji avatar. */
  glyph: string | null;
  /** Mode tag for the popover. Derived from the entry type. Duration is shown only when real data exists (it does not today). */
  modeTag: string | null; durationTag: string | null;
  /** Whether a learner can start this lesson (reviewed content, runner and audio ready). */
  ready: boolean;
};

const KANJI_LABEL = /^Kanji:\s*(.+)$/;
const KANJI_KEY = /^K\[(.+)\]$/;
const FLUENCY_KEY = /^F:\s*(.+)$/;

function sentence(text: string | null | undefined) {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}
function cleanObjective(text: string | null | undefined) {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  // Retained evidence sometimes holds semicolon-joined research notes; those are not learner copy.
  if (!t || t.includes(';') || t.length > 140) return '';
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

export function describeEntry(entry: CourseEntry, options: { curriculumObjective?: string | null; ready?: boolean } = {}): EntryView {
  const label = entry.sourceLabel.value, mapped = entry.mappedObjective.value;
  const base = { id: entry.id, glyph: null as string | null, durationTag: null, ready: options.ready ?? false };
  if (entry.kind === 'checkpoint') {
    const subtitle = 'Test your skills to access the next chapter';
    return { ...base, variant: 'checkpoint', title: 'Checkpoint', subtitle, objective: subtitle, modeTag: 'CHECKPOINT' };
  }
  if (entry.kind === 'certificate_entry') {
    return { ...base, variant: 'certificate', title: label ?? 'Level certificate', subtitle: 'Level assessment', objective: 'Complete the level assessment.', modeTag: null };
  }
  const kanjiBody = label?.match(KANJI_LABEL)?.[1] ?? mapped?.match(KANJI_KEY)?.[1] ?? null;
  if (kanjiBody) {
    const kanji = kanjiBody.split(/\s+/).filter(Boolean);
    const subtitle = `Learn ${kanji.length} new kanji`;
    return { ...base, variant: 'kanji', title: `Kanji: ${kanji.join(' ')}`, subtitle, objective: `${subtitle}.`, glyph: kanji[0] ?? null, modeTag: 'KANJI' };
  }
  // Prefer the retained source wording ("Developing fluency — lists"); fall back to the inventory key ("F: lists").
  const fluencyTopic = entry.recordedSourceLabel?.split(/\s[—–-]\s/)[1]?.trim() || mapped?.match(FLUENCY_KEY)?.[1]?.trim() || null;
  if (label === 'Developing fluency' || (!label && mapped && FLUENCY_KEY.test(mapped))) {
    const subtitle = fluencyTopic ? `Practise ${fluencyTopic}` : 'Practise what you have learned';
    return { ...base, variant: 'fluency', title: 'Developing fluency', subtitle, objective: `${subtitle}.`, modeTag: 'FLUENCY' };
  }
  const title = label ?? (sentence(mapped) || 'Lesson');
  const subtitleSource = label ? sentence(mapped) : '';
  const subtitle = subtitleSource.toLowerCase() === title.toLowerCase() ? '' : subtitleSource;
  return { ...base, variant: 'lesson', title, subtitle,
    objective: cleanObjective(options.curriculumObjective) || (subtitle ? `${subtitle}.` : ''), modeTag: 'MIXED' };
}

export function getMapHref(level: CourseLevelId, chapterId?: string) {
  return chapterId ? `/busuu/${level}#${encodeURIComponent(chapterId)}` : `/busuu/${level}`;
}
export function getLessonHref(level: CourseLevelId, recordId: string, restart = false) {
  return `/busuu/${level}/lesson/${recordId}${restart ? '?restart=1' : ''}`;
}
