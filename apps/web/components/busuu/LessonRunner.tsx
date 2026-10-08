'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { localWalkthroughAuthClient } from '@/lib/busuu/local-walkthrough';
import { COURSE_EDGE_VOICES, CourseAudioAdapter, readCourseAudioPreferences, type CourseAudioState } from '@/lib/busuu/audio';
import { createBrowserClipStore } from '@/lib/busuu/audio-cache';
import { getKanjiExamplesPlayback, getScreenPlayback, planLessonPrefetch } from '@/lib/busuu/audio-plan';
import { getAudioScript, getSceneReuse, getScreenAudioGaps, getScreenContentGaps } from '@/lib/busuu/content-readiness';
import { canContinue, createLessonState, getCurrentOutcome, getLessonResult, getPassOutcome, transitionLesson, type LessonAction } from '@/lib/busuu/runner';
import { getActivityProgress, getFeedbackHeading, getFeedbackSupport, getFeedbackTargets, handleLessonKey, highlightSegments, isCheckpointPack } from '@/lib/busuu/lesson-presentation';
import type { LessonContentPack, LessonContentScreen } from '@/lib/busuu/types';
import { CourseAttemptSession, courseTransport, type SaveSnapshot } from '@/lib/busuu/attempt-client';
import LessonScreen, { Dialogue, KanjiCard } from './LessonScreen';
import OptionalProduction from './OptionalProduction';
import { mixed } from './mixed-text';
import styles from '@/app/busuu/runner.module.css';

const fallbackVoices = [ { id: 3, label: 'ずんだもん', sublabel: 'ノーマル' }, { id: 1, label: '四国めたん', sublabel: 'ノーマル' },
  { id: 8, label: '春日部つむぎ', sublabel: 'ノーマル' }, { id: 14, label: '冥鳴ひまり', sublabel: 'ノーマル' }, { id: 2, label: '四国めたん', sublabel: 'あまあま' } ];

export function SceneRecap({ screen, source }: { screen: LessonContentScreen; source: LessonContentScreen | null }) {
  if (screen.sourceContract?.transcriptAccess !== 'scene_recap' || !source) return null;
  return <details className={styles.hint}><summary>Review the earlier scene</summary><Dialogue screen={source} /></details>;
}

// Replaceable illustration slot: swap the contents for lesson artwork later.
function ResultIllustration({ checkpoint }: { checkpoint: boolean }) {
  return <div className={styles.resultArt} data-slot="result-illustration" aria-hidden="true">
    <svg viewBox="0 0 160 120"><circle cx="80" cy="60" r="52" />{checkpoint
      ? <path d="M62 36v50M62 38h38l-8 14 8 14H62" />
      : <path d="M54 62l18 18 36-40" />}</svg>
  </div>;
}
function FeedbackIcon({ correct }: { correct: boolean }) {
  return <svg className={`${styles.feedbackIcon} ${correct ? styles.feedbackIconCorrect : styles.feedbackIconWrong}`} viewBox="0 0 48 48" aria-hidden="true">
    <path d="M6 32a18 18 0 0 1 36 0" fill="none" strokeWidth="6" strokeLinecap="round" />
    <path d={correct ? 'M24 32l10-12' : 'M24 32L14 20'} strokeWidth="4" strokeLinecap="round" />
    <circle cx="24" cy="32" r="3" stroke="none" />
  </svg>;
}
const SettingsIcon = () => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" /><circle cx="16" cy="7" r="2.4" fill="none" stroke="currentColor" strokeWidth="2.2" /><circle cx="8" cy="17" r="2.4" fill="none" stroke="currentColor" strokeWidth="2.2" /></svg>;
const CloseIcon = () => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>;

