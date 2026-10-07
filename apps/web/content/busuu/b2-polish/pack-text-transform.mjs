#!/usr/bin/env node
// Deterministic B2 pack-text polish (owner-approved 8 October 2026): builds the NEXT content version of every B2 pack whose
// learner-visible text changes. Predecessors are never modified.
//
//   node content/busuu/b2-polish/pack-text-transform.mjs            dry run: prints the plan and per-check counts
//   node content/busuu/b2-polish/pack-text-transform.mjs --write    writes the new version files + pack-text-changes.{md,json}
//   node content/busuu/b2-polish/pack-text-transform.mjs --check    regenerates in memory and requires the files on disk to be byte-identical
//
// Run from apps/web. The predecessor of each record is its newest version in registered-fingerprints.json (the immutable pre-polish list).
// Mechanical transforms (all on learner text only): Australian spelling, curly apostrophes, praise string, first-letter case,
// prompt-template wording, reading-line spacing. Hand edits and exact substring replacements live in pack-text-rewrites.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globalSubs, screenEdits } from './pack-text-rewrites.mjs';

const root = path.resolve(import.meta.dirname, '..');
const here = import.meta.dirname;
const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'dry';
const baseline = JSON.parse(fs.readFileSync(path.join(here, 'registered-fingerprints.json'), 'utf8'));

