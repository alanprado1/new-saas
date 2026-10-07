'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { CourseChapter, CourseEntry, CourseLevelId, LessonSpec, ReadinessReport } from '@/lib/busuu/types';
import LessonRunner from './LessonRunner';
import { Dialogue } from './LessonScreen';
import { getLaunchSceneReviews } from '@/lib/busuu/scene-context';
import { getContentPack } from '@/lib/busuu/content-registry';
import { describeEntry, getMapHref } from '@/lib/busuu/map-presentation';
import { CourseAttemptSession, courseTransport } from '@/lib/busuu/attempt-client';
import { localWalkthroughAuthClient } from '@/lib/busuu/local-walkthrough';
import { createClient } from '@/utils/supabase/client';
import styles from '@/app/busuu/busuu.module.css';

export function Spinner({ label = 'Loading lesson' }: { label?: string }) {
  return <div className={styles.spinnerWrap} role="status"><span className={styles.spinner} aria-hidden="true" /><span className={styles.srOnly}>{label}</span></div>;
}

// Starting a lesson from the map goes straight into it (no intro screen). A restart request first starts a fresh saved attempt
// through the same attempt contract the runner uses, then the runner opens that attempt.
function useRestart(pack: LessonSpec['contentPack'], wanted: boolean) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>(wanted ? 'working' : 'idle');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!wanted || !pack) return;
    let retired = false, session: CourseAttemptSession | null = null, started = false;
    const { data: { subscription } } = (localWalkthroughAuthClient() ?? createClient()).auth.onAuthStateChange((_event, authSession) => {
      const id = authSession?.user.id ?? null;
      if (started || retired) return;
      if (!id) { setState('error'); return; }
      started = true;
      let storage: Storage | null = null;
      try { storage = window.localStorage; } catch { /* Restart still works without recovery storage. */ }
      session = new CourseAttemptSession(pack, id, storage, courseTransport, snapshot => {
        if (retired) return;
        if (snapshot.status === 'error') setState('error');
        else if (snapshot.ready && snapshot.status === 'saved') setState('done');
      });
      queueMicrotask(() => { if (!retired) void session?.restart(); });
    });
    return () => { retired = true; subscription.unsubscribe(); session?.dispose(); };
  }, [pack, wanted, attempt]);
  return { state, retry: () => { setState('working'); setAttempt(n => n + 1); } };
}

export default function LessonLaunch({ levelId, entry, chapter, spec, readiness, restart = false }: {
  levelId: CourseLevelId; entry: CourseEntry; chapter: CourseChapter; spec: LessonSpec; readiness: ReadinessReport; restart?: boolean;
}) {
  const router = useRouter();
  const title = describeEntry(entry).title;
  const mapHref = getMapHref(levelId, chapter.id);
  const [mode, setMode] = useState<'preview' | null>(null);
  const sceneReviews = spec.contentPack ? getLaunchSceneReviews(spec.contentPack, getContentPack) : [];
  const [reviewed, setReviewed] = useState(false);
  const restartRun = useRestart(spec.contentPack, restart && readiness.scoredLaunchReady);
  // A restart link must not restart again on reload: drop the query once it has been applied.
  useEffect(() => { if (restart && restartRun.state === 'done') window.history.replaceState(null, '', window.location.pathname); }, [restart, restartRun.state]);
  // The runner asks for confirmation itself and only calls onExit once the learner has chosen to leave.
  const leave = () => { router.push(mapHref); };

  const unavailable = !readiness.scoredLaunchReady || !spec.contentPack;
  if (mode === 'preview' && spec.contentPack) return <LessonRunner key={`${spec.recordId}-preview`} pack={spec.contentPack} preview title={title} returnHref={mapHref} onExit={() => setMode(null)} />;
  if (unavailable) return <main id="course-main" className={styles.launchColumn}>
    <Link href={mapHref} className={styles.backLink}>← Back to course</Link>
    <div className={styles.launchHeading}><h1>{title}</h1></div>
    <section className={styles.unavailable} aria-labelledby="unavailable-title">
      <h2 id="unavailable-title">Coming soon</h2>
      <p>This lesson isn’t available yet. Choose another lesson on the course map.</p>
      {readiness.previewAvailable && <button type="button" className={styles.previewButton} onClick={() => setMode('preview')}>Open development preview</button>}
      <Link href={mapHref} className={styles.startButton}>Back to course</Link>
    </section>
  </main>;
  if (restart && restartRun.state === 'working') return <main id="course-main"><Spinner label="Restarting lesson" /></main>;
  if (restart && restartRun.state === 'error') return <main id="course-main" className={styles.launchColumn}>
    <div className={styles.launchHeading}><h1>{title}</h1></div>
    <section className={styles.unavailable}><h2>We couldn’t restart this lesson</h2><p>Check your connection and try again. Your earlier result is unchanged.</p>
      <button type="button" className={styles.startButton} onClick={restartRun.retry}>Try again</button><br />
      <Link href={mapHref} className={styles.backLink}>Back to course</Link></section>
  </main>;
  // The earlier-scene review is part of the checkpoint contract, so it keeps one short step before the lesson starts.
  if (sceneReviews.length > 0 && !reviewed) return <main id="course-main" className={styles.launchColumn}>
    <Link href={mapHref} className={styles.backLink}>← Back to course</Link>
    <div className={styles.launchHeading}><p className={styles.eyebrow}>{levelId} · Chapter {chapter.number}: {chapter.label}</p><h1>{title}</h1></div>
    <aside className={styles.dependencyNote} aria-labelledby="scene-review-title">
      <h2 id="scene-review-title">Review the earlier scene</h2>
      <p>This checkpoint asks about a scene from an earlier lesson. You can review it here before you start. This review is separate from the checkpoint tasks.</p>
      {sceneReviews.map(source => <details key={`${source.pack.recordId}-${source.screen.screenId}`} className={styles.details}>
        <summary>{source.screen.dialogue?.context ?? 'Earlier dialogue'} · scene review</summary>
        <Dialogue screen={source.screen} />
        <Link href={`/busuu/${levelId}/lesson/${source.pack.recordId}`}>Open the earlier lesson</Link>
      </details>)}
    </aside>
    <div style={{ textAlign: 'center' }}><button type="button" className={styles.startButton} onClick={() => setReviewed(true)}>Start lesson</button></div>
  </main>;
  return <LessonRunner key={spec.recordId} pack={spec.contentPack!} preview={false} title={title} returnHref={mapHref} onExit={leave} />;
}
