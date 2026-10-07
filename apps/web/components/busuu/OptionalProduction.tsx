'use client';
import { useState } from 'react';
import type { OptionalProductionSurface } from '@/lib/busuu/types';
import { mixed } from './mixed-text';
import styles from '@/app/busuu/runner.module.css';

// Private, ungraded writing practice. It emits no course events and nothing is saved or sent.
export default function OptionalProduction({ surface }: { surface: OptionalProductionSurface }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  return <section className={styles.optionalPractice} aria-label="Optional production practice">
    <h2>Optional free writing</h2>
    <p>{mixed(surface.prompt)}</p>
    <p className={styles.caption}>This practice is private and ungraded. It does not affect your lesson result.</p>
    <button type="button" className={styles.secondaryButton} aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? 'Close optional writing' : 'Write a draft'}</button>
    <details className={styles.hint}><summary>Show construction hint</summary><p>{mixed(surface.hint)}</p></details>
    {open && <><label htmlFor={`draft-${surface.screenId}`}>Your Japanese draft</label>
      <textarea id={`draft-${surface.screenId}`} lang="ja" value={draft} onChange={event => setDraft(event.target.value)} />
      <p className={styles.caption}>Use your device’s Japanese keyboard. Your draft stays on this page while it is open and is not saved or shared.</p></>}
  </section>;
}
