'use client';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { KanjiAnimator } from '@/lib/kanji-animator/src';
import { kanjiRuntime } from '@/lib/busuu/kanji-animation';
import { initialKanjiSync, onKanjiPress, onKanjiStatus, type KanjiSyncAction } from '@/lib/busuu/kanji-playback-sync';
import styles from '@/app/busuu/runner.module.css';

// Ink and contour follow the tile's text colour (`currentColor`); the outline stays subtle so the unfilled shape reads on the primary colour.
const INK = { size: 200, fillColor: 'currentColor', outlineColor: 'currentColor', outlineOpacity: 0.6, outlineWidth: 0.9, backgroundColor: 'transparent' } as const;
const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

type Slot<T> = MutableRefObject<T>;
/** Runs a sync action on the engine, or remembers a start request until the geometry is ready (a pause cancels it). */
function applyAction(player: Slot<KanjiAnimator | null>, pending: Slot<KanjiSyncAction>, action: KanjiSyncAction) {
  if (!action) return;
  const current = player.current;
  if (!current) { pending.current = action === 'pause' ? null : action; return; }
  try { if (action === 'restart') current.restart(); else if (action === 'finish') current.finish(); else current.pause(); } catch { /* destroyed mid-call */ }
}

/**
 * The kanji tile. It always renders the character as `lang="ja"` text: that text is the visible glyph until stroke data for this
 * character is ready, and stays as visually hidden text afterwards. Unsupported characters, a missing manifest or any load failure
 * simply keep the static glyph. `status` is the readings player's status and `pressCount` counts presses of its toggle (see
 * lib/busuu/kanji-playback-sync.ts); `standalone` plays the animation once on its own when there is no usable player.
 */
export default function KanjiAnimation({ character, status, pressCount, standalone }: { character: string; status: string; pressCount: number; standalone: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<KanjiAnimator | null>(null);
  const sync = useRef(initialKanjiSync());
  const pending = useRef<KanjiSyncAction>(null);
  const latest = useRef({ status, standalone });
  const [animated, setAnimated] = useState(false);

  useEffect(() => { latest.current = { status, standalone }; });

  // Latest character wins: one engine per character, created only after its geometry is known to exist.
  useEffect(() => {
    let cancelled = false;
    let created: KanjiAnimator | null = null;
    const first = onKanjiStatus(initialKanjiSync(), latest.current.status, reducedMotion());
    sync.current = first.sync;
    pending.current = first.action;
    (async () => {
      try {
        if (!(await kanjiRuntime.supported()).has(character)) return;
        const [engine, loader] = await Promise.all([kanjiRuntime.engine(), kanjiRuntime.loader()]);
        if (cancelled || !host.current) return;
        created = new engine.KanjiAnimator(host.current, { character, loader, autoplay: false, style: INK });
        await created.ready;
        if (cancelled) return;
        created.svg.setAttribute('aria-hidden', 'true');
        created.svg.removeAttribute('role');
        created.svg.querySelector('title')?.remove(); // no hover tooltip
        player.current = created;
        setAnimated(true);
        if (latest.current.standalone) pending.current = reducedMotion() ? 'finish' : 'restart';
        const action = pending.current; pending.current = null;
        applyAction(player, pending, action);
      } catch { created?.destroy(); created = null; /* the static glyph stays */ }
    })();
    return () => { cancelled = true; player.current = null; pending.current = null; created?.destroy(); setAnimated(false); };
  }, [character]);

  // Appended after the character effect and ordered press -> status so a press is handled before the status change it causes.
  useEffect(() => {
    if (pressCount === 0) return;
    const next = onKanjiPress(sync.current);
    sync.current = next.sync;
    applyAction(player, pending, next.action);
  }, [pressCount]);
  useEffect(() => {
    const next = onKanjiStatus(sync.current, status, reducedMotion());
    sync.current = next.sync;
    applyAction(player, pending, next.action);
  }, [status]);

  return <div lang="ja" className={styles.kanjiTile} data-animated={animated ? 'true' : undefined}>
    <span className={styles.kanjiText}>{character}</span>
    <div ref={host} className={styles.kanjiAnimation} aria-hidden="true" />
  </div>;
}
