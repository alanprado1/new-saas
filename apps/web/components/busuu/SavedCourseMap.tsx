'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { localWalkthroughAuthClient } from '@/lib/busuu/local-walkthrough';
import { savedCourseProgress, savedInProgress, type CourseProgress, type InProgress } from '@/lib/busuu/progress';
import type { SavedAttempt } from '@/lib/busuu/attempt';
import { getCachedAttempts, setCachedAttempts } from '@/lib/busuu/attempts-cache';
import type { CourseLevel, CourseLevelId } from '@/lib/busuu/types';
import type { LevelViews } from '@/lib/busuu/map-views';
import ChapterTimeline from './ChapterTimeline';
import LevelSelector from './LevelSelector';
import styles from '@/app/busuu/busuu.module.css';

type Choice = { id: CourseLevelId; name: string; chapterCount: number };
type Status = 'loading' | 'ready' | 'signed_out' | 'error';

export default function SavedCourseMap({ level, views, choices, selected }: { level: CourseLevel; views: LevelViews; choices: Choice[]; selected?: string }) {
  const [progress, setProgress] = useState<CourseProgress>({});
  const [inProgress, setInProgress] = useState<InProgress>({});
  const [status, setStatus] = useState<Status>('loading');
  const [problem, setProblem] = useState('');
  const reload = useRef<() => void>(() => {});
  useEffect(() => {
    let retired = false, owner: string | null = null, controller: AbortController | null = null;
    const load = async (id: string) => {
      controller?.abort(); const request = new AbortController(); controller = request;
      try {
        const response = await fetch('/api/course/attempts?include=active', { cache: 'no-store', headers: { 'X-Course-Owner': id }, signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]) });
        const data = await response.json();
        if (retired || request.signal.aborted || owner !== id) return;
        if (!response.ok) throw new Error(data.error || 'Saved progress unavailable.');
        if (data.owner !== id || !Array.isArray(data.attempts) || data.attempts.some((a: { user_id: string }) => a.user_id !== id)) throw new Error('Your account changed. Reload saved progress.');
        setCachedAttempts(id, { attempts: data.attempts, inProgress: data.inProgress });
        const completed = savedCourseProgress(data.attempts);
        setProgress(completed); setInProgress(savedInProgress(data.inProgress, completed)); setStatus('ready'); setProblem('');
      } catch (error) {
        if (!retired && !request.signal.aborted && owner === id) { setProgress({}); setInProgress({}); setStatus('error'); setProblem(error instanceof Error ? error.message : 'Saved progress unavailable.'); }
      }
    };
    const { data: { subscription } } = (localWalkthroughAuthClient() ?? createClient()).auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null;
      if (owner === id) return;
      owner = id; controller?.abort();
      const cached = id ? getCachedAttempts(id) : null;
      if (cached) {
        const completed = savedCourseProgress(cached.attempts as SavedAttempt[]);
        setProgress(completed); setInProgress(savedInProgress(cached.inProgress, completed)); setStatus('ready');
      } else {
        setProgress({}); setInProgress({});
        setStatus(id ? 'loading' : 'signed_out');
      }
      if (id) queueMicrotask(() => { if (!retired && owner === id) void load(id); });
    });
    reload.current = () => { if (owner) void load(owner); };
    const focus = () => reload.current();
    window.addEventListener('focus', focus); window.addEventListener('pageshow', focus);
    return () => { retired = true; controller?.abort(); subscription.unsubscribe(); window.removeEventListener('focus', focus); window.removeEventListener('pageshow', focus); };
  }, [level.id, selected]);
  // Remember the level so the Course button (/busuu) reopens it.
  useEffect(() => { document.cookie = `anigo-course-level=${level.id}; path=/; max-age=31536000; samesite=lax`; }, [level.id]);
  const entries = level.chapters.flatMap(c => c.entries).filter(e => e.kind !== 'certificate_entry');
  const percent = status === 'ready' ? Math.round(entries.filter(e => progress[e.id]).length / entries.length * 100) : undefined;
  return <><LevelSelector current={level.id} percent={percent} choices={choices} />
    {(status === 'error' || status === 'signed_out') && <p className={styles.mapNotice} role="status">
      {status === 'signed_out' ? 'Sign in to see your course progress.' : `We couldn’t load your progress. ${problem}`}
      {status === 'error' && <button type="button" className={styles.noticeButton} onClick={() => { setStatus('loading'); reload.current(); }}>Try again</button>}
    </p>}
    <ChapterTimeline level={level} views={views} selected={selected} progress={progress} inProgress={inProgress} loading={status === 'loading'} />
  </>;
}
