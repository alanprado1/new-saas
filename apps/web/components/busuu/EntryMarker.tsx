import type { EntryVariant } from '@/lib/busuu/map-presentation';
import type { RowStatus } from '@/lib/busuu/progress';
import styles from '@/app/busuu/busuu.module.css';

// Progress ring around a neutral, replaceable avatar. No screenshot is repurposed as a lesson asset;
// original lesson art can replace the placeholders later.
const RADIUS = 37.5;
function Avatar({ variant, glyph }: { variant: EntryVariant; glyph: string | null }) {
  if (variant === 'kanji') return <span className={`${styles.avatar} ${styles.avatarKanji}`} lang="ja">{glyph}</span>;
  const common = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  if (variant === 'checkpoint' || variant === 'certificate') return <span className={`${styles.avatar} ${styles.avatarCheckpoint}`}>
    <svg {...common}>{variant === 'certificate' ? <><circle cx="16" cy="13" r="8" /><path d="m11 20-2 8 7-4 7 4-2-8" /></> : <path d="M8 29V4m0 1h17l-4 6 4 6H8" fill="currentColor" />}</svg></span>;
  if (variant === 'fluency') return <span className={`${styles.avatar} ${styles.avatarFluency}`}>
    <svg {...common}><path d="M5 6h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 5v-5H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" /><path d="M25 12h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2v4l-4-4" /></svg></span>;
  return <span className={`${styles.avatar} ${styles.avatarLesson}`}>
    <svg {...common}><circle cx="16" cy="11" r="5" /><path d="M5 28c0-7 5-10 11-10s11 3 11 10" /></svg></span>;
}

export default function EntryMarker({ variant, glyph = null, status, fraction }: { variant: EntryVariant; glyph?: string | null; status: RowStatus; fraction: number }) {
  return <span className={styles.ring} aria-hidden="true">
    <svg viewBox="0 0 90 90">
      <circle className={styles.ringTrack} cx="45" cy="45" r={RADIUS} />
      {fraction > 0 && <circle className={styles.ringArc} cx="45" cy="45" r={RADIUS} pathLength={100} strokeDasharray={`${Math.round(fraction * 1000) / 10} 100`} />}
    </svg>
    <Avatar variant={variant} glyph={glyph} />
    {status === 'completed' && <span className={styles.doneBadge}>
      <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m3.5 8.5 3 3 6-7" /></svg>
    </span>}
  </span>;
}
