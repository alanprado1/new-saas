import type { ReactNode } from 'react';
import { splitJapaneseRuns } from '@/lib/busuu/lesson-presentation';

/** Pack copy that mixes English and Japanese: marks each Japanese run with lang="ja" (assistive tech, font selection, line breaking). */
export function mixed(text: string): ReactNode {
  const runs = splitJapaneseRuns(text);
  if (!runs.some(run => run.ja)) return text;
  return runs.map((run, i) => run.ja ? <span key={i} lang="ja">{run.text}</span> : run.text);
}