export default function LessonRunner({ pack, preview, title, returnHref, onExit }: {
  pack: LessonContentPack; preview: boolean; title: string; returnHref: string; onExit: () => void;
}) {
  const [state, setState] = useState(() => transitionLesson(pack, createLessonState(pack), { type: preview ? 'start_preview' : 'start' }));
  const [save, setSave] = useState<SaveSnapshot | null>(null);
  const session = useRef<CourseAttemptSession | null>(null);
  const dispatch = useCallback((action: LessonAction) => {
    if (preview) setState(s => transitionLesson(pack, s, action));
    else session.current?.dispatch(action);
  }, [pack, preview]);
  const [audioState, setAudioState] = useState<CourseAudioState>({ status: 'idle', message: '' });
  const [preferences, setPreferences] = useState(() => {
    try { if (typeof window !== 'undefined') return readCourseAudioPreferences(window.localStorage); } catch { /* Audio defaults remain available. */ }
    return { provider: 'edge' as const, edgeVoice: COURSE_EDGE_VOICES[0].name, voiceVoxId: 1 };
  });
  const [speed, setSpeed] = useState(1);
  const [accountReady, setAccountReady] = useState(false);
  const [voices, setVoices] = useState(fallbackVoices);
  const [voiceNote, setVoiceNote] = useState('');
  const [learnerName, setLearnerName] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false); // appended after the existing state hooks: tests rely on their order
  const [playing, setPlaying] = useState<'source' | 'examples'>('source'); // which kanji control owns the adapter's current playback
  const adapter = useRef<CourseAudioAdapter | null>(null);
  const owner = useRef<string | null | undefined>(undefined);
  const screen = pack.screens[state.index];
  const sceneSource = screen && getSceneReuse(pack, screen);
  const focusTarget = useRef<HTMLHeadingElement>(null);
  const feedbackTarget = useRef<HTMLHeadingElement>(null);
  const shell = useRef<HTMLElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const active = (preview || save?.ready) && ['presentation', 'response', 'feedback'].includes(state.phase);
  const contentGaps = screen ? getScreenContentGaps(screen) : [];
  const audioGaps = screen ? getScreenAudioGaps(screen) : [];

  // Auth callbacks perform only synchronous cancellation/state updates, never auth calls.
  useEffect(() => {
    const audio = new CourseAudioAdapter((url, init) => fetch(url, init), src => new Audio(src), setAudioState, undefined, createBrowserClipStore());
    adapter.current = audio;
    const { data: { subscription } } = (localWalkthroughAuthClient() ?? createClient()).auth.onAuthStateChange((_event, authSession) => {
      const id = authSession?.user.id ?? null;
      audio.setAccount(id);
      const meta = authSession?.user.user_metadata as Record<string, unknown> | undefined;
      const rawName = [meta?.given_name, meta?.full_name, meta?.name].find((v): v is string => typeof v === 'string' && v.trim().length > 0);
      setLearnerName(rawName ? rawName.trim().split(/\s+/)[0] : '');
      if (owner.current !== undefined && owner.current !== id) {
        session.current?.dispose(); session.current = null; setSave(null);
        setState(s => ({ ...s, phase: 'exit', completionEligible: false }));
      }
      if (owner.current === undefined && id && !preview) {
        let storage: Storage | null = null;
        try { storage = window.localStorage; } catch { /* Controller shows recovery-storage notice. */ }
        const attempt = new CourseAttemptSession(pack, id, storage, courseTransport, snapshot => { setSave(snapshot); setState(snapshot.state); });
        session.current = attempt;
        // Keep auth callbacks synchronous; start requests after the callback returns.
        queueMicrotask(() => { void attempt.open(); });
      }
      owner.current = id;
      setAccountReady(Boolean(id));
      setAuthChecked(true);
    });
    const retire = () => { audio.cancel(); };
    window.addEventListener('pagehide', retire);
    return () => { subscription.unsubscribe(); window.removeEventListener('pagehide', retire); audio.dispose(); adapter.current = null; session.current?.dispose(); session.current = null; owner.current = undefined; };
  }, [pack, preview]);

  const play = useCallback(async (feedback = false, which: 'source' | 'examples' = 'source') => {
    const audio = adapter.current;
    const playback = screen && (!feedback && which === 'examples' ? getKanjiExamplesPlayback(screen, preferences, speed) : getScreenPlayback(pack, screen, preferences, speed, feedback));
    if (!playback || !audio || !active) return;
    const screenId = screen.screenId;
    setPlaying(feedback ? 'source' : which); // requested before the adapter reports its state, so the kanji screen shows only the control that started
    audio.setScreen(screenId);
    const played = playback.kind === 'dialogue' ? await audio.playDialogue(playback.items) : playback.kind === 'words' ? await audio.playSequence(playback.items, playback.gapMs) : await audio.play(playback.item);
    // Playback is optional now, but a completed play still records audio_ready exactly as before so event streams keep their shape.
    if (played && !feedback && which === 'source') dispatch({ type: 'audio_ready', screenId });
  }, [pack, screen, active, preferences, speed, dispatch]);

  // Silent background prefetch of the whole lesson's audio into the persistent clip cache, current screen first. It renders and
  // announces nothing, never dispatches, and is not playback.
  const prefetchLive = accountReady && state.phase !== 'launch' && state.phase !== 'exit' && state.phase !== 'result';
  useEffect(() => {
    if (prefetchLive) adapter.current?.prefetch(planLessonPrefetch(pack, preferences, speed, state.index));
  }, [prefetchLive, pack, preferences, speed, state.index]);

  useEffect(() => {
    const audio = adapter.current;
    audio?.setScreen(active && screen ? screen.screenId : '');
    let retired = false;
    // Auto-play only a screen's own clip. Scene-reuse questions play the scene on demand (Replay scene), never on every question.
    if (active && screen?.audio.required && !screen.sceneContext && !sceneSource && accountReady) queueMicrotask(() => { if (!retired) void play(); });
    return () => { retired = true; audio?.cancel(); };
  }, [screen, sceneSource, active, accountReady, play]);

  useEffect(() => {
    if (preferences.provider !== 'voicevox') return;
    const controller = new AbortController();
    fetch('/api/voices', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Voice list unavailable');
      const data: unknown = await response.json();
      if (controller.signal.aborted) return;
      if (!Array.isArray(data)) throw new Error('Voice list unavailable');
      const valid = data.filter(v => typeof v?.id === 'number' && typeof v?.label === 'string' && typeof v?.sublabel === 'string');
      if (!valid.length) throw new Error('Voice list unavailable');
      setVoices(valid); setVoiceNote('');
    }).catch(() => { if (!controller.signal.aborted) setVoiceNote('Using the app’s default VoiceVox list. You can also select Edge TTS.'); });
    return () => controller.abort();
  }, [preferences.provider]);

  // The lesson owns the whole viewport (Busuu's lesson shell has no site navigation): the shell is a fixed overlay, and the surrounding
  // course page is made inert and non-scrolling for as long as the runner is mounted.
  useEffect(() => {
    const root = shell.current, parent = root?.parentElement;
    if (!root || !parent) return;
    const hidden = Array.from(parent.children).filter(el => el !== root && !el.hasAttribute('inert'));
    hidden.forEach(el => el.setAttribute('inert', ''));
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { hidden.forEach(el => el.removeAttribute('inert')); document.body.style.overflow = previous; };
  }, []);

  // Each new screen starts at the top; feedback keeps the answered task visible above the sheet.
  useEffect(() => {
    const root = shell.current;
    if (state.phase !== 'feedback') {
      focusTarget.current?.focus({ preventScroll: true }); root?.scrollTo({ top: 0 });
      root?.style.setProperty('--sheet-height', '0px');
      return;
    }
    feedbackTarget.current?.focus({ preventScroll: true });
    // The sheet's height can change after first paint (fonts, wrapping), so keep the content padding and scroll position in step with it.
    let scrollFrame = 0;
    const fit = () => {
      const panel = sheet.current;
      if (!root || !panel) return;
      root.style.setProperty('--sheet-height', `${panel.offsetHeight}px`);
      // Scroll on the next frame, once the new bottom padding has been laid out (otherwise there is no room to scroll into).
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        const task = root.querySelector('[data-activity]');
        if (!task) return;
        const overlap = task.getBoundingClientRect().bottom - (panel.getBoundingClientRect().top - 16);
        if (overlap > 0) root.scrollBy({ top: overlap });
      });
    };
    const frame = requestAnimationFrame(fit);
    const observer = typeof ResizeObserver === 'undefined' || !sheet.current ? null : new ResizeObserver(fit);
    if (sheet.current) observer?.observe(sheet.current);
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(scrollFrame); observer?.disconnect(); };
  }, [state.index, state.phase, state.retry?.position]);

  // Enter = Check/Continue anywhere on the page; 1-9 pick the numbered option (rules and IME guards in handleLessonKey).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const root = shell.current;
      if (!root) return;
      if (root.querySelector('[data-exit-dialog]')) { if (event.key === 'Escape') setConfirmExit(false); return; } // the dialog owns the keyboard
      handleLessonKey(event, root);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Leaving mid-lesson asks first (before anything is disposed, so "Keep practising" resumes exactly where the learner was).
  useEffect(() => {
    const root = shell.current;
    if (!confirmExit || !root) return;
    const behind = Array.from(root.children).filter(el => !el.hasAttribute('data-exit-dialog') && !el.hasAttribute('inert'));
    behind.forEach(el => el.setAttribute('inert', ''));
    keepButton.current?.focus();
    return () => { behind.forEach(el => el.removeAttribute('inert')); };
  }, [confirmExit]);

  const changePreferences = (next: typeof preferences) => {
    adapter.current?.cancel(); setPreferences(next);
    try {
      localStorage.setItem('pref_ttsProvider', next.provider); localStorage.setItem('pref_edgeVoice', next.edgeVoice); localStorage.setItem('pref_voiceVoxId', String(next.voiceVoxId));
    } catch { /* In-memory settings still work. */ }
  };
  const exit = () => { adapter.current?.dispose(); session.current?.dispose(); onExit(); };
  const result = getLessonResult(pack, state);
  const savedResult = !preview && save?.confirmed?.completed_at && save.pending === 0 && save.status === 'saved' ? save.confirmed.result : null;
  // Saving is silent. Only a failed save is shown, with the existing retry.
  const saveFailure = !preview && save?.status === 'error' && <p className={styles.saveNotice} role="alert">
    <span>{save.message || 'Your progress could not be saved.'} Your answers are kept on this device.</span>
    {save.storageWarning && <span>{save.storageWarning}</span>}
    <button type="button" className={styles.linkButton} onClick={() => void session.current?.retry()}>Retry save</button>
  </p>;
  const restart = <button type="button" className={styles.secondaryButton} disabled={save?.status === 'loading'} onClick={() => { adapter.current?.cancel(); void session.current?.restart(); }}>Restart lesson</button>;
  const closeButton = <button type="button" className={styles.closeButton} aria-label="Exit lesson" onClick={() => active ? setConfirmExit(true) : exit()}><CloseIcon /></button>;

  if (!preview && state.phase !== 'exit' && !save?.ready) return <main id="course-main" className={styles.shell} ref={shell}>
    <div className={styles.topBar}>{closeButton}</div>
    <div className={`${styles.column} ${styles.centered}`}>
      <h1 ref={focusTarget} tabIndex={-1} className={styles.prompt}>{save?.status === 'error' ? 'We couldn’t open your lesson' : authChecked && !accountReady ? 'Sign in to start this lesson' : 'Loading your lesson…'}</h1>
      {save?.status !== 'error' && !(authChecked && !accountReady) && <div className={styles.spinner} role="status" aria-label="Loading" />}
      {save?.status === 'error' && <><p role="alert">{save.message}</p><div className={styles.inlineActions}>
        <button type="button" className={styles.primary} onClick={() => void session.current?.retry()}>Try again</button>{restart}</div></>}
      {authChecked && !accountReady && <p>Your progress is saved to your account.</p>}
      <button type="button" className={styles.secondaryButton} onClick={exit}>Back to lesson details</button>
    </div>
  </main>;

  if (state.phase === 'launch' || state.phase === 'exit') return <main id="course-main" className={styles.shell} ref={shell}>
    <div className={styles.topBar} />
    <div className={`${styles.column} ${styles.centered}`}>
      <h1 tabIndex={-1} ref={focusTarget} className={styles.prompt}>{state.phase === 'exit' ? 'Attempt ended' : 'Lesson content is incomplete'}</h1>
      <p>{state.phase === 'exit' ? 'Your account changed. Reopen the lesson for your current account.' : 'Required content is missing. Return to the lesson details to review its availability.'}</p>
      <button type="button" className={styles.primary} onClick={exit}>Back to lesson details</button>
      <Link href={returnHref}>Back to course</Link>
    </div>
  </main>;

  if (state.phase === 'result') {
    const checkpoint = isCheckpointPack(pack);
    const shown = savedResult ?? result, retryShown = savedResult?.retry ?? result.retry;
    const waiting = !preview && result.completionEligible && save?.status !== 'error' && (save?.pending ?? 0) > 0;
    return <main id="course-main" className={`${styles.shell} ${styles.result}`} ref={shell}>
      <div className={`${styles.column} ${styles.resultColumn}`}>
        <ResultIllustration checkpoint={checkpoint} />
        <h1 ref={focusTarget} tabIndex={-1}>{!result.completionEligible ? state.preview ? 'Development preview finished' : 'Lesson finished'
          : checkpoint ? 'Checkpoint completed!' : learnerName ? `Well done, ${learnerName}!` : 'Well done!'}</h1>
        {!checkpoint && <p className={styles.resultTitle}>{title}</p>}
        {result.completionEligible ? <div className={styles.statRow}>
          {shown.percent !== null && <div className={styles.statCard}><span className={styles.statLabel}>Score</span><span className={styles.statValue}>{shown.percent}%</span></div>}
          {result.graded > 0 && <div className={styles.statCard}><span className={styles.statLabel}>Correct first time</span><span className={styles.statValue}>{shown.correct} of {result.graded}</span></div>}
          {retryShown && result.retry && result.retry.total > 0 && <div className={styles.statCard}><span className={styles.statLabel}>Retried</span><span className={styles.statValue}>{retryShown.correct} of {result.retry.total}</span></div>}
        </div> : <p>No learner completion or score is awarded in a development preview.</p>}
        {pack.passPolicy?.kind === 'accuracy_threshold' && result.completionEligible && <p className={styles.passNote}>
          {getPassOutcome(pack, savedResult ?? result) ? 'Pass mark met' : 'Pass mark not met'} · {pack.passPolicy.minimumPercent}% needed</p>}
        {saveFailure}
        {!preview && result.completionEligible && pack.completion?.optionalSurfaces.map(surface => <OptionalProduction key={surface.screenId} surface={surface} />)}
      </div>
      <div className={styles.dock}>
        {!preview && restart}
        <Link className={`${styles.primary} ${waiting ? styles.pending : ''}`} href={returnHref} data-primary-action="" aria-disabled={waiting || undefined}
          onClick={event => { if (waiting) { event.preventDefault(); return; } adapter.current?.dispose(); }}>Continue</Link>
        {preview && <button type="button" className={styles.secondaryButton} onClick={exit}>Back to lesson details</button>}
      </div>
    </main>;
  }

  const outcome = getCurrentOutcome(state);
  const progress = getActivityProgress(pack, state);
  const feedback = state.phase === 'feedback';
  const correct = Boolean(outcome?.correct);
  const feedbackBlocks = feedback ? getFeedbackSupport(screen) : [];
  const explanations = feedbackBlocks.filter(block => block.kind === 'explanation');
  const answerBlocks = feedbackBlocks.filter(block => block.kind !== 'explanation');
  const canReplayFeedback = Boolean(screen.audio.feedbackText && !screen.sceneContext);
  const truthLine = !correct && screen.answer?.kind === 'truth' ? `Correct answer: ${screen.answer.accepted ? 'True' : 'False'}` : '';
  const targets = getFeedbackTargets(screen);
  const heading = getFeedbackHeading(correct, `${screen.screenId}:${state.retry ? state.retry.position : ''}`);
  const showPlayer = !screen.sceneContext && screen.audio.beforeAnswer !== false && (screen.audio.required || getAudioScript(sceneSource ?? screen));
  const playLabel = audioState.status === 'loading' ? 'Cancel audio' : audioState.status === 'playing' ? 'Pause audio'
    : audioState.status === 'error' ? 'Retry audio' : sceneSource ? 'Replay scene' : 'Replay audio';
  // The kanji screen has two controls on one adapter: each shows its own state only while it owns the current playback, the other stays idle.
  const kanjiPlayer = (which: 'source' | 'examples', noun: string, idle: string) => {
    const status = playing === which ? audioState.status : 'idle';
    return { status, disabled: !accountReady || !getAudioScript(screen),
      label: status === 'loading' ? `Cancel ${noun}` : status === 'playing' ? `Pause ${noun}` : status === 'error' ? `Retry ${noun}` : idle,
      onToggle: () => status === 'loading' || status === 'playing' ? void adapter.current?.cancel() : play(false, which) };
  };
  const onToggle = () => audioState.status === 'loading' || audioState.status === 'playing' ? void adapter.current?.cancel() : play();
  const continueNow = () => { adapter.current?.cancel(); dispatch({ type: 'continue', screenId: screen.screenId }); };
  return <main id="course-main" className={styles.shell} ref={shell}>
    <div className={styles.topBar} onKeyDown={e => { if (e.key === 'Escape' && voiceOpen) { e.stopPropagation(); setVoiceOpen(false); } }}>
      <button type="button" className={styles.iconButton} aria-label="Audio voice settings" aria-haspopup="dialog" aria-expanded={voiceOpen} onClick={() => setVoiceOpen(open => !open)}><SettingsIcon /></button>
      {voiceOpen && <>
        <div className={styles.popoverBackdrop} aria-hidden="true" onClick={() => setVoiceOpen(false)} />
        <div className={styles.voiceMenu} role="dialog" aria-label="Audio voice">
          <label>Provider <select value={preferences.provider} onChange={e => changePreferences({ ...preferences, provider: e.target.value as 'edge' | 'voicevox' })}><option value="edge">Edge TTS</option><option value="voicevox">VoiceVox</option></select></label>
          {preferences.provider === 'edge' ? <label>Voice <select value={preferences.edgeVoice} onChange={e => changePreferences({ ...preferences, edgeVoice: e.target.value })}>{COURSE_EDGE_VOICES.map(v => <option key={v.name} value={v.name}>{v.label}</option>)}</select></label> :
            <label>Voice <select value={preferences.voiceVoxId} onChange={e => changePreferences({ ...preferences, voiceVoxId: Number(e.target.value) })}>
              {!voices.some(v => v.id === preferences.voiceVoxId) && <option value={preferences.voiceVoxId}>Saved voice {preferences.voiceVoxId}</option>}
              {voices.map(v => <option key={v.id} value={v.id}>{v.label} · {v.sublabel}</option>)}</select></label>}
          {voiceNote && <p className={styles.caption}>{voiceNote}</p>}
        </div>
      </>}
      <progress className={styles.progress} aria-label="Activity progress" value={progress.value} max={progress.max} />
      {closeButton}
    </div>
    <div className={styles.column}>
      {state.preview && <aside className={styles.previewNotice}>Development preview · no learner completion or score</aside>}
      {saveFailure}
      <h1 ref={focusTarget} tabIndex={-1} className={styles.prompt}>{screen.renderer === 'kanji' && screen.kanji ? 'Look, a new kanji!' : mixed(screen.prompt ?? 'Instruction unresolved')}</h1>
      <SceneRecap screen={screen} source={sceneSource || null} />
      {contentGaps.length + audioGaps.length > 0 && <aside className={styles.previewNotice}><strong>Content unavailable · {screen.screenId}</strong>
        <p>Exact lesson copy is incomplete. Responses and scoring are disabled.</p>
        <details><summary>View missing fields · {contentGaps.length + audioGaps.length}</summary>
          <ul>{[...contentGaps, ...audioGaps].map((g, i) => <li key={i}>{g.field}: {g.reason}</li>)}</ul></details></aside>}
      {screen.renderer === 'kanji' && screen.kanji
        ? (contentGaps.length === 0 || state.preview) && <KanjiCard screen={screen} audio={showPlayer ? {
          readings: kanjiPlayer('source', 'kanji readings', 'Play kanji readings'), examples: kanjiPlayer('examples', 'examples', 'Play examples'),
          speed, onSpeed: next => { adapter.current?.cancel(); setSpeed(next); }, message: audioState.message, error: audioGaps.length === 0 && audioState.status === 'error' } : null} />
        : (screen.visual !== 'none' || showPlayer) && <div className={styles.mediaCard}>
        {screen.visual !== 'none' && <div className={styles.visualPlaceholder} aria-hidden="true">
          <svg viewBox="0 0 120 80"><circle cx="60" cy="27" r="12" /><path d="M32 68c0-24 56-24 56 0" /></svg>
        </div>}
        {showPlayer && <div className={styles.player}>
          <div className={styles.audioPill} data-state={audioState.status}>
            <button type="button" className={styles.playToggle} aria-label={playLabel} data-state={audioState.status} onClick={onToggle}
              disabled={!accountReady || !getAudioScript(sceneSource ?? screen)}>
              <span className={styles.playIcon} aria-hidden="true" />
            </button>
            <span className={styles.audioTrack} aria-hidden="true"><span className={styles.audioFill} /></span>
            <label className={styles.speed}><span className={styles.srOnly}>Speed</span><select value={speed} aria-label="Playback speed" onChange={e => { adapter.current?.cancel(); setSpeed(Number(e.target.value)); }}><option value={1}>1×</option><option value={0.75}>0.75×</option></select></label>
          </div>
          <p className={styles.srOnly} role="status">{audioGaps.length || audioState.status === 'error' ? '' : audioState.message}</p>
          {(audioGaps.length > 0 || audioState.status === 'error') && <p className={styles.audioError} role="alert">{audioGaps.length ? audioGaps[0].reason : audioState.message}</p>}
          {sceneSource?.dialogue?.context && !screen.sceneContext && <p className={styles.caption}>{sceneSource.dialogue.context}</p>}
        </div>}
      </div>}
      {state.preview && screen.sourceContract && <p className={styles.caption}>Recorded purpose (paraphrase): {screen.sourceContract.purpose}</p>}
      {(contentGaps.length === 0 || state.preview) && <LessonScreen screen={screen} state={state} dispatch={dispatch} />}
      {state.preview && <button type="button" className={styles.secondaryButton} onClick={() => { adapter.current?.cancel(); dispatch({ type: 'preview_skip', screenId: screen.screenId }); }}>Skip screen in preview</button>}
    </div>
    {confirmExit && <div className={styles.confirmBackdrop} data-exit-dialog="">
      <div className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="exit-title">
        <h2 id="exit-title">Leave this lesson?</h2>
        <p>Your progress is saved.</p>
        <div className={styles.confirmActions}>
          <button type="button" className={styles.primary} ref={keepButton} onClick={() => setConfirmExit(false)}>Keep practising</button>
          <button type="button" className={styles.secondaryButton} onClick={exit}>Leave lesson</button>
        </div>
      </div>
    </div>}
    {feedback ? <section className={styles.sheet} ref={sheet} aria-labelledby="lesson-feedback-title">
      <div className={styles.sheetInner}>
        <div className={styles.sheetHead}>
          <FeedbackIcon correct={correct} />
          <h2 id="lesson-feedback-title" ref={feedbackTarget} tabIndex={-1}>{heading}</h2>
        </div>
        <div className={styles.sheetBody}>
          {(answerBlocks.length > 0 || canReplayFeedback || truthLine) && <div className={styles.answerCard}>
            {canReplayFeedback && <button type="button" className={styles.speakerButton} disabled={!accountReady || audioState.status === 'loading'} onClick={() => void play(true)}>Replay corrected sentence</button>}
            <div className={styles.answerText}>
              {truthLine && <p className={styles.answerEnglish}>{truthLine}</p>}
              {answerBlocks.map((block, i) => block.kind === 'japanese'
                ? <div key={i}><p lang="ja" className={styles.answerJapanese}>{highlightSegments(block.text, targets).map((part, j) => part.mark ? <mark key={j}>{part.text}</mark> : part.text)}</p>
                  {block.secondary && <p lang="ja" className={styles.answerReading}>{block.secondary}</p>}</div>
                : <p key={i} className={styles.answerEnglish}>{mixed(block.text)}</p>)}
            </div>
          </div>}
          {explanations.map((block, i) => <p key={i} className={styles.sheetExplanation}>{mixed(block.text)}</p>)}
        </div>
        <div className={styles.sheetAction}>
          <button type="button" className={styles.primary} data-primary-action="" disabled={!canContinue(pack, state)} onClick={continueNow}>Continue</button>
        </div>
      </div>
    </section> : state.phase === 'presentation' && <div className={styles.dock}>
      <button type="button" className={styles.primary} data-primary-action="" disabled={!canContinue(pack, state)} onClick={continueNow}>Continue</button>
    </div>}
  </main>;
}
