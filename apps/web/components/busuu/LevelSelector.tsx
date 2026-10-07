'use client';

import { useRef, type KeyboardEvent } from 'react';
import Link from 'next/link';
import type { CourseLevelId } from '@/lib/busuu/types';
import styles from '@/app/busuu/busuu.module.css';

type Choice = { id: CourseLevelId; name: string; chapterCount: number };
export default function LevelSelector({ current, choices, percent }: { current: CourseLevelId; choices: Choice[]; percent?: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = choices.find(c => c.id === current)!;
  function close() { dialog.current?.close(); trigger.current?.focus(); }
  function containFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
    const first = controls[0];
    const last = controls[controls.length - 1];
    const focused = event.currentTarget.ownerDocument.activeElement;
    if (event.shiftKey && focused === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && focused === last) { event.preventDefault(); first?.focus(); }
  }
  return <>
    <button ref={trigger} type="button" className={styles.levelButton} aria-haspopup="dialog" aria-controls="course-level-dialog"
      onClick={() => dialog.current?.showModal()}>
      <svg className={styles.levelIcon} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 6h12M9 12h12M9 18h12" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></svg>
      <span>{selected.name} {current}</span>{percent !== undefined && <span className={styles.levelProgress}>· {percent}%</span>}
      <span className={styles.chevron} aria-hidden="true">⌄</span>
    </button>
    <dialog ref={dialog} id="course-level-dialog" className={styles.selectorDialog} aria-labelledby="level-dialog-title"
      onKeyDown={containFocus}
      onClose={() => trigger.current?.focus()}
      onClick={e => { if (e.target === dialog.current) close(); }}>
      <div className={styles.dialogHeading}>
        <span className={styles.japanMark} aria-hidden="true"><span /></span>
        <h2 id="level-dialog-title">Complete Japanese</h2>
        <button className={styles.closeButton} type="button" onClick={close} aria-label="Close level selector" autoFocus>×</button>
      </div>
      <p className={styles.dialogIntro}>Choose your course level</p>
      <ol className={styles.levelChoices}>
        {choices.map((c, index) => <li key={c.id}>
          <Link href={`/busuu/${c.id}`} className={`${styles.levelChoice} ${c.id === current ? styles.currentLevel : ''}`}
            aria-current={c.id === current ? 'page' : undefined} onClick={close}>
            <span className={styles.levelMarker} aria-hidden="true">{index + 1}</span>
            <span><strong>{c.name} {c.id}</strong><span className={styles.choiceCaption}>{c.chapterCount} chapters</span></span>
            {c.id === current && <span className={styles.currentLabel}>Current</span>}
          </Link>
        </li>)}
      </ol>
    </dialog>
  </>;
}