// ------------------------------------------------------------------ helpers
const JA = /[぀-ヿ㐀-鿿]/;
const hasJa = s => JA.test(s);
const keepCase = (m, to) => (m[0] !== m[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to);

// ------------------------------------------------------------------ Australian English
const STEM_RULES = [
  ['color', 'colour', 's|ed|ful|ing|less'], ['favor', 'favour', 's|ed|ing|ite|ites'], ['flavor', 'flavour', 's|ed|ing|ful|ings'],
  ['behavior', 'behaviour', 's|al'], ['honor', 'honour', 's|ed|ing|able'], ['neighbor', 'neighbour', 's|ing|hood|hoods'], ['humor', 'humour', 's'],
  ['labor', 'labour', 's|ed|ing'], ['harbor', 'harbour', 's'], ['rumor', 'rumour', 's'], ['center', 'centre', 's|ed'], ['theater', 'theatre', 's'],
  ['defense', 'defence', ''], ['offense', 'offence', ''], ['pretense', 'pretence', ''], ['gray', 'grey', ''], ['jewelry', 'jewellery', ''],
  ['skillful', 'skilful', 'ly'], ['judgment', 'judgement', 's'], ['enrollment', 'enrolment', 's'], ['fulfill', 'fulfil', 's'], ['catalog', 'catalogue', 's'],
  ['dialog', 'dialogue', 's'], ['analyze', 'analyse', 's|d'], ['traveling', 'travelling', ''], ['traveled', 'travelled', ''], ['traveler', 'traveller', 's'],
  ['canceled', 'cancelled', ''], ['canceling', 'cancelling', ''], ['labeled', 'labelled', ''], ['modeled', 'modelled', ''], ['aluminum', 'aluminium', ''], ['pajamas', 'pyjamas', ''],
];
const IZE_STEMS = 'emphasi|recogni|nominali|normali|romani|organi|apologi|authori|equali|summari|memori|reali|civili|categori|capitali|standardi|familiari|prioriti|critici|minimi|maximi|visuali|generali|personali|customi|sympathi|utili|specifi';
const SPELLING = [
  ...STEM_RULES.map(([us, au, suffixes]) => [new RegExp(`\\b${us}(${suffixes})?\\b`, 'gi'), m => keepCase(m, au + m.slice(us.length))]),
  [new RegExp(`\\b(${IZE_STEMS})z(e|es|ed|ing|ation|ations|er|ers)\\b`, 'gi'), (m, stem, end) => keepCase(m, `${stem.toLowerCase()}s${end}`)],
  [/\benroll(s)?\b/gi, m => keepCase(m, `enrol${m.slice(6)}`)],
];
export function australian(text) {
  let out = text;
  for (const [re, fn] of SPELLING) out = out.replace(re, fn);
  return out;
}
export const curlyApostrophes = text => text.replace(/(?<=[A-Za-z])'(?=[A-Za-z])/g, '’');

// ------------------------------------------------------------------ prompt-template wording (renderer-aware, task content untouched)
const IMPERATIVE = 'Insert|Build|Type|Supply|Complete|Choose|Select|Match|Reconstruct|Place|Arrange|Fill|Write';
const lowerFirst = s => s[0].toLowerCase() + s.slice(1);
export const PROMPT_RULES = [
  ['check-instruction', ['typed', 'multi_choice'], p => p.replace(/,? (?:then |and )select Check(?=[.!?])/g, '')],
  ['typed-verb', ['typed'], p => p.replace(/^((?:Listen[.]? (?:and )?)?)Write\b/, (m, lead) => `${lead}Type`)],
  ['romaji-wording', ['typed'], p => p.replace(/\bthe reviewed romaji form\b/g, 'romaji').replace(/\bor (?:the )?romanization\b/g, 'or romaji')],
  ['listen-prefix', ['gaps', 'ordering', 'typed', 'choice', 'pairs', 'multi_choice'], p => p
    .replace(/^Listen (?:carefully|again if needed) and /, 'Listen and ')
    .replace(new RegExp(`^Listen\\. (${IMPERATIVE})\\b`), (m, v) => `Listen and ${lowerFirst(v)}`)],
  ['ordering-verb', ['ordering'], p => p.replace(/^(Listen and )?(?:arrange|reconstruct)\b/i, (m, lead) => `${lead ?? ''}${lead ? 'build' : 'Build'}`)],
  ['kanji-prompt', ['kanji'], p => p.replace(/^Learn (.+) and its contextual readings\.$/, 'Study $1: shape, readings and words in context.')],
  ['pairs-wording', ['pairs'], p => p.replace(/^Match each compound with its\b/, 'Match each compound to its')],
];
// Kanji screens carried an explanation block that only said the static note "replaces source animation" plus a shape/etymology disclaimer.
// The block has no teaching value for a learner, so it is removed (the kanji model itself is unchanged).
export const KANJI_DISCLAIMER_BLOCKS = new Set([
  'This complete static kanji model replaces source animation. Shape notes are visual memory aids, not stroke-order instructions or etymology.',
  'This complete static model replaces source animation. Shape comparisons are memory aids, not stroke-order instructions or etymology.',
]);
const capitaliseFirst = p => p.replace(/^[a-z]/, c => c.toUpperCase());

// ------------------------------------------------------------------ katakana in reading lines
// A visible reading line keeps katakana words in katakana; only kanji get hiragana. Existing C02-C10 readings spelled katakana words in hiragana.
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
export const katakanaRuns = surface => surface.match(/[ァ-ヶー]*[ァ-ヶ][ァ-ヶー]*/g) ?? [];
export const missingKatakana = (surface, reading) => katakanaRuns(surface).filter(run => !reading.includes(run));
// Aligns the reading against its Japanese surface (kana and punctuation must match literally, a run of kanji/digits/latin stands for 1+ reading characters per
// character) and puts the surface katakana back at the aligned reading positions. Returns status ok | restored | nomatch | ambiguous (never guesses).
export function restoreKatakana(surface, reading) {
  if (!missingKatakana(surface, reading).length) return { status: 'ok', text: reading };
  const tokens = [];
  for (const ch of surface) {
    if (/[ぁ-ゖァ-ヶー]/.test(ch)) tokens.push({ kind: 'kana', lit: toHira(ch), src: ch });
    else if (/[㐀-䶿一-鿿々〆A-Za-z0-9０-９Ａ-Ｚａ-ｚ]/.test(ch)) { const last = tokens.at(-1); if (last?.kind === 'unk') last.len++; else tokens.push({ kind: 'unk', len: 1 }); }
    else tokens.push({ kind: 'punct', lit: ch });
  }
  const rl = Array.from(reading), n = tokens.length, m = rl.length;
  const same = (ri, lit) => ri < m && toHira(rl[ri]) === lit;
  const grid = () => Array.from({ length: n + 1 }, () => new Uint8Array(m + 2));
  const reach = grid(), back = grid();
  reach[0][0] = 1;
  for (let ti = 0; ti < n; ti++) for (let ri = 0; ri <= m; ri++) if (reach[ti][ri]) {
    const t = tokens[ti];
    if (t.kind === 'unk') { for (let k = t.len; ri + k <= m; k++) reach[ti + 1][ri + k] = 1; }
    else if (same(ri, t.lit)) reach[ti + 1][ri + 1] = 1;
  }
  if (!reach[n][m]) return { status: 'nomatch', text: reading };
  back[n][m] = 1;
  for (let ti = n - 1; ti >= 0; ti--) for (let ri = 0; ri <= m; ri++) {
    const t = tokens[ti];
    if (t.kind === 'unk') { for (let k = t.len; ri + k <= m; k++) if (back[ti + 1][ri + k]) { back[ti][ri] = 1; break; } }
    else if (same(ri, t.lit) && back[ti + 1][ri + 1]) back[ti][ri] = 1;
  }
  const out = [...rl];
  for (let ti = 0; ti < n; ti++) {
    const t = tokens[ti];
    if (t.kind !== 'kana' || !/[ァ-ヶ]/.test(t.src)) continue;
    const positions = [];
    for (let ri = 0; ri < m; ri++) if (reach[ti][ri] && same(ri, t.lit) && back[ti + 1][ri + 1]) positions.push(ri);
    if (positions.length !== 1) return { status: 'ambiguous', text: reading };
    out[positions[0]] = t.src;
  }
  return { status: 'restored', text: out.join('') };
}

// ------------------------------------------------------------------ learner-visible field enumeration
export function learnerFields(screen) {
  const out = [];
  const add = (type, p, obj, key, surface = null) => { if (obj && typeof obj[key] === 'string') out.push({ type, path: p, obj, key, surface }); };
  const en = (p, obj, key) => add('en', p, obj, key);
  const rd = (p, obj, key, surface) => add('rd', p, obj, key, typeof surface === 'string' ? surface : null);
  en('prompt', screen, 'prompt'); en('praise', screen, 'praise'); en('statement', screen, 'statement');
  if (screen.hint) en('hint.text', screen.hint, 'text');
  if (screen.typed) en('typed.label', screen.typed, 'label');
  for (const ph of ['before', 'after']) screen.support[ph].forEach((b, i) => {
    if (b.kind === 'japanese') rd(`support.${ph}[${i}].secondary`, b, 'secondary', b.text);
    else en(`support.${ph}[${i}].text`, b, 'text');
  });
  const d = screen.dialogue;
  if (d) {
    en('dialogue.context', d, 'context');
    for (const k of ['guest', 'staff']) en(`dialogue.speakerLabels.${k}`, d.speakerLabels, k);
    (d.turns || []).forEach((t, i) => en(`dialogue.turns[${i}].english`, t, 'english')); // turn `reading` is TTS-only and is left unchanged
    (d.glosses || []).forEach((g, i) => { en(`dialogue.glosses[${i}].english`, g, 'english'); rd(`dialogue.glosses[${i}].reading`, g, 'reading', g.japanese); });
  }
  const k = screen.kanji;
  if (k) {
    en('kanji.shapeNote', k, 'shapeNote'); en('kanji.meaning', k, 'meaning');
    k.readings.forEach((r, i) => en(`kanji.readings[${i}].note`, r, 'note'));
    k.examples.forEach((e, i) => { en(`kanji.examples[${i}].meaning`, e, 'meaning'); en(`kanji.examples[${i}].translation`, e, 'translation');
      rd(`kanji.examples[${i}].reading`, e, 'reading', e.word); rd(`kanji.examples[${i}].sentenceReading`, e, 'sentenceReading', e.sentence); });
  }
  const t = screen.table;
  if (t) {
    en('table.caption', t, 'caption'); t.columns.forEach((c, i) => en(`table.columns[${i}]`, t.columns, i));
    const readingColumn = t.columns.map(c => /^reading( in this example)?$/i.test(c.trim()));
    t.rows.forEach((r, ri) => r.cells.forEach((c, ci) => {
      if (readingColumn[ci]) { let surface = null; for (let j = ci - 1; j >= 0; j--) if (!readingColumn[j] && typeof r.cells[j] === 'string' && hasJa(r.cells[j])) { surface = r.cells[j]; break; } rd(`table.rows[${ri}].cells[${ci}]`, r.cells, ci, surface); }
      else if (typeof c === 'string' && !hasJa(c)) en(`table.rows[${ri}].cells[${ci}]`, r.cells, ci);
    }));
  }
  (screen.answer?.options || []).forEach((o, i) => { if (typeof o.text === 'string' && !hasJa(o.text)) en(`answer.options[${i}].text`, o, 'text'); rd(`answer.options[${i}].secondary`, o, 'secondary', o.text); });
  for (const side of ['left', 'right']) (screen[side] || []).forEach((o, i) => { if (typeof o.text === 'string' && !hasJa(o.text)) en(`${side}[${i}].text`, o, 'text'); rd(`${side}[${i}].secondary`, o, 'secondary', o.text); });
  return out;
}
// strings that must never be edited as a reading because they also act as an answer/puzzle surface
function answerSurfaces(screen) {
  const a = screen.answer, set = new Set();
  if (a) { (a.acceptedForms || []).forEach(x => set.add(x)); (a.tokens || []).forEach(x => set.add(x.text)); (a.options || []).forEach(x => set.add(x.text)); }
  (screen.scaffold || []).forEach(x => set.add(x)); (screen.left || []).forEach(x => set.add(x.text)); (screen.right || []).forEach(x => set.add(x.text));
  if (screen.typed) for (const k of ['before', 'after']) if (screen.typed[k]) set.add(screen.typed[k]);
  return set;
}

// ------------------------------------------------------------------ transform one pack
export function transformPack(base, log, options = {}) {
  const pack = structuredClone(base);
  const edits = new Map();
  for (const [screenId, p, edit] of screenEdits) if (screenId.startsWith(`${base.recordId}.`)) {
    const key = `${screenId}|${p}`; assert.ok(!edits.has(key), `duplicate hand edit ${key}`); edits.set(key, { edit, used: false, screenId, path: p });
  }
  const usedGlobal = new Set();
  const skippedReadings = [], skippedKatakana = [];
  for (const screen of pack.screens) {
    const surfaces = answerSurfaces(screen);
    if (screen.renderer === 'kanji') for (const ph of ['before', 'after']) for (let i = screen.support[ph].length - 1; i >= 0; i--) {
      const b = screen.support[ph][i];
      if (b.kind === 'explanation' && KANJI_DISCLAIMER_BLOCKS.has(b.text)) {
        log.push({ recordId: base.recordId, fromVersion: base.contentVersion, screenId: screen.screenId, path: `support.${ph}[${i}]`, kinds: ['removed'], old: b.text, new: '(block removed)', transcriptFree: false });
        screen.support[ph].splice(i, 1);
      }
    }
    const fields = learnerFields(screen);
    const known = new Set(fields.map(f => f.path));
    // a hand edit may create a missing `.secondary` reading line (L01 only needs this); every other edit must hit an existing field
    for (const [key, e] of edits) if (!e.used && e.screenId === screen.screenId && !known.has(e.path)) {
      const m = /^support\.(before|after)\[(\d+)\]\.secondary$/.exec(e.path);
      assert.ok(m && screen.support[m[1]][m[2]]?.kind === 'japanese' && screen.support[m[1]][m[2]].secondary === undefined, `hand edit ${key} targets no learner field`);
      screen.support[m[1]][m[2]].secondary = '';
      fields.push({ type: 'rd', path: e.path, obj: screen.support[m[1]][m[2]], key: 'secondary', created: true });
    }
    for (const f of fields) {
      const original = f.obj[f.key];
      let text = original; const kinds = [];
      const step = (kind, next) => { if (next !== text) { text = next; kinds.push(kind); } };
      const hand = edits.get(`${screen.screenId}|${f.path}`);
      if (hand) {
        hand.used = true;
        if (typeof hand.edit === 'string') step('rewrite', hand.edit);
        else for (const [from, to] of hand.edit.sub) { assert.equal(text.split(from).length - 1, 1, `${hand.screenId} ${f.path}: substring must occur exactly once: ${from}`); step('rewrite', text.replace(from, to)); }
      }
      if (f.type === 'en') {
        for (const [from, to] of globalSubs) if (text.includes(from)) { usedGlobal.add(from); step('rewrite', text.split(from).join(to)); }
        if (f.path === 'prompt') {
          for (const [name, renderers, fn] of PROMPT_RULES) if (renderers.includes(screen.renderer)) step(`template:${name}`, fn(text));
          step('capitalise', capitaliseFirst(text));
        }
        if (f.path === 'praise' && text !== 'Well done!') step('praise', 'Well done!');
        step('apostrophe', curlyApostrophes(text));
        step('spelling', australian(text));
      } else {
        const stripped = text.replace(/[ 　]+/g, '');
        if (stripped !== text) {
          if (surfaces.has(text) || surfaces.has(stripped)) skippedReadings.push({ recordId: base.recordId, screenId: screen.screenId, path: f.path, text });
          else step('reading-spacing', stripped);
        }
        if (options.katakana !== false && f.surface && missingKatakana(f.surface, text).length) {
          const where = { recordId: base.recordId, screenId: screen.screenId, path: f.path, surface: f.surface, reading: text };
          if (surfaces.has(text)) skippedKatakana.push({ ...where, reason: 'reading is also an answer surface' });
          else { const r = restoreKatakana(f.surface, text); if (r.status === 'restored') step('katakana', r.text); else skippedKatakana.push({ ...where, reason: r.status }); }
        }
      }
      if (text !== original) {
        f.obj[f.key] = text;
        log.push({ recordId: base.recordId, fromVersion: base.contentVersion, screenId: screen.screenId, path: f.path, kinds, old: f.created ? '(none)' : original, new: text,
          transcriptFree: screen.sourceContract?.transcriptBeforeAnswer === false });
      } else if (f.created) delete f.obj[f.key];
    }
  }
  for (const [key, e] of edits) assert.ok(e.used, `hand edit ${key} was not applied`);
  for (const optional of pack.completion?.optionalSurfaces || []) for (const k of ['prompt', 'hint']) {
    if (typeof optional[k] === 'string') { const next = curlyApostrophes(australian(optional[k])); if (next !== optional[k]) { log.push({ recordId: base.recordId, fromVersion: base.contentVersion, screenId: optional.screenId, path: `completion.optionalSurfaces.${k}`, kinds: ['spelling'], old: optional[k], new: next }); optional[k] = next; } }
  }
  return { pack, usedGlobal, skippedReadings, skippedKatakana };
}

// ------------------------------------------------------------------ plan: newest baseline version per record
const byRecord = new Map();
for (const p of baseline.packs) {
  const m = /^(b2-c\d+-(?:l\d+|cp))\.v(\d+)\.json$/.exec(p.file);
  assert.ok(m, p.file);
  const cur = byRecord.get(p.recordId);
  const entry = { ...p, stem: m[1], fileNumber: Number(m[2]) };
  const cmp = (a, b) => a.split('.').map(Number).reduce((r, x, i) => r || x - Number(b.split('.')[i]), 0);
  if (!cur || cmp(entry.contentVersion, cur.contentVersion) > 0) byRecord.set(p.recordId, entry);
}
const bumpMinor = v => { const [a, b] = v.split('.').map(Number); return `${a}.${b + 1}.0`; };

// Owner-approved exception (8 October 2026): a visible katakana error in a reading line justifies a version on its own.
export const KATAKANA_ONLY_VERSIONS = new Set(['B2.C03.L01']);
export function buildAll() {
  const results = []; const log = []; const usedGlobalAll = new Set(); const skipped = [], skippedKatakana = [], deferredKatakana = [];
  for (const [recordId, entry] of [...byRecord].sort()) {
    const base = JSON.parse(fs.readFileSync(path.join(root, entry.file), 'utf8'));
    assert.equal(base.recordId, recordId); assert.equal(base.contentVersion, entry.contentVersion);
    const before = log.length;
    // A katakana-only fix does not create a version by itself (records with no other change are listed instead), except the records the owner approved below.
    const probeLog = []; transformPack(base, probeLog, { katakana: false });
    if (!probeLog.length && !KATAKANA_ONLY_VERSIONS.has(recordId)) {
      const only = []; const k = transformPack(base, only, { katakana: true });
      skippedKatakana.push(...k.skippedKatakana);
      if (only.length) deferredKatakana.push({ recordId, version: entry.contentVersion, lines: only.map(l => ({ screenId: l.screenId, path: l.path, old: l.old, new: l.new })) });
      continue;
    }
    const { pack, usedGlobal, skippedReadings, skippedKatakana: sk } = transformPack(base, log);
    usedGlobal.forEach(x => usedGlobalAll.add(x)); skipped.push(...skippedReadings); skippedKatakana.push(...sk);
    const toVersion = bumpMinor(entry.contentVersion);
    pack.contentVersion = toVersion;
    const note = ` Text polish ${toVersion} (8 October 2026, owner-approved text-only pass over ${entry.contentVersion}): learner-facing wording, Australian English spelling, reading-line spacing and instruction-template wording were revised. Answer keys, accepted forms, tokens, option sets/IDs/order, screen IDs, partitions, counts, retry policies, source contracts, evidence and support timing/visibility are unchanged from ${entry.contentVersion}; b2-polish/pack-text-validation.mjs verifies this.`
      + (recordId === 'B2.C01.L01' ? ' The reading lines in this lesson previously held alternate kanji spellings; they now hold hiragana readings, and the alternate spellings are kept as plain support in the explanations of S03 and S05.' : '');
    pack.provenance = { ...pack.provenance, note: pack.provenance.note + note };
    const file = `${entry.stem}.v${entry.fileNumber + 1}.json`;
    for (let i = before; i < log.length; i++) { log[i].toVersion = toVersion; log[i].file = file; }
    results.push({ recordId, fromVersion: entry.contentVersion, toVersion, fromFile: entry.file, file, pack, bytes: JSON.stringify(pack, null, 2) + '\n' });
  }
  for (const [from] of globalSubs) assert.ok(usedGlobalAll.has(from), `global substitution never matched: ${from.slice(0, 60)}`);
  return { results, log, skipped, skippedKatakana, deferredKatakana };
}

// ------------------------------------------------------------------ reports
const mdEscape = s => s.replace(/\n/g, '⏎ ');
function report(results, log, skipped, skippedKatakana, deferredKatakana) {
  const prose = log.filter(l => !(l.kinds.length === 1 && l.kinds[0] === 'reading-spacing'));
  const spacing = log.filter(l => l.kinds.includes('reading-spacing'));
  const kindCounts = {};
  for (const l of log) for (const k of new Set(l.kinds)) kindCounts[k] = (kindCounts[k] || 0) + 1;
  const lines = [];
  lines.push('# B2 pack-text polish: every rewritten learner string (old → new)', '');
  lines.push('Generated by `pack-text-transform.mjs --write` on 8 October 2026 (owner-approved text-only pass). Predecessor versions are untouched. Answer keys, accepted forms, tokens, option sets/IDs/order, screen IDs, partitions, counts, retry policies, source contracts, evidence and support timing are unchanged (verified by `pack-text-validation.mjs`).', '');
  lines.push('Kinds: `removed` = meta-only kanji explanation block deleted; `rewrite` = hand-authored or exact-substring replacement from `pack-text-rewrites.mjs`; `template:*` = prompt-template wording rule; `spelling` = Australian English; `apostrophe` = curly apostrophes; `praise` = standard praise string; `capitalise` = first-letter case; `reading-spacing` = inter-word spaces removed from a visible reading line (listed in `pack-text-changes.json`, summarised below).', '');
  lines.push(`Totals: ${results.length} packs changed; ${log.length} strings changed (${prose.length} prose strings listed here; ${spacing.length} strings had reading spacing removed${spacing.length ? `, of which ${spacing.filter(l => l.kinds.length > 1).length} also carry another edit and are listed here` : ''}).`, '');
  lines.push('| Kind | Strings |', '| --- | ---: |', ...Object.entries(kindCounts).sort().map(([k, v]) => `| ${k} | ${v} |`), '');
  lines.push('## Packs', '', '| Record | Old version | New version | File | Strings changed |', '| --- | --- | --- | --- | ---: |');
  for (const r of results) lines.push(`| ${r.recordId} | ${r.fromVersion} | ${r.toVersion} | ${r.file} | ${log.filter(l => l.recordId === r.recordId).length} |`);
  lines.push('', '## Reading spacing removed (counts)', '', '| Record | Strings |', '| --- | ---: |');
  const perRecordSpacing = {};
  for (const l of spacing) perRecordSpacing[l.recordId] = (perRecordSpacing[l.recordId] || 0) + 1;
  for (const [k, v] of Object.entries(perRecordSpacing).sort()) lines.push(`| ${k} | ${v} |`);
  if (skipped.length) { lines.push('', '## Reading strings left unchanged because the same string is an answer surface', ''); for (const s of skipped) lines.push(`- ${s.screenId} ${s.path}: ${s.text}`); }
  lines.push('', '## Katakana restored in visible reading lines', '', 'A reading line keeps katakana words in katakana (only kanji get hiragana). The transform aligns each reading with its Japanese surface and skips the line, rather than guessing, when alignment fails or is ambiguous.', '');
  lines.push('- Restored: ' + log.filter(l => l.kinds.includes('katakana')).length + ' lines (kind `katakana` in pack-text-changes.json).');
  lines.push('- Skipped and listed: ' + skippedKatakana.length);
  for (const k of skippedKatakana) lines.push('  - ' + k.screenId + ' `' + k.path + '` [' + k.reason + '] surface: ' + k.surface + ' / reading: ' + k.reading);
  lines.push('- Records with no other change, so no new version was made just for this: ' + deferredKatakana.length);
  for (const d of deferredKatakana) { lines.push('  - ' + d.recordId + '@' + d.version + ': ' + d.lines.length + ' line(s)'); for (const l of d.lines) lines.push('    - ' + l.screenId + ' `' + l.path + '`: ' + l.old + ' to ' + l.new); }
  lines.push('', '## Prose changes', '');
  for (const r of results) {
    const own = prose.filter(l => l.recordId === r.recordId);
    if (!own.length) continue;
    lines.push(`### ${r.recordId} ${r.fromVersion} → ${r.toVersion}`, '');
    for (const l of own) lines.push(`- **${l.screenId}** \`${l.path}\` [${l.kinds.join(', ')}]`, `  - old: ${mdEscape(l.old)}`, `  - new: ${mdEscape(l.new)}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ------------------------------------------------------------------ run
if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const { results, log, skipped, skippedKatakana, deferredKatakana } = buildAll();
  const md = report(results, log, skipped, skippedKatakana, deferredKatakana);
  const json = JSON.stringify({ date: '2026-10-08', packs: results.map(r => ({ recordId: r.recordId, fromVersion: r.fromVersion, toVersion: r.toVersion, file: r.file })), skippedReadingsAlsoAnswerSurface: skipped, skippedKatakana, deferredKatakanaNoVersion: deferredKatakana, changes: log }, null, 2) + '\n';
  const kindTotals = {};
  for (const l of log) for (const k of new Set(l.kinds)) kindTotals[k] = (kindTotals[k] || 0) + 1;
  console.log(`${results.length} packs change; ${log.length} strings.`, kindTotals, `skipped readings: ${skipped.length}`);
  if (mode === 'write') {
    const baselineFiles = new Set(baseline.packs.map(p => p.file));
    for (const r of results) { assert.ok(!baselineFiles.has(r.file), `${r.file} is a pre-polish registered version; refusing to overwrite`); fs.writeFileSync(path.join(root, r.file), r.bytes); }
    fs.writeFileSync(path.join(here, 'pack-text-changes.md'), md + '\n'); fs.writeFileSync(path.join(here, 'pack-text-changes.json'), json);
    console.log(`Wrote ${results.length} pack files, pack-text-changes.md and pack-text-changes.json.`);
  } else if (mode === 'check') {
    for (const r of results) assert.equal(fs.readFileSync(path.join(root, r.file), 'utf8'), r.bytes, `${r.file} is deterministic`);
    assert.equal(fs.readFileSync(path.join(here, 'pack-text-changes.md'), 'utf8'), md + '\n'); assert.equal(fs.readFileSync(path.join(here, 'pack-text-changes.json'), 'utf8'), json);
    console.log('Deterministic regeneration: all new pack files and reports are byte-identical.');
  }
}
