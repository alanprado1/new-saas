import { getAudioReading, getAudioScript, getSceneReuse } from './content-readiness';
import type { CourseAudioItem } from './audio';
import type { LessonContentPack, LessonContentScreen } from './types';

export type CoursePlaybackPreferences = { provider: 'edge' | 'voicevox'; edgeVoice: string; voiceVoxId: number };
export type ScreenPlayback = { kind: 'dialogue'; items: CourseAudioItem[] } | { kind: 'single'; item: CourseAudioItem };
export type PlannedClip = { screenId: string; screenIndex: number; role: 'source' | 'feedback'; item: CourseAudioItem };

/**
 * The single definition of what a screen plays (source audio or corrected-sentence feedback), shared by the Replay/Check handler
 * and by lesson prefetch so a prefetched clip is exactly the one playback requests: same text, reading, provider, voice, speed.
 * Returns null when the screen plays nothing (delayed scene questions, no-source-replay tasks, missing script).
 */
export function getScreenPlayback(pack: LessonContentPack, screen: LessonContentScreen, preferences: CoursePlaybackPreferences, speed: number, feedback = false): ScreenPlayback | null {
  const source = !feedback ? getSceneReuse(pack, screen) ?? screen : screen;
  const text = feedback ? screen.audio.feedbackText : getAudioScript(source);
  if (!text || screen.sceneContext || (!feedback && screen.audio.beforeAnswer === false)) return null;
  if (!feedback && source.renderer === 'dialogue') {
    return { kind: 'dialogue', items: source.dialogue!.turns.map(turn => ({
      text: turn.japanese!, reading: turn.reading, provider: preferences.provider,
      voice: preferences.provider === 'edge' ? (turn.speaker === 'staff' ? 'ja-JP-KeitaNeural' : preferences.edgeVoice) : preferences.voiceVoxId, speed,
    })) };
  }
  return { kind: 'single', item: { text, reading: feedback ? undefined : getAudioReading(source), provider: preferences.provider,
    voice: preferences.provider === 'edge' ? preferences.edgeVoice : preferences.voiceVoxId, speed } };
}

const identityOf = (item: CourseAudioItem) => JSON.stringify([item.provider, item.voice, item.reading ?? '', item.text]);

/** Every clip occurrence the lesson can play, in screen order (source audio then feedback audio per base screen). Retry passes replay base screens, so they add none. */
function allClips(pack: LessonContentPack, preferences: CoursePlaybackPreferences, speed: number): PlannedClip[] {
  const clips: PlannedClip[] = [];
  pack.screens.forEach((screen, screenIndex) => {
    for (const role of ['source', 'feedback'] as const) {
      const playback = getScreenPlayback(pack, screen, preferences, speed, role === 'feedback');
      for (const item of playback ? playback.kind === 'dialogue' ? playback.items : [playback.item] : []) {
        if (item.text.trim()) clips.push({ screenId: screen.screenId, screenIndex, role, item });
      }
    }
  });
  return clips;
}
const distinct = (clips: PlannedClip[]) => { const seen = new Set<string>(); return clips.filter(c => !seen.has(identityOf(c.item)) && seen.add(identityOf(c.item))); };

/** Every distinct clip the lesson can play, in screen order. */
export function planLessonClips(pack: LessonContentPack, preferences: CoursePlaybackPreferences, speed: number): PlannedClip[] {
  return distinct(allClips(pack, preferences, speed));
}

/** Prefetch order: the current screen onward first, then earlier screens (which retry passes and restarts can replay). */
export function planLessonPrefetch(pack: LessonContentPack, preferences: CoursePlaybackPreferences, speed: number, currentIndex = 0): CourseAudioItem[] {
  const clips = allClips(pack, preferences, speed);
  return distinct([...clips.filter(c => c.screenIndex >= currentIndex), ...clips.filter(c => c.screenIndex < currentIndex)]).map(c => c.item);
}
