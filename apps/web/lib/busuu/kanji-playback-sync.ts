/**
 * Presentation-only rules tying the kanji tile's stroke animation to its readings player. No course state or events.
 *
 * The readings status comes from `LessonRunner` (`idle | loading | playing | error`). Playback *starting* (status leaves idle/error for
 * loading/playing, by autoplay or a press) restarts the animation from the outline. A press while loading/playing pauses it. The audio
 * ending by itself (playing -> idle) changes nothing, so the animation finishes on its own.
 */
export type KanjiSyncAction = 'restart' | 'finish' | 'pause' | null;
export type KanjiSyncState = { status: string; userStart: boolean };

export const initialKanjiSync = (status = 'idle'): KanjiSyncState => ({ status, userStart: false });
const isActive = (status: string) => status === 'loading' || status === 'playing';

/** The readings status changed. Autoplay starts honour reduced motion (completed ink); a start already handled by a press does not restart twice. */
export function onKanjiStatus(sync: KanjiSyncState, next: string, reducedMotion: boolean): { sync: KanjiSyncState; action: KanjiSyncAction } {
  const starting = !isActive(sync.status) && isActive(next);
  if (!starting) return { sync: { ...sync, status: next }, action: null };
  return { sync: { status: next, userStart: false }, action: sync.userStart ? null : reducedMotion ? 'finish' : 'restart' };
}

/** The learner pressed the tile's play/pause toggle (called before the status reflects the press). A start press always animates, even under reduced motion. */
export function onKanjiPress(sync: KanjiSyncState): { sync: KanjiSyncState; action: KanjiSyncAction } {
  return isActive(sync.status)
    ? { sync: { ...sync, userStart: false }, action: 'pause' }
    : { sync: { ...sync, userStart: true }, action: 'restart' };
}
