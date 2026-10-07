'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { CourseChapter, CourseEntry, CourseLevel } from '@/lib/busuu/types';
import EntryMarker from './EntryMarker';
import { describeEntry, getLessonHref, type EntryView } from '@/lib/busuu/map-presentation';
import { chapterCompletion, ringFraction, rowStatus, type CourseProgress, type InProgress, type RowStatus } from '@/lib/busuu/progress';
import styles from '@/app/busuu/busuu.module.css';

type RowView = EntryView & { screenCount?: number | null };
const STATUS_TEXT: Record<RowStatus, string> = { not_started: '', in_progress: 'In progress', completed: 'Completed' };

function Check({ size }: { size: number }) {
  return <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" /></svg>;
}

export function LessonPopover({ levelId, view, status, accuracy, id }: { levelId: CourseLevel['id']; view: RowView; status: RowStatus; accuracy: number | null; id: string }) {
  const tags = [view.modeTag, view.durationTag].filter(Boolean) as string[];
  const label = status === 'completed' ? 'Restart lesson' : status === 'in_progress' ? 'Continue lesson' : 'Start lesson';
  return <div id={id} className={styles.popover} role="group" aria-label={`${view.title} options`}>
    {tags.length > 0 && <ul className={styles.tags}>{tags.map(tag => <li key={tag} className={styles.tag}>{tag}</li>)}</ul>}
    <h3>{view.title}</h3>
    {view.objective && <p>{view.objective}</p>}
    {status === 'completed' && accuracy !== null && <p className={styles.popoverNote}>Accuracy {accuracy}%</p>}
    <div className={styles.popoverActions}>
      {view.ready
        ? <Link href={getLessonHref(levelId, view.id, status === 'completed')} className={styles.popoverButton}>{label}</Link>
        : <button type="button" className={styles.popoverButton} disabled>Coming soon</button>}
    </div>
  </div>;
}

export default function ChapterTimeline({ level, views = {}, selected, progress = {}, inProgress = {}, loading = false }: {
  level: CourseLevel; views?: Record<string, RowView>; selected?: string; progress?: CourseProgress; inProgress?: InProgress; loading?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(selected ?? null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => { if (!(event.target as Element | null)?.closest?.('[data-entry-open]')) setOpen(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null); };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape); };
  }, [open]);
  const viewOf = (entry: CourseEntry): RowView => views[entry.id] ?? describeEntry(entry);
  return <div className={styles.timeline} ref={root} aria-busy={loading || undefined}>
    {level.chapters.map((chapter: CourseChapter) => {
      const percent = chapterCompletion(chapter, progress);
      const done = !loading && percent === 100;
      return <section key={chapter.id} id={chapter.id} className={`${styles.chapter} ${done ? styles.chapterDone : ''}`} aria-labelledby={`${chapter.id}-heading`}>
        <div className={styles.chapterHeader}>
          <h2 id={`${chapter.id}-heading`} className={styles.chapterTitle}>Chapter {chapter.number}: {chapter.label}
            {done && <span className={styles.chapterCheck}><Check size={14} /><span className={styles.srOnly}>Chapter completed</span></span>}</h2>
          {loading
            ? <div className={`${styles.progressTrack} ${styles.progressLoading}`} role="progressbar" aria-label={`Chapter ${chapter.number} completion`} aria-busy="true" />
            : <div className={styles.progressTrack} role="progressbar" aria-label={`Chapter ${chapter.number} completion`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <span className={styles.progressFill} style={{ width: `${percent}%`, display: 'block' }} />
              <span className={styles.progressPill} style={{ ['--pct' as string]: percent }}>{percent}%</span>
            </div>}
        </div>
        <ol className={styles.entries}>
          {chapter.entries.map((entry, index) => {
            const view = viewOf(entry);
            const status: RowStatus = loading ? 'not_started' : rowStatus(entry.id, progress, inProgress);
            const fraction = ringFraction(status, inProgress[entry.id]?.visited, view.screenCount ?? null);
            const isOpen = open === entry.id && !loading;
            const popoverId = `${entry.id}-popover`;
            return <li id={entry.id} key={entry.id} className={styles.entry} {...(isOpen ? { 'data-entry-open': '' } : {})}>
              <div className={`${styles.rowWrap} ${status === 'completed' ? styles.rowDone : ''} ${index === chapter.entries.length - 1 ? styles.lastRow : ''}`}>
                <button type="button" className={`${styles.entryRow} ${isOpen ? styles.entryRowOpen : ''}`} aria-expanded={isOpen} aria-controls={isOpen ? popoverId : undefined}
                  onClick={() => setOpen(isOpen ? null : entry.id)}>
                  <EntryMarker variant={view.variant} glyph={view.glyph} status={status} fraction={fraction} />
                  <span className={styles.entryCopy}>
                    <span className={styles.entryTitle}>{view.title}{STATUS_TEXT[status] && <span className={styles.srOnly}> · {STATUS_TEXT[status]}</span>}</span>
                    {view.subtitle && <span className={styles.entrySubtitle}>{view.subtitle}</span>}
                  </span>
                </button>
                {isOpen && <LessonPopover id={popoverId} levelId={level.id} view={view} status={status} accuracy={progress[entry.id]?.accuracy ?? null} />}
              </div>
            </li>;
          })}
        </ol>
      </section>;
    })}
  </div>;
}
