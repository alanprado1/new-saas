'use client';
import { useRef, useState, type Dispatch } from 'react';
import { canCheckTyped, isTypedCheckKey } from '@/lib/busuu/typed-input';
import { getCurrentOutcome, getTokenBank, type LessonAction, type LessonState } from '@/lib/busuu/runner';
import { getPreAnswerSupport, groupScaffold } from '@/lib/busuu/lesson-presentation';
import { isTeachingScreen } from '@/lib/busuu/content-readiness';
import type { LessonContentScreen, PairItem, SupportBlock } from '@/lib/busuu/types';
import { mixed } from './mixed-text';
import styles from '@/app/busuu/runner.module.css';

export function Support({ blocks }: { blocks: SupportBlock[] }) {
  // Consecutive Japanese/translation blocks read as one example card; explanations stand alone.
  const groups: SupportBlock[][] = [];
  for (const block of blocks) {
    const last = groups.at(-1);
    if (block.kind !== 'explanation' && last && last[0].kind !== 'explanation') last.push(block); else groups.push([block]);
  }
  return <>{groups.map((group, g) => group[0].kind === 'explanation'
    ? <div key={g} className={styles.explanation}>
      <p lang="en" className={styles.explanationText}>{mixed(group[0].text)}</p>
      {group[0].secondary && <p lang="ja" className={styles.reading}>{group[0].secondary}</p>}
    </div>
    : <div key={g} className={styles.exampleCard}>{group.map((block, i) => <div key={`${block.kind}-${i}`}>
      <p lang={block.kind === 'japanese' ? 'ja' : 'en'} className={block.kind === 'japanese' ? styles.japanese : styles.translation}>{block.kind === 'japanese' ? block.text : mixed(block.text)}</p>
      {block.secondary && <p lang="ja" className={styles.reading}>{block.secondary}</p>}
    </div>)}</div>)}</>;
}
function ItemText({ item }: { item: PairItem }) {
  const japanese = /[　-鿿]/.test(item.text);
  return <><span lang={japanese ? 'ja' : 'en'} className={japanese ? styles.itemJapanese : styles.itemEnglish}>{item.text}</span>{item.secondary && <span lang="ja" className={styles.reading}>{item.secondary}</span>}</>;
}
function Badge({ n }: { n: number }) {
  return n >= 1 && n <= 9 ? <span className={styles.badge} aria-hidden="true">{n}</span> : null;
}
export function Dialogue({ screen }: { screen: LessonContentScreen }) {
  const dialogue = screen.dialogue;
  if (!dialogue) return null;
  const labels = dialogue.speakerLabels ?? { guest: 'Guest', staff: 'Staff' };
  const description = dialogue.kind === 'single_speaker' ? `${labels[dialogue.speakers[0]]} scene` : `${labels.guest} and ${labels.staff} dialogue`;
  return <section className={styles.dialogue} aria-label={description}>
    {dialogue.context && <p className={styles.caption}>{dialogue.context}</p>}
    {dialogue.turns.length ? <ol>{dialogue.turns.map(turn => <li key={turn.id}>
      <strong>{labels[turn.speaker]}</strong>
      {dialogue.japaneseVisible && screen.sourceContract?.transcriptBeforeAnswer !== false && <p lang="ja" className={styles.japanese}>{turn.japanese ?? 'Japanese turn unavailable'}</p>}
      {dialogue.translationVisible !== false && screen.sourceContract?.translationBeforeAnswer !== false && <p lang="en" className={styles.translation}>{turn.english ?? 'English dialogue support unavailable'}</p>}
    </li>)}</ol> : <p>Speaker turns are unavailable.</p>}
    {dialogue.japaneseVisible && screen.sourceContract?.transcriptBeforeAnswer !== false && dialogue.glosses &&
      <dl aria-label="Vocabulary">{dialogue.glosses.map(gloss => <div key={gloss.japanese}>
        <dt lang="ja">{gloss.japanese}（{gloss.reading}）</dt><dd lang="en">{gloss.english}</dd>
      </div>)}</dl>}
  </section>;
}
export function TypedAnswer({ screen, state, dispatch }: { screen: LessonContentScreen; state: LessonState; dispatch: Dispatch<LessonAction> }) {
  const composition = useRef(false), [composing, setComposing] = useState(false);
  const value = state.typedDraft ?? '', locked = state.phase !== 'response';
  const outcome = state.phase === 'feedback' ? getCurrentOutcome(state) : undefined;
  // Playback is optional (Busuu allows answering without playing); Check depends only on committed, non-empty text.
  const check = () => { if (!locked && canCheckTyped(value, composition.current)) dispatch({ type: 'typed_check', screenId: screen.screenId }); };
  return <div className={styles.typedAnswer}>
    <label htmlFor={`typed-${screen.screenId}`} className={styles.srOnly}>{screen.typed!.label}</label>
    <div className={`${styles.typedSentence} ${outcome ? outcome.correct ? styles.correct : styles.incorrect : ''}`}><span lang="ja">{screen.typed!.before}</span>
      <input id={`typed-${screen.screenId}`} lang="ja" value={value} maxLength={100} disabled={locked} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Type here"
        onChange={e => dispatch({ type: 'typed_draft', screenId: screen.screenId, text: e.target.value })}
        onCompositionStart={() => { composition.current = true; setComposing(true); }}
        onCompositionEnd={e => { composition.current = false; setComposing(false); dispatch({ type: 'typed_draft', screenId: screen.screenId, text: e.currentTarget.value }); }}
        onKeyDown={e => { if (isTypedCheckKey(e.nativeEvent, composition.current)) { e.preventDefault(); check(); } }} />
      <span lang="ja">{screen.typed!.after}</span></div>
    <div className={`${styles.dock} ${locked ? styles.dockHidden : ''}`}>
      <button type="button" className={styles.primary} data-primary-action="" disabled={locked || !canCheckTyped(value, composing)} onClick={check}>Check</button>
    </div>
  </div>;
}
export default function LessonScreen({ screen, state, dispatch }: {
  screen: LessonContentScreen; state: LessonState; dispatch: Dispatch<LessonAction>;
}) {
  const answer = screen.answer;
  const answered = state.phase === 'feedback';
  const disabled = state.phase !== 'response';
  const outcome = answered ? getCurrentOutcome(state) : undefined;
  const choiceClass = (selected: boolean, correct: boolean) => `${styles.option} ${answered && selected ? correct ? styles.correct : styles.incorrect : ''}`;
  const selectedIds = state.selectedOptionIds ?? [];
  const pickMulti = (id: string, requiredCount: number) => {
    dispatch({ type: 'toggle_option', screenId: screen.screenId, id });
    // Busuu grades as soon as the last required answer is picked. Same two events as a separate Check, in sequence.
    if (!selectedIds.includes(id) && selectedIds.length + 1 === requiredCount) dispatch({ type: 'selection_check', screenId: screen.screenId });
  };
  const bank = (label: string) => answer && (answer.kind === 'ordered_slots' || answer.kind === 'ordered_tokens') && <div className={styles.tokenBank} aria-label={label}>
    {answer.tokens.map((item, n) => {
      const available = getTokenBank(screen, state).some(t => t.id === item.id);
      // A used token leaves a same-size grey placeholder, so nothing reflows under the learner's finger.
      return <button key={item.id} type="button" lang="ja" disabled={disabled || !available} data-shortcut={available && n < 9 ? n + 1 : undefined} aria-keyshortcuts={available && n < 9 ? String(n + 1) : undefined}
        className={`${styles.token} ${available ? '' : styles.usedToken}`} aria-label={`${item.text}${available ? '' : ', placed'}`}
        onClick={() => dispatch({ type: 'token', screenId: screen.screenId, id: item.id })}>{item.text}{available && <Badge n={n + 1} />}</button>;
    })}
  </div>;
  return <section className={`${styles.activity} ${isTeachingScreen(screen) ? styles.teaching : ''}`} aria-label={`${screen.renderer} activity`} data-activity="">
    <Support blocks={getPreAnswerSupport(screen)} />
    {screen.renderer === 'kanji' && screen.kanji && <section className={styles.kanjiModel} aria-label="Kanji shape, readings and examples">
      <div lang="ja" className={styles.kanjiGlyph}>{screen.kanji.character}</div>
      <p>{mixed(screen.kanji.shapeNote)}</p><p><strong>Meaning:</strong> {mixed(screen.kanji.meaning)}</p>
      <ul>{screen.kanji.readings.map(r => <li key={r.text}><strong lang="ja">{r.text}</strong> — {mixed(r.note)}</li>)}</ul>
      {screen.kanji.examples.map(e => <div key={e.word} className={styles.kanjiExample}>
        <p><strong lang="ja">{e.word}</strong> <span lang="ja">（{e.reading}）</span> · {mixed(e.meaning)}</p>
        <p lang="ja" className={styles.japanese}>{e.sentence}</p><p lang="ja" className={styles.reading}>{e.sentenceReading}</p><p className={styles.translation}>{mixed(e.translation)}</p>
      </div>)}
    </section>}
    {screen.renderer === 'typed' && screen.answer?.kind === 'typed' && screen.typed && <TypedAnswer key={screen.screenId} screen={screen} state={state} dispatch={dispatch} />}
    {screen.hint && !screen.sceneContext && <details className={styles.hint}><summary>Show hint</summary><p>{mixed(screen.hint.text ?? 'Hint text unavailable in retained evidence.')}</p></details>}
    {screen.renderer === 'table' && screen.table && <div className={styles.tableWrapper}>
      <table className={styles.explanationTable}>{screen.table.caption && <caption>{mixed(screen.table.caption)}</caption>}
        <thead><tr>{screen.table.columns.map((c, i) => <th key={i} scope="col">{mixed(c)}</th>)}</tr></thead>
        <tbody>{screen.table.rows.length ? screen.table.rows.map(r => <tr key={r.id}>{r.cells.map((c, i) => <td key={i} data-label={screen.table!.columns[i]}>{c === null ? 'Text unavailable' : mixed(c)}</td>)}</tr>) :
          <tr><td colSpan={screen.table.columns.length}>Recorded contrast: humble/self versus respectful/other. Table examples and row order unavailable.</td></tr>}</tbody>
      </table>
    </div>}
    {screen.renderer === 'dialogue' && !screen.sceneContext && <Dialogue screen={screen} />}
    {state.preview && !answer && ['gaps', 'pairs', 'truth', 'choice'].includes(screen.renderer) && <div className={styles.partialResponse}>
      {screen.renderer === 'gaps' && Array.from({ length: screen.sourceContract?.responseSlotCount ?? 0 }, (_, i) =>
        <button key={i} type="button" disabled aria-label={`Response gap ${i + 1}, content unavailable`} className={styles.gap}>…</button>)}
      {screen.renderer === 'pairs' && <p>{screen.sourceContract?.responseSlotCount ?? 'Unknown number of'} pairs recorded · actor/predicate text and mappings unavailable.</p>}
      {['choice', 'truth'].includes(screen.renderer) && <p>Response options and answer key unavailable.</p>}
    </div>}
    {screen.statement && <p className={styles.statement}>{mixed(screen.statement)}</p>}
    {screen.renderer === 'truth' && answer?.kind === 'truth' && <div className={styles.truthChoices}>
      {[true, false].map((value, n) => <button key={String(value)} type="button" disabled={disabled} aria-pressed={state.selectedChoice === value}
        data-shortcut={n + 1} aria-keyshortcuts={String(n + 1)}
        className={choiceClass(state.selectedChoice === value, value === answer.accepted)}
        onClick={() => dispatch({ type: 'truth', screenId: screen.screenId, value })}><span className={styles.itemEnglish}>{value ? 'True' : 'False'}</span><Badge n={n + 1} /></button>)}
    </div>}
    {screen.renderer === 'choice' && answer?.kind === 'choice' && <div className={styles.sentenceChoices}>
      {answer.options.map((item, n) => <button key={item.id} type="button" disabled={disabled} aria-pressed={state.selectedChoice === item.id}
        data-shortcut={n + 1} aria-keyshortcuts={n < 9 ? String(n + 1) : undefined}
        className={choiceClass(state.selectedChoice === item.id, answer.acceptedOptionIds.includes(item.id))}
        onClick={() => dispatch({ type: 'choice', screenId: screen.screenId, id: item.id })}><ItemText item={item} /><Badge n={n + 1} /></button>)}
    </div>}
    {screen.renderer === 'multi_choice' && answer?.kind === 'multi_choice' && <div className={styles.sentenceChoices}>
      <p className={styles.countHint} role="status">{selectedIds.length} of {answer.requiredCount} selected</p>
      {answer.options.map((item, n) => {
        const selected = selectedIds.includes(item.id);
        return <button key={item.id} type="button" disabled={disabled} aria-pressed={selected}
          data-shortcut={n + 1} aria-keyshortcuts={n < 9 ? String(n + 1) : undefined}
          className={`${choiceClass(selected, answer.acceptedOptionIds.includes(item.id))} ${selected && !answered ? styles.selected : ''}`}
          onClick={() => pickMulti(item.id, answer.requiredCount)}>{selected && <span className={styles.checkMark} aria-hidden="true" />}<ItemText item={item} /><Badge n={n + 1} /></button>;
      })}
    </div>}
    {screen.renderer === 'pairs' && answer?.kind === 'pairs' && <div className={styles.pairGrid}>
      {(['left', 'right'] as const).map(side => <div key={side} className={styles.pairColumn} role="group" aria-label={side === 'left' ? 'First column' : 'Second column'}>
        {(side === 'left' ? screen.left ?? [] : screen.right ?? []).map((item, i) => {
          const matched = answer.pairs.some(p => state.matches.includes(p.id) && (side === 'left' ? p.leftId : p.rightId) === item.id);
          const selected = state.endpoint?.side === side && state.endpoint.id === item.id;
          const number = (side === 'left' ? 0 : (screen.left?.length ?? 0)) + i + 1;
          // Matched pairs stay where they are (no reordering under the finger); they simply turn green.
          return <button key={`${side}-${item.id}`} type="button" disabled={disabled || matched} aria-pressed={selected}
            data-shortcut={matched ? undefined : number} aria-keyshortcuts={!matched && number <= 9 ? String(number) : undefined}
            aria-label={`${side === 'left' ? 'Left item' : 'Right item'}: ${item.text}${matched ? ', matched' : ''}`}
            className={`${styles.pairTile} ${matched ? styles.correct : ''} ${selected ? styles.selected : ''}`}
            onClick={() => dispatch({ type: 'pair', screenId: screen.screenId, side, id: item.id })}><ItemText item={item} />{!matched && <Badge n={number} />}</button>;
        })}
      </div>)}
    </div>}
    {screen.renderer === 'gaps' && answer?.kind === 'ordered_slots' && <>
      <p lang="ja" className={styles.scaffold}>{(() => {
        const parts = screen.scaffold ?? [];
        const { lead, trail, middle } = groupScaffold(parts, answer.slots.length);
        const active = answered ? -1 : state.slots.indexOf(null);
        return parts.map((_, i) => <span key={i}>{middle[i]}{i < answer.slots.length && (() => {
          const selected = state.slots[i];
          const item = answer.tokens.find(t => t.id === selected);
          const correct = selected !== null && answer.slots[i]?.acceptedTokenIds.includes(selected);
          return <span className={styles.noBreak}>{trail[i]}<button type="button" disabled={disabled || !item}
            className={`${styles.gap} ${item ? styles.filledGap : ''} ${i === active ? styles.activeGap : ''} ${answered ? correct ? styles.correct : styles.incorrect : ''}`}
            aria-label={item ? `Remove ${item.text} from gap ${i + 1}` : `Gap ${i + 1}, empty`}
            onClick={() => dispatch({ type: 'remove_token', screenId: screen.screenId, slot: i })}>{item?.text ?? ''}</button>{lead[i + 1]}</span>;
        })()}</span>);
      })()}</p>
      {bank('Available words')}
    </>}
    {screen.renderer === 'ordering' && answer?.kind === 'ordered_tokens' && <>
      <div className={`${styles.answerBox} ${answered && !outcome?.correct ? styles.incorrect : ''}`} aria-label="Your sentence">
        {screen.fixedPrefix && <span lang="ja" className={styles.fixedPrefix} aria-label={`Supplied start: ${screen.fixedPrefix}`}>{screen.fixedPrefix}</span>}
        {state.slots.map((id, i) => {
          const item = answer.tokens.find(t => t.id === id);
          // Placed chunks only. Ordering has several accepted orders, so there is no per-position correctness: green only when the whole answer is right.
          return item ? <button key={i} type="button" lang="ja" disabled={disabled}
            className={`${styles.chip} ${answered && outcome?.correct ? styles.correct : ''}`}
            aria-label={`Remove ${item.text} from position ${i + 1}`}
            onClick={() => dispatch({ type: 'remove_token', screenId: screen.screenId, slot: i })}>{item.text}</button> : null;
        })}
        {!state.slots.some(Boolean) && !screen.fixedPrefix && <span className={styles.srOnly}>No chunks placed yet</span>}
      </div>
      {bank('Available chunks')}
    </>}
    {state.notice && <p className={styles.notice} role="status">{state.notice}</p>}
  </section>;
}
