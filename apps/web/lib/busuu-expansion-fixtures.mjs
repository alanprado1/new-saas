// Test-only material to exercise the recorded structures. NEVER import into runtime content or display as Busuu copy.
import fs from 'node:fs';
export function completeExpansionFixture(lesson) {
  const pack = JSON.parse(fs.readFileSync(new URL(`../content/busuu/b2-c01-${lesson}.v1.json`, import.meta.url)));
  pack.status = 'reviewed'; pack.provenance.note = 'TEST FIXTURE: all literal text and answer mappings are synthetic.';
  for (const s of pack.screens) {
    s.prompt = 'Test fixture instruction'; s.unresolved = []; s.praise = 'Fixture correct';
    s.audio.text = s.audio.required ? 'テストです。' : null;
    s.support = { before: [], after: [{ kind: 'explanation', text: 'Fixture feedback explanation.' }] };
    if (s.sourceContract.transcriptBeforeAnswer === true || s.renderer === 'model' || s.renderer === 'truth') s.support.before.push({ kind: 'japanese', text: 'テストです。' });
    if (s.sourceContract.parallelReadingBeforeAnswer) s.support.before.find(b => b.kind === 'japanese').secondary = '試験です。';
    if (s.sourceContract.translationBeforeAnswer === true && s.renderer !== 'dialogue') s.support.before.push({ kind: 'translation', text: 'A test.' });
    if (s.renderer === 'gaps') {
      const count = s.sourceContract.responseSlotCount;
      s.scaffold = ['テスト', ...Array.from({ length: count }, () => '。')];
      s.answer = { kind: 'ordered_slots', slots: Array.from({ length: count }, (_, i) => ({ id: `gap-${i}`, acceptedTokenIds: [`t${i}`] })),
        tokens: Array.from({ length: count + 1 }, (_, i) => ({ id: `t${i}`, text: `テスト${i}` })) };
    } else if (s.renderer === 'pairs') {
      s.left = [{ id: 'l1', text: 'Fixture self' }, { id: 'l2', text: 'Fixture other' }];
      s.right = [{ id: 'r2', text: 'Fixture respectful' }, { id: 'r1', text: 'Fixture humble' }];
      s.answer = { kind: 'pairs', pairs: [{ id: 'p1', leftId: 'l1', rightId: 'r1' }, { id: 'p2', leftId: 'l2', rightId: 'r2' }] };
    } else if (s.renderer === 'truth') { s.statement = 'Fixture supported statement'; s.answer = { kind: 'truth', accepted: true }; }
    else if (s.renderer === 'choice') s.answer = { kind: 'choice', options: [{ id: 'yes', text: 'Fixture correct option' }, { id: 'no', text: 'Fixture distractor' }], acceptedOptionIds: ['yes'] };
    else if (s.renderer === 'table') s.table = { caption: 'Fixture table', columns: ['Actor', 'Form'], rows: [{ id: 'self', cells: ['Self', 'Humble fixture'] }, { id: 'other', cells: ['Other', 'Respectful fixture'] }] };
    else if (s.renderer === 'dialogue') s.dialogue = { japaneseVisible: false, speakers: ['guest', 'staff'], turns: [
      { id: 'guest-1', speaker: 'guest', japanese: 'こんにちは。', english: 'Fixture guest greeting.' },
      { id: 'staff-1', speaker: 'staff', japanese: 'どうぞ。', english: 'Fixture staff reply.' },
    ] };
    if (s.hint) s.hint.text = 'Fixture pre-answer hint';
  }
  return pack;
}
export function correctActions(s) {
  if (s.answer?.kind === 'choice') return [{ type: 'choice', id: 'yes' }];
  if (s.answer?.kind === 'truth') return [{ type: 'truth', value: true }];
  if (s.answer?.kind === 'pairs') return [{ type: 'pair', side: 'left', id: 'l1' }, { type: 'pair', side: 'right', id: 'r1' }, { type: 'pair', side: 'left', id: 'l2' }, { type: 'pair', side: 'right', id: 'r2' }];
  if (s.answer?.kind === 'ordered_slots') return s.answer.slots.map((_, i) => ({ type: 'token', id: `t${i}` }));
  return [];
}
