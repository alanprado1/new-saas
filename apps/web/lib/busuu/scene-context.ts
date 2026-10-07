import type { LessonContentPack, LessonContentScreen, ReadinessGap } from './types';

export type SceneContextResolver = (recordId: string, contentVersion: string) => LessonContentPack | null;
let registeredResolver: SceneContextResolver = () => null;
// The registry installs its exact-version lookup after registering all packs. This module never imports the registry.
export function configureSceneContextResolver(resolver: SceneContextResolver) { registeredResolver = resolver; }
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const unique = (ids: string[]) => ids.every(text) && new Set(ids).size === ids.length;

export function getDialogueContentGaps(screen: LessonContentScreen): ReadinessGap[] {
  const d = screen.dialogue;
  const valid = d && d.turns.length > 0 && unique(d.turns.map(t => t.id)) && unique(d.speakers) &&
    (d.kind === 'single_speaker'
      ? screen.sourceContract?.recordedSpeakerCount === 1 && d.speakers.length === 1 && ['guest', 'staff'].includes(d.speakers[0]) && d.turns.some(t => t.speaker === d.speakers[0])
      : d.kind === undefined && ['guest', 'staff'].every(speaker => d.speakers.includes(speaker as 'guest' | 'staff') && d.turns.some(t => t.speaker === speaker))) &&
    typeof d.japaneseVisible === 'boolean' && (d.translationVisible === undefined || typeof d.translationVisible === 'boolean') &&
    (d.context === undefined || text(d.context)) && (!d.speakerLabels || (text(d.speakerLabels.guest) && text(d.speakerLabels.staff))) &&
    !(d.translationVisible === false && screen.sourceContract?.translationBeforeAnswer === true) &&
    !(d.translationVisible !== false && screen.sourceContract?.translationBeforeAnswer === false) &&
    (!d.glosses || (d.japaneseVisible && screen.sourceContract?.transcriptBeforeAnswer !== false && d.glosses.length > 0 &&
      unique(d.glosses.map(g => g.japanese)) && d.glosses.every(g => text(g.japanese) && text(g.reading) && text(g.english) &&
        d.turns.some(t => t.japanese?.includes(g.japanese))))) &&
    d.turns.every(t => d.speakers.includes(t.speaker) && text(t.japanese) && (t.reading === undefined || text(t.reading)) &&
      (d.translationVisible === false ? t.english === null || text(t.english) : text(t.english)));
  return [...(valid ? [] : [{ screenId: screen.screenId, field: 'dialogue', reason: 'Complete ordered Japanese speaker turns and all configured visible translations and labels are required.' }]),
    ...getDialogueFactGaps(screen)];
}

export function getDialogueFactGaps(screen: LessonContentScreen): ReadinessGap[] {
  const facts = screen.dialogue?.facts;
  if (!facts) return [];
  const valid = facts.length > 0 && new Set(facts.map(f => f.id)).size === facts.length && facts.every(f => {
    const turns = screen.dialogue!.turns.filter(t => t.id === f.turnId);
    return text(f.id) && text(f.text) && turns.length === 1 && text(turns[0].japanese) && turns[0].japanese.includes(f.text);
  });
  return valid ? [] : [{ screenId: screen.screenId, field: 'dialogue.facts', reason: 'Each scene fact must uniquely identify a verbatim Japanese excerpt in one existing speaker turn.' }];
}

export function getSceneContext(pack: LessonContentPack, screen: LessonContentScreen, resolve = registeredResolver) {
  const ref = screen.sceneContext;
  if (!ref || !text(ref.recordId) || ref.recordId === pack.recordId || !/^\d+\.\d+\.\d+$/.test(ref.contentVersion) ||
    !ref.screenId.startsWith(`${ref.recordId}.`) || !text(ref.factId) || !text(ref.expectedText) || !text(ref.answerOptionId) || ref.access !== 'review_before_launch') return null;
  const source = resolve(ref.recordId, ref.contentVersion);
  if (!source || source.recordId !== ref.recordId || source.contentVersion !== ref.contentVersion || source.status !== 'reviewed') return null;
  const screens = source.screens.filter(s => s.screenId === ref.screenId);
  const scene = screens.length === 1 ? screens[0] : null;
  if (!scene || scene.renderer !== 'dialogue' || !scene.dialogue?.japaneseVisible || scene.sourceContract?.transcriptBeforeAnswer === false || getDialogueContentGaps(scene).length) return null;
  const facts = scene.dialogue.facts?.filter(f => f.id === ref.factId) ?? [];
  if (facts.length !== 1 || facts[0].text !== ref.expectedText) return null;
  const answer = screen.answer;
  if (screen.renderer !== 'choice' || answer?.kind !== 'choice' || answer.acceptedOptionIds.length !== 1 || answer.acceptedOptionIds[0] !== ref.answerOptionId ||
    answer.options.filter(o => o.id === ref.answerOptionId && o.text === facts[0].text).length !== 1 || answer.options.filter(o => o.text === facts[0].text).length !== 1) return null;
  return { pack: source, screen: scene, fact: facts[0] };
}

export function getSceneContextGaps(pack: LessonContentPack, resolve = registeredResolver): ReadinessGap[] {
  return pack.screens.filter(s => s.sceneContext && !getSceneContext(pack, s, resolve)).map(s => ({ screenId: s.screenId, field: 'sceneContext',
    reason: 'The prior scene must resolve at its exact reviewed version, source screen and verified turn fact, with the accepted choice bound to that fact and separate pre-launch review.' }));
}
export function assertSceneContexts(pack: LessonContentPack, resolve = registeredResolver) {
  if (getSceneContextGaps(pack, resolve).length) throw new Error('Invalid versioned scene context or answer binding');
}
export function getLaunchSceneReviews(pack: LessonContentPack, resolve = registeredResolver) {
  const seen = new Set<string>();
  return pack.screens.flatMap(s => {
    const source = getSceneContext(pack, s, resolve);
    if (!source) return [];
    const key = `${source.pack.recordId}/${source.pack.contentVersion}/${source.screen.screenId}`;
    if (seen.has(key)) return [];
    seen.add(key); return [source];
  });
}
