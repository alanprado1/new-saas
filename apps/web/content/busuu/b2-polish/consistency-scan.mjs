#!/usr/bin/env node
// Read-only learner-visible consistency scan over every B2 content pack.
// Run:  node apps/web/content/busuu/b2-polish/consistency-scan.mjs   (from the repo root, or any cwd)
// Writes consistency-scan.json next to this script. Modifies nothing else.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const contentDir = process.env.B2_SCAN_CONTENT_DIR ? path.resolve(process.env.B2_SCAN_CONTENT_DIR) : path.resolve(here, '..'); // env override is for self-testing only
const registryFile = path.resolve(here, '../../../lib/busuu/content-registry.ts');

// ---------------------------------------------------------------- load packs
const files = fs.readdirSync(contentDir).filter(f => /^b2-c\d+-(l\d+|cp)\.v\d+\.json$/.test(f)).sort();
const registryText = fs.readFileSync(registryFile, 'utf8');
const registered = new Set([...registryText.matchAll(/from '@\/content\/busuu\/(b2-c\d+-(?:l\d+|cp)\.v\d+\.json)'/g)].map(m => m[1]));
const packs = files.map(f => ({ file: f, pack: JSON.parse(fs.readFileSync(path.join(contentDir, f), 'utf8')) }));
const cmpVer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const currentVersion = new Map();
for (const { pack } of packs) { const c = currentVersion.get(pack.recordId); if (!c || cmpVer(pack.contentVersion, c) > 0) currentVersion.set(pack.recordId, pack.contentVersion); }
const unregistered = files.filter(f => !registered.has(f));
const chapterOf = rid => rid.split('.')[1]; // C01..C10

// ---------------------------------------------------------------- char helpers
const KANJI = /[㐀-䶿一-鿿々〆]/;
const KANJI_G = /[㐀-䶿一-鿿々〆]/g;
const JA = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;
const JA_G = /[぀-ヿ㐀-鿿]/g;
const hasJa = s => JA.test(s);
const jaRatio = s => { const letters = s.replace(/[\s\d.,;:!?'’"“”()\-・、。！？（）「」]/g, ''); if (!letters) return 0; return (letters.match(JA_G) || []).length / letters.length; };
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const excerpt = (s, idx = 0, len = 1, pad = 36) => { const a = Math.max(0, idx - pad), b = Math.min(s.length, idx + len + pad); return (a ? '…' : '') + s.slice(a, b) + (b < s.length ? '…' : ''); };

// ---------------------------------------------------------------- extraction
const items = [];   // learner-visible strings
const pairsRd = []; // surface/reading pairs
const screensMeta = [];
function add(ctx, p, ft, lang, text, phase = 'pre') {
  if (typeof text !== 'string') return;
  items.push({ rid: ctx.rid, ver: ctx.ver, cur: ctx.cur, sid: ctx.sid, rend: ctx.rend, path: p, ft, lang, text, phase });
}
function addPair(ctx, p, ft, surface, reading, extra = {}) {
  if (typeof surface !== 'string') return;
  pairsRd.push({ rid: ctx.rid, ver: ctx.ver, cur: ctx.cur, sid: ctx.sid, rend: ctx.rend, path: p, ft, surface, reading: typeof reading === 'string' ? reading : null, ...extra });
}
function extractScreen(pack, screen, idx) {
  const ctx = { rid: pack.recordId, ver: pack.contentVersion, cur: currentVersion.get(pack.recordId) === pack.contentVersion, sid: screen.screenId, rend: screen.renderer };
  const sc = screen.sourceContract || {};
  const base = `screens[${idx}]`;
  const noTranscript = sc.transcriptBeforeAnswer === false;
  const hasScene = !!screen.sceneContext;
  const meta = { ...ctx, kind: screen.answer?.kind ?? null, truthMode: screen.truthMode ?? null, audioRequired: screen.audio?.required ?? null, noTranscript, hasScene };
  screensMeta.push({ ...meta, screen });
  add(ctx, `${base}.prompt`, 'prompt', 'en', screen.prompt);
  if (screen.praise) add(ctx, `${base}.praise`, 'praise', 'en', screen.praise, 'post');
  if (screen.statement) add(ctx, `${base}.statement`, 'statement', 'en', screen.statement);
  if (screen.hint && !hasScene) add(ctx, `${base}.hint.text`, 'hint', 'en', screen.hint.text);
  // support blocks
  const transFreeBeforeVisible = noTranscript ? (screen.renderer === 'table' && screen.answer === null && screen.support.before.every(b => b.kind !== 'japanese' && !b.secondary)) : true;
  for (const phase of ['before', 'after']) {
    (screen.support[phase] || []).forEach((b, i) => {
      if (phase === 'before') {
        if (hasScene || !transFreeBeforeVisible) return;
        if (screen.renderer === 'dialogue' && screen.dialogue?.translationVisible === false && b.kind === 'translation') return;
      }
      const p = `${base}.support.${phase}[${i}]`;
      const vis = phase === 'before' ? 'pre' : 'post';
      if (b.kind === 'japanese') {
        add(ctx, `${p}.text`, `support.${phase}.japanese`, 'ja', b.text, vis);
        if (b.secondary) add(ctx, `${p}.secondary`, `support.${phase}.reading`, 'rd', b.secondary, vis);
        addPair(ctx, p, `support.${phase}.japanese`, b.text, b.secondary, { phase, parallelOff: sc.recordedSupport?.parallel_kana_available === false || sc.parallelReadingBeforeAnswer === false });
      } else if (b.kind === 'translation') add(ctx, `${p}.text`, `support.${phase}.translation`, 'en', b.text, vis);
      else add(ctx, `${p}.text`, `support.${phase}.explanation`, 'en', b.text, vis);
    });
  }
  // dialogue
  if (screen.dialogue && !hasScene) {
    const d = screen.dialogue;
    add(ctx, `${base}.dialogue.context`, 'dialogue.context', 'en', d.context);
    for (const k of ['guest', 'staff']) if (d.speakerLabels?.[k]) add(ctx, `${base}.dialogue.speakerLabels.${k}`, 'dialogue.speakerLabel', 'en', d.speakerLabels[k]);
    d.turns.forEach((t, i) => {
      const p = `${base}.dialogue.turns[${i}]`;
      const jaVis = d.japaneseVisible && sc.transcriptBeforeAnswer !== false;
      const enVis = d.translationVisible !== false && sc.translationBeforeAnswer !== false;
      if (jaVis && t.japanese != null) add(ctx, `${p}.japanese`, 'dialogue.japanese', 'ja', t.japanese);
      if (enVis && t.english != null) add(ctx, `${p}.english`, 'dialogue.english', 'en', t.english);
      if (t.reading != null) add(ctx, `${p}.reading`, 'dialogue.reading(audio)', 'rd', t.reading, 'tts');
      if (jaVis && t.japanese != null) addPair(ctx, p, 'dialogue.japanese', t.japanese, t.reading, { audioOnly: true });
    });
    if (d.japaneseVisible && sc.transcriptBeforeAnswer !== false) (d.glosses || []).forEach((g, i) => {
      const p = `${base}.dialogue.glosses[${i}]`;
      add(ctx, `${p}.japanese`, 'gloss.japanese', 'ja', g.japanese); add(ctx, `${p}.reading`, 'gloss.reading', 'rd', g.reading); add(ctx, `${p}.english`, 'gloss.english', 'en', g.english);
      addPair(ctx, p, 'gloss', g.japanese, g.reading);
    });
  }
  // answer surfaces
  const a = screen.answer;
  if (a && (a.kind === 'choice' || a.kind === 'multi_choice')) a.options.forEach((o, i) => {
    const lang = jaRatio(o.text) > 0.5 ? 'ja' : 'en';
    add(ctx, `${base}.answer.options[${i}].text`, `option.${lang}`, lang, o.text);
    if (o.secondary) add(ctx, `${base}.answer.options[${i}].secondary`, 'option.reading', 'rd', o.secondary);
    if (lang === 'ja') addPair(ctx, `${base}.answer.options[${i}]`, 'option', o.text, o.secondary);
  });
  if (a && (a.kind === 'ordered_slots' || a.kind === 'ordered_tokens')) a.tokens.forEach((t, i) => {
    add(ctx, `${base}.answer.tokens[${i}].text`, `token.${screen.renderer}`, jaRatio(t.text) > 0.5 ? 'ja' : 'en', t.text);
  });
  for (const side of ['left', 'right']) (screen[side] || []).forEach((it, i) => {
    const lang = jaRatio(it.text) > 0.5 ? 'ja' : 'en';
    add(ctx, `${base}.${side}[${i}].text`, `pair.${side}.${lang}`, lang, it.text);
    if (it.secondary) add(ctx, `${base}.${side}[${i}].secondary`, 'pair.reading', 'rd', it.secondary);
    if (lang === 'ja') addPair(ctx, `${base}.${side}[${i}]`, 'pair', it.text, it.secondary);
  });
  (screen.scaffold || []).forEach((s, i) => { if (s) add(ctx, `${base}.scaffold[${i}]`, 'scaffold', 'ja', s); });
  if (screen.fixedPrefix) add(ctx, `${base}.fixedPrefix`, 'fixedPrefix', 'ja', screen.fixedPrefix);
  if (screen.typed) { add(ctx, `${base}.typed.label`, 'typed.label', 'en', screen.typed.label); if (screen.typed.before) add(ctx, `${base}.typed.before`, 'typed.before', 'ja', screen.typed.before); if (screen.typed.after) add(ctx, `${base}.typed.after`, 'typed.after', 'ja', screen.typed.after); }
  if (screen.table) {
    add(ctx, `${base}.table.caption`, 'table.caption', 'en', screen.table.caption);
    screen.table.columns.forEach((c, i) => add(ctx, `${base}.table.columns[${i}]`, 'table.column', 'en', c));
    const isReadingCol = screen.table.columns.map(c => /^reading( in this example)?$/i.test(c.trim()));
    screen.table.rows.forEach((r, ri) => r.cells.forEach((c, ci) => {
      if (typeof c !== 'string') return;
      const p = `${base}.table.rows[${ri}].cells[${ci}]`;
      if (isReadingCol[ci]) {
        add(ctx, p, 'table.readingCell', 'rd', c);
        // pair with the nearest Japanese-bearing cell to the left
        for (let j = ci - 1; j >= 0; j--) if (hasJa(r.cells[j] || '') && !isReadingCol[j]) { addPair(ctx, p, 'table.reading', r.cells[j], c); break; }
      } else add(ctx, p, 'table.cell', jaRatio(c) > 0.5 ? 'ja' : 'en', c);
    }));
  }
  if (screen.kanji) {
    const k = screen.kanji;
    add(ctx, `${base}.kanji.shapeNote`, 'kanji.shapeNote', 'en', k.shapeNote);
    add(ctx, `${base}.kanji.meaning`, 'kanji.meaning', 'en', k.meaning);
    k.readings.forEach((r, i) => { add(ctx, `${base}.kanji.readings[${i}].text`, 'kanji.reading', 'rd', r.text); add(ctx, `${base}.kanji.readings[${i}].note`, 'kanji.readingNote', 'en', r.note); });
    k.examples.forEach((e, i) => {
      const p = `${base}.kanji.examples[${i}]`;
      add(ctx, `${p}.word`, 'kanji.example.word', 'ja', e.word); add(ctx, `${p}.reading`, 'kanji.example.reading', 'rd', e.reading); add(ctx, `${p}.meaning`, 'kanji.example.meaning', 'en', e.meaning);
      add(ctx, `${p}.sentence`, 'kanji.example.sentence', 'ja', e.sentence); add(ctx, `${p}.sentenceReading`, 'kanji.example.sentenceReading', 'rd', e.sentenceReading); add(ctx, `${p}.translation`, 'kanji.example.translation', 'en', e.translation);
      addPair(ctx, `${p}.word`, 'kanji.word', e.word, e.reading); addPair(ctx, `${p}.sentence`, 'kanji.sentence', e.sentence, e.sentenceReading);
    });
  }
  // audio reading (TTS only; used for reading validity)
  if (screen.audio?.reading) add(ctx, `${base}.audio.reading`, 'audio.reading(tts)', 'rd', screen.audio.reading, 'tts');
}
for (const { pack } of packs) {
  pack.screens.forEach((s, i) => extractScreen(pack, s, i));
  const ctx = { rid: pack.recordId, ver: pack.contentVersion, cur: currentVersion.get(pack.recordId) === pack.contentVersion, sid: null, rend: 'optional' };
  (pack.completion?.optionalSurfaces || []).forEach((o, i) => {
    const c = { ...ctx, sid: o.screenId };
    add(c, `completion.optionalSurfaces[${i}].prompt`, 'optional.prompt', 'en', o.prompt);
    add(c, `completion.optionalSurfaces[${i}].hint`, 'optional.hint', 'en', o.hint);
  });
}

// ---------------------------------------------------------------- findings
const findings = [];
const seen = new Set();
function find(check, severity, it, text, idx, len, note, extra = {}) {
  const key = [check, it.rid, it.ver, it.sid, it.path, idx].join('|');
  if (seen.has(key)) return; seen.add(key);
  findings.push({ check, severity, recordId: it.rid, contentVersion: it.ver, current: it.cur, screenId: it.sid, renderer: it.rend, field: it.path, fieldType: it.ft, excerpt: excerpt(text, idx ?? 0, len ?? 1), note, ...extra });
}
const SEV = { high: 3, medium: 2, low: 1 };

// ---- Check 1: placeholder / leaked internal language
const placeholderRe = [
  [/\b(TODO|TBD|FIXME|lorem|ipsum)\b/gi, 'placeholder-token', 'high'], [/\bxxx+\b/gi, 'placeholder-token', 'high'], [/placeholder/gi, 'placeholder-token', 'high'],
  [/\{\{|\}\}/g, 'template-brace', 'high'], [/\[|\]/g, 'square-bracket', 'low'], [/\b(undefined|null|NaN)\b/g, 'js-literal', 'high'],
];
// Build/provenance/engine language that should not reach a learner. [regex, label, severity]
const leakRe = [
  [/\bBusuu\b/gi, 'Busuu', 'high'], [/\bauthored\b|\bthis app authors\b/gi, 'authored', 'high'], [/\bparaphras\w*/gi, 'paraphrase', 'high'], [/\bretained\b/gi, 'retained', 'high'],
  [/recorded purpose/gi, 'recorded purpose', 'high'], [/\bresponse (slot|count)s?\b|\bselectable chunk\b/gi, 'response slot/count', 'high'], [/\bNFKC\b/g, 'NFKC', 'high'],
  [/\bsource (focus|response|feedback|and translation|transcript|animation)\b|\bthe source remains\b|\bvisible source\b/gi, 'source-material wording', 'medium'],
  [/\b(this|the) occurrence\b|\boccurrence-level\b/gi, 'occurrence', 'medium'],
  [/\b(this|the) app (accepts|checks|grades|authors|forms)\b|\bapp forms\b|\bAccepted app\b/gi, 'the app (engine voice)', 'medium'],
  [/\bexplicit(ly)? (accepted|script|variant|romaji|accepts)\b|\baccepted (script )?(forms|variants)\b|\bnot enabled\b|\bbroad conversion\b/gi, 'accepted-forms/engine wording', 'medium'],
  [/\b(full|complete) (listening )?transcript\b|\bfeedback (gives|retains)\b/gi, 'transcript/feedback meta wording', 'medium'],
  [/\b(replaces?|replacing|replaced) (the )?(source |deferred )?animation\b|\banimation is deferred\b|\bdeferred animation\b/gi, 'animation-replacement note', 'medium'],
  [/\b(physical|tokens?)\b|\bdistractor\b|\breviewed (alternative|matching|romaji)\b/gi, 'token/physical/distractor wording', 'medium'], // widened 8 Oct 2026 after reviewing the original 72 findings
  [/\bunresolved\b|\bnot recorded\b|\bexact (wording|text)\b/gi, 'status wording', 'medium'], [/\bTTS\b/g, 'TTS', 'low'], [/\bthis (pack|lesson record)\b/gi, 'pack wording', 'medium'],
];
// ---- Check 2: Japanese width / punctuation
const FW_ALNUM = /[Ａ-Ｚａ-ｚ０-９]/g;
const HW_KANA = /[ｦ-ﾟ]/g;
const termDist = {}; // ending distribution for Japanese sentence-like fields
const SENTENCE_FT = new Set(['support.before.japanese', 'support.after.japanese', 'dialogue.japanese', 'kanji.example.sentence']);
for (const it of items) {
  const t = it.text;
  // 1
  if (it.phase !== 'tts') {
    for (const [re, id, sev] of placeholderRe) { re.lastIndex = 0; let m; while ((m = re.exec(t))) { find('c1.placeholder', sev, it, t, m.index, m[0].length, `${id}: "${m[0]}"`); } }
    { const hits = []; for (const [re, id, sev] of leakRe) { re.lastIndex = 0; const m = re.exec(t); if (m) hits.push({ id, sev, m }); }
      if (hits.length) { hits.sort((a, b) => SEV[b.sev] - SEV[a.sev]); find('c1.internal-language', hits[0].sev, it, t, hits[0].m.index, hits[0].m[0].length, 'build/engine/provenance wording: ' + hits.map(h => `"${h.m[0]}" (${h.id})`).join('; '), { terms: hits.map(h => h.id) }); } }
  }
  // 2
  if (it.phase === 'tts') continue;
  if (it.lang === 'ja' || it.lang === 'en') {
    let m;
    FW_ALNUM.lastIndex = 0; while ((m = FW_ALNUM.exec(t))) { find('c2.fullwidth-ascii', 'medium', it, t, m.index, 1, `full-width letter/digit "${m[0]}"`); break; }
    HW_KANA.lastIndex = 0; while ((m = HW_KANA.exec(t))) { find('c2.halfwidth-katakana', 'medium', it, t, m.index, 1, `half-width katakana "${m[0]}"`); break; }
  }
  if (it.lang === 'ja' && hasJa(t)) {
    const re = /[,.?!:;()~]/g; let m;
    while ((m = re.exec(t))) {
      const prev = t[m.index - 1] || '', next = t[m.index + 1] || '';
      if (/[.:]/.test(m[0]) && /\d/.test(prev) && /\d/.test(next)) continue; // 3.5, 10:30
      find('c2.halfwidth-punct', /[.?!]/.test(m[0]) && m.index === t.length - 1 ? 'high' : 'medium', it, t, m.index, 1, `half-width "${m[0]}" in Japanese text`); break;
    }
    const sp = /[぀-ヿ㐀-鿿]\s+[぀-ヿ㐀-鿿]/.exec(t);
    if (sp) find('c2.stray-space', 'medium', it, t, sp.index, sp[0].length, 'space between Japanese characters in a surface field');
    if (/[\"']/.test(t)) { const i = t.search(/[\"']/); find('c2.ascii-quote', 'low', it, t, i, 1, 'ASCII quote in Japanese text'); }
    if (/\.\.\./.test(t)) find('c2.ascii-ellipsis', 'low', it, t, t.indexOf('...'), 3, '"..." in Japanese text; use …');
    if (SENTENCE_FT.has(it.ft)) {
      const last = [...t.trim()].at(-1); const k = /[。]/.test(last) ? '。' : /[？！]/.test(last) ? last : /[.?!]/.test(last) ? 'ASCII ' + last : /[」』）)]/.test(last) ? 'closer' : 'none';
      (termDist[it.ft] ??= {})[k] = (termDist[it.ft][k] || 0) + 1;
      if (k.startsWith('ASCII')) find('c2.ascii-ending', 'high', it, t, t.length - 1, 1, `Japanese sentence ends with ASCII "${last}"`);
    }
  }
  // tilde / wave dash width mixing is gathered below
}
// tilde variants
const tildeCounts = { '〜': 0, '～': 0, '~': 0 }; const tildeFirst = {};
for (const it of items) { if (it.phase === 'tts') continue; for (const ch of Object.keys(tildeCounts)) if (it.text.includes(ch)) { tildeCounts[ch]++; (tildeFirst[ch] ??= []).length < 5 && tildeFirst[ch].push(`${it.rid} ${it.sid}: ${excerpt(it.text, it.text.indexOf(ch), 1, 20)}`); } }

// ---- Check 3: English copy
const EN_SENT = new Set(['prompt', 'praise', 'statement', 'hint', 'support.before.translation', 'support.after.translation', 'support.before.explanation', 'support.after.explanation', 'dialogue.english', 'kanji.shapeNote', 'kanji.example.translation', 'optional.prompt', 'optional.hint', 'kanji.readingNote', 'table.caption', 'typed.label']);
const enEndDist = {}; const enEndItems = {};
// [label, American regex, British regex]. The B2 text is overwhelmingly American, so British forms are the outliers.
const IZE = 'recogni|organi|reali|civili|normali|romani|summari|apologi|categori|capitali|familiari|memori|nominali|equali|minimi|maximi|visuali|standardi|generali|customi|emphasi|authori';
const spell = [
  ['color/colour', /\bcolors?\b/gi, /\bcolours?\b|\w+-coloured\b/gi], ['favorite/favourite', /\bfavorite/gi, /\bfavourite/gi], ['behavior/behaviour', /\bbehavior/gi, /\bbehaviour/gi],
  ['honor/honour', /\bhonor(s|ed|ing)?\b/gi, /\bhonour(s|ed|ing)?\b/gi], ['neighbor/neighbour', /\bneighbor/gi, /\bneighbour/gi], ['humor/humour', /\bhumor\b/gi, /\bhumour\b/gi], ['center/centre', /\bcenters?\b/gi, /\bcentres?\b/gi], ['theater/theatre', /\btheaters?\b/gi, /\btheatres?\b/gi],
  ['judgment/judgement', /\bjudgment/gi, /\bjudgement/gi], ['enrollment/enrolment', /\benrollment/gi, /\benrolment/gi], ['gray/grey', /\bgray\b/gi, /\bgrey\b/gi], ['defense/defence', /\bdefense\b/gi, /\bdefence\b/gi],
  ['traveling/travelling', /\btraveling|\btraveler/gi, /\btravelling|\btraveller/gi], ['canceled/cancelled', /\bcanceled|\bcanceling/gi, /\bcancelled|\bcancelling/gi],
  ['-ize/-ise (stems)', new RegExp(`\\b(${IZE})z(e|es|ed|ing|ation)\\b`, 'gi'), new RegExp(`\\b(${IZE})s(e|es|ed|ing|ation)\\b`, 'gi')],
  ['practice (verb) / practise', /\b(to|I|we|you|let’s|will|can|should|please|and|may) practice\b/gi, /\bpractis(e|es|ed|ing)\b/gi], ['learned/learnt', /\blearned\b/gi, /\blearnt\b/gi], ['program/programme', /\bprograms?\b/gi, /\bprogrammes?\b/gi],
];
const TARGET_AU = process.env.B2_SCAN_DIALECT !== 'us'; // owner decision 8 Oct 2026: Australian English (keep 'program', 'learned')
if (TARGET_AU) for (const drop of ['learned/learnt', 'program/programme']) spell.splice(spell.findIndex(x => x[0] === drop), 1);
spell.push(['skillful/skilful', /\bskillful/gi, /\bskilful/gi], ['enroll/enrol', /\benroll(s)?\b/gi, /\benrol(s)?\b/gi], ['fulfill/fulfil', /\bfulfill/gi, /\bfulfil\b/gi]);
const spellHits = Object.fromEntries(spell.map(x => [x[0], { us: [], uk: [] }]));
const quoteStats = { straightApos: [], curlyApos: [], straightDq: [], curlyDq: [] };
for (const it of items) {
  const t = it.text;
  if (it.phase === 'tts') continue;
  // whitespace (all languages, all fields)
  if (/ {2,}|　{2,}|\t/.test(t)) { const i = t.search(/ {2,}|　{2,}|\t/); find('c3.double-space', 'medium', it, t, i, 2, 'double/tab whitespace'); }
  if (t !== t.trim() && it.ft !== 'scaffold') find('c3.edge-whitespace', 'medium', it, t, 0, Math.min(3, t.length), 'leading/trailing whitespace');
  if (/\n/.test(t)) find('c3.newline', 'low', it, t, t.indexOf('\n'), 1, 'embedded line break');
  if (/​|﻿| /.test(t)) find('c3.invisible-char', 'low', it, t, t.search(/​|﻿| /), 1, 'zero-width/nbsp character');
  if (it.lang !== 'en') continue;
  // quote stats
  if (/\w'\w|'s\b|\bn't\b/.test(t)) quoteStats.straightApos.push(it);
  if (/\w’\w/.test(t)) quoteStats.curlyApos.push(it);
  if (/"/.test(t)) quoteStats.straightDq.push(it);
  if (/[“”]/.test(t)) quoteStats.curlyDq.push(it);
  for (const [name, usRe, ukRe] of spell) for (const [re, key] of [[usRe, 'us'], [ukRe, 'uk']]) { re.lastIndex = 0; let m; while ((m = re.exec(t))) spellHits[name][key].push({ it, w: m[0], at: m.index }); }
  if (EN_SENT.has(it.ft)) {
    const trimmed = t.trim(); const last = [...trimmed].at(-1);
    const k = /[.]/.test(last) ? '.' : /[?]/.test(last) ? '?' : /[!]/.test(last) ? '!' : /[。]/.test(last) ? 'JA。' : /[”"’')]/.test(last) ? 'closer' : 'none';
    const key = it.ft.replace(/^support\.(before|after)\./, 'support.');
    (enEndDist[key] ??= {})[k] = (enEndDist[key][k] || 0) + 1; (enEndItems[key] ??= []).push({ it, k });
    const first = trimmed.match(/^[\s("“‘']*(.)/u)?.[1];
    if (first && /[a-z]/.test(first) && /^(prompt|praise|statement|support\.(before|after)\.explanation)$/.test(it.ft)) find('c3.lowercase-start', 'low', it, t, 0, 20, 'sentence-type field starts with lowercase letter');
  }
  if (/[a-z][.!?][A-Z]/.test(t)) { const m = /[a-z][.!?][A-Z]/.exec(t); find('c3.missing-space-after-stop', 'medium', it, t, m.index, 3, 'sentence stop without following space'); }
  if (/\s[,;:!?]/.test(t) || /[a-z] \.(?!\.)/.test(t)) { const m = /\s[,;:!?]|[a-z] \.(?!\.)/.exec(t); find('c3.space-before-punct', 'low', it, t, m.index, 2, 'space before punctuation'); }
  if (/[,;:]{2,}|(?<!\.)\.{2}(?!\.)/.test(t)) { const m = /[,;:]{2,}|(?<!\.)\.{2}(?!\.)/.exec(t); find('c3.double-punct', 'medium', it, t, m.index, 2, 'doubled punctuation'); }
  const open = (t.match(/\(/g) || []).length, close = (t.match(/\)/g) || []).length;
  if (open !== close) find('c3.unbalanced-parens', 'medium', it, t, Math.max(0, t.search(/[()]/)), 1, `unbalanced parentheses (${open} open / ${close} close)`);
}
// end-punctuation outliers per ft
const endOutliers = [];
for (const [key, arr] of Object.entries(enEndItems)) {
  const dist = enEndDist[key]; const total = arr.length; const [maj, majN] = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
  if (majN / total < 0.6) continue; // field type is genuinely mixed; report distribution only
  for (const { it, k } of arr) if (k !== maj && !(['?', '!'].includes(k) && /^(prompt|support\.translation|dialogue\.english|kanji\.example\.translation)$/.test(key)) && !(key === 'support.translation' && (k === 'none' || k === 'closer'))) { endOutliers.push({ ft: key, majority: maj, ending: k }); find('c3.end-punct-outlier', 'low', it, it.text, Math.max(0, it.text.length - 12), 12, `ends "${k}" but ${Math.round(majN / total * 100)}% of ${key} end "${maj}"`, { ending: k, majority: maj }); }
}
// quote mixing: minority style flagged
function quoteFlag(minor, major, id, label) {
  if (minor.length && major.length) for (const it of minor) { const rx = id === 'apos' ? /'/ : /"/; find('c3.quote-mixing', 'low', it, it.text, it.text.search(rx), 1, `${label} (${minor.length} straight vs ${major.length} curly across B2)`); }
}
quoteFlag(quoteStats.straightApos.filter(i => !/^[^']*'[^']*'/.test(i.text) || true), quoteStats.curlyApos, 'apos', 'straight apostrophe where curly is used elsewhere');
quoteFlag(quoteStats.straightDq, quoteStats.curlyDq, 'dq', 'straight double quote where curly is used elsewhere');
const spellSummary = {};
for (const [name, v] of Object.entries(spellHits)) {
  if (!v.us.length && !v.uk.length) continue;
  spellSummary[name] = { american: v.us.length, british: v.uk.length, examplesAmerican: [...new Set(v.us.map(x => x.w.toLowerCase()))].slice(0, 6), examplesBritish: [...new Set(v.uk.map(x => x.w.toLowerCase()))].slice(0, 6), britishIn: [...new Set(v.uk.map(x => x.it.rid))] };
  for (const x of (TARGET_AU ? v.us : v.uk)) find(TARGET_AU ? 'c3.spelling-american' : 'c3.spelling-british', 'low', x.it, x.it.text, x.at, x.w.length, TARGET_AU ? `American form "${x.w}" where Australian English is the standard (${name})` : `British form "${x.w}" in text that is otherwise American (${name}: ${v.us.length} American vs ${v.uk.length} British)`);
}

// ---- Check 4: readings
const READING_OK = /^[ぁ-ゟ゠-ヿ\s、。！？!?「」（）・〜～…\-ー，．／：]*$/;
function missingRun(surface, reading) {
  const r = toHira(reading).replace(/[\s、。！？!?,.　「」（）()・〜～…\-，．]/g, '');
  const runs = toHira(surface).match(/[ぁ-ゟー]+/g) || [];
  let pos = 0; for (const run of runs) { const i = r.indexOf(run, pos); if (i < 0) return run; pos = i + run.length; }
  return null;
}
const rdStats = {};
const bump = (ft, k) => { (rdStats[ft] ??= { withKanji: 0, withReading: 0, missing: 0 }); rdStats[ft][k]++; };
for (const it of items) {
  if (it.lang !== 'rd') continue;
  const audio = it.phase === 'tts';
  const t = it.text; const loc = audio ? ' (audio/TTS reading, not displayed)' : '';
  if (KANJI.test(t)) find('c4.reading-has-kanji', 'medium', it, t, t.search(KANJI), 1, 'reading/secondary field contains kanji (shows an alternate script form, not a kana reading)' + loc);
  else if (/[A-Za-z0-9]/.test(t)) find('c4.reading-has-ascii', audio ? 'low' : 'medium', it, t, t.search(/[A-Za-z0-9]/), 1, 'reading field contains ASCII letters/digits' + loc);
  else if (!READING_OK.test(t)) { const m = t.search(/[^ぁ-ゟ゠-ヿ\s、。！？!?「」（）・〜～…\-ー，．]/); find('c4.reading-odd-char', 'low', it, t, m, 1, 'reading field contains unexpected character' + loc); }
}
const kataReadings = []; let hiraReadings = 0;
for (const it of items) if (it.lang === 'rd' && it.phase !== 'tts') { if (/[ァ-ヶ]/.test(it.text)) kataReadings.push(it); else hiraReadings++; }
for (const p of pairsRd) {
  const it = { rid: p.rid, ver: p.ver, cur: p.cur, sid: p.sid, rend: p.rend, path: p.path, ft: p.ft };
  const surfKanji = KANJI.test(p.surface);
  const key = p.ft + (p.phase ? '' : '');
  if (surfKanji) {
    bump(key, 'withKanji');
    if (p.reading) bump(key, 'withReading');
    else bump(key, 'missing');
  }
  if (!p.reading) continue;
  if (surfKanji && p.reading.trim() === p.surface.trim()) find('c4.reading-equals-surface', 'medium', it, p.surface, 0, Math.min(20, p.surface.length), 'reading identical to kanji surface');
  else if (surfKanji || hasJa(p.surface)) {
    const bad = missingRun(p.surface, p.reading);
    if (bad) find('c4.reading-mismatch', 'medium', it, `${p.surface}  ⟷  ${p.reading}`, 0, 80, `kana "${bad}" from the surface not found in the reading (check reading/okurigana)`, { surface: p.surface, reading: p.reading });
  }
}
// missing readings: only where the field type normally carries readings (>=50% of kanji-bearing strings have one) and not intentionally suppressed
const MISSING_FT = ['support.after.japanese', 'support.before.japanese', 'kanji.word', 'kanji.sentence', 'gloss'];
for (const p of pairsRd) {
  if (p.reading || !KANJI.test(p.surface)) continue;
  if (!MISSING_FT.includes(p.ft)) continue;
  if (p.ft === 'support.before.japanese' && p.parallelOff) continue;
  const st = rdStats[p.ft]; if (!st || st.withReading / st.withKanji < 0.5) continue;
  const it = { rid: p.rid, ver: p.ver, cur: p.cur, sid: p.sid, rend: p.rend, path: p.path, ft: p.ft };
  find('c4.reading-missing', 'medium', it, p.surface, 0, Math.min(30, p.surface.length), `kanji text without reading although ${Math.round(st.withReading / st.withKanji * 100)}% of ${p.ft} have one`);
}
// option readings: intra-screen inconsistency (some options carry readings, some with kanji don't)
for (const sm of screensMeta) {
  const a = sm.screen.answer; if (!a || !a.options) continue;
  const withR = a.options.filter(o => o.secondary).length;
  if (withR && withR < a.options.length) a.options.forEach((o, i) => { if (!o.secondary && KANJI.test(o.text)) find('c4.option-reading-inconsistent', 'medium', { ...sm, path: `screens[${screensMeta.indexOf(sm)}].answer.options[${i}]`, ft: 'option' }, o.text, 0, 30, 'option with kanji has no reading while sibling options do'); });
}

// ---- Check 5: answer options
const norm = s => s.normalize('NFKC').replace(/\s+/g, '').replace(/[。、．.！!？?]+$/g, '');
const positions = {}; // correct option index distribution
for (const sm of screensMeta) {
  const s = sm.screen, a = s.answer; if (!a) continue;
  const idx = screensMeta.indexOf(sm);
  const mk = (p, ft) => ({ rid: sm.rid, ver: sm.ver, cur: sm.cur, sid: sm.sid, rend: sm.rend, path: p, ft });
  if (a.kind === 'choice' || a.kind === 'multi_choice') {
    const acc = new Set(a.acceptedOptionIds);
    const ids = new Set(a.options.map(o => o.id));
    for (const id of acc) if (!ids.has(id)) find('c5.accepted-id-missing', 'high', mk(`screens[${idx}].answer.acceptedOptionIds`, 'answer'), id, 0, id.length, 'accepted option id has no option');
    if (a.kind === 'multi_choice' && a.requiredCount !== acc.size) find('c5.required-count-mismatch', 'high', mk(`screens[${idx}].answer.requiredCount`, 'answer'), String(a.requiredCount), 0, 3, `requiredCount ${a.requiredCount} but ${acc.size} accepted ids`);
    const groups = {};
    a.options.forEach((o, i) => { (groups[norm(o.text)] ??= []).push({ o, i }); });
    for (const g of Object.values(groups)) if (g.length > 1) {
      const kinds = new Set(g.map(x => acc.has(x.o.id)));
      const exact = new Set(g.map(x => x.o.text)).size === 1;
      const sev = kinds.size > 1 ? 'high' : exact ? 'high' : 'medium';
      find('c5.duplicate-option', sev, mk(`screens[${idx}].answer.options[${g[1].i}].text`, 'option'), g.map(x => x.o.text).join(' | '), 0, 80, `${exact ? 'identical' : 'punctuation/whitespace-only different'} options${kinds.size > 1 ? '; one is correct and one is a distractor' : ''}`);
    }
    // terminal-punctuation tell
    const ends = a.options.map(o => /[。．.！？!?]$/.test(o.text.trim()) ? 'p' : 'n');
    if (new Set(ends).size > 1 && a.options.every(o => hasJa(o.text))) {
      const minority = ends.filter(e => e === 'p').length <= ends.filter(e => e === 'n').length ? 'p' : 'n';
      const accEnds = a.options.filter(o => acc.has(o.id)).map(o => /[。．.！？!?]$/.test(o.text.trim()) ? 'p' : 'n');
      const tell = accEnds.every(e => e === minority) || accEnds.every(e => e !== minority);
      find('c5.mixed-terminal-punct', tell ? 'medium' : 'low', mk(`screens[${idx}].answer.options`, 'option'), a.options.map(o => o.text).join(' | '), 0, 120, 'some options end with 。/？ and others do not' + (tell ? ' (the pattern singles out the correct answer(s))' : ''));
    }
    if (a.kind === 'choice' && a.acceptedOptionIds.length === 1) { const pos = a.options.findIndex(o => o.id === a.acceptedOptionIds[0]); const key = `${a.options.length}opts`; (positions[key] ??= {}); positions[key][pos] = (positions[key][pos] || 0) + 1; (positions._byChapter ??= {}); const ch = chapterOf(sm.rid); if (sm.cur) { (positions._byChapter[ch] ??= {}); positions._byChapter[ch][pos] = (positions._byChapter[ch][pos] || 0) + 1; } }
  }
  if (a.kind === 'truth' && sm.cur) { positions._truthTrueFalse ??= { true: 0, false: 0 }; positions._truthTrueFalse[String(a.accepted)]++; }
  if (a.kind === 'pairs') {
    for (const side of ['left', 'right']) {
      const g = {}; (s[side] || []).forEach((x, i) => (g[norm(x.text)] ??= []).push(i));
      for (const [k, v] of Object.entries(g)) if (v.length > 1) find('c5.duplicate-pair-item', 'medium', mk(`screens[${idx}].${side}[${v[1]}].text`, 'pair'), s[side][v[0]].text, 0, 40, `duplicate ${side} item in a matching screen`);
    }
  }
  if (a.kind === 'ordered_slots' || a.kind === 'ordered_tokens') {
    const byText = {}; a.tokens.forEach(t => (byText[t.text] ??= []).push(t.id));
    const twins = Object.values(byText).filter(v => v.length > 1);
    const tokenIds = new Set(a.tokens.map(t => t.id));
    if (a.kind === 'ordered_slots') {
      a.slots.forEach((sl, si) => {
        for (const id of sl.acceptedTokenIds) if (!tokenIds.has(id)) find('c5.accepted-id-missing', 'high', mk(`screens[${idx}].answer.slots[${si}]`, 'answer'), id, 0, 10, 'accepted token id has no token');
        for (const grp of twins) if (grp.some(id => sl.acceptedTokenIds.includes(id)) && !grp.every(id => sl.acceptedTokenIds.includes(id))) find('c5.twin-token-not-accepted', 'high', mk(`screens[${idx}].answer.slots[${si}]`, 'answer'), a.tokens.find(t => t.id === grp[0]).text, 0, 20, 'two identical-looking tokens but only one is accepted in the slot');
      });
      // a distractor with the same text as an accepted token elsewhere is fine only when accepted for that slot
    } else {
      const orders = new Set(a.acceptedOrders.map(o => o.join('|')));
      for (const o of a.acceptedOrders) for (const id of o) if (!tokenIds.has(id)) find('c5.accepted-id-missing', 'high', mk(`screens[${idx}].answer.acceptedOrders`, 'answer'), id, 0, 10, 'accepted order references unknown token');
      for (const grp of twins) for (const o of a.acceptedOrders) {
        const swapped = o.map(id => grp.includes(id) ? grp[(grp.indexOf(id) + 1) % grp.length] : id);
        if (grp.length === 2 && swapped.join('|') !== o.join('|') && !orders.has(swapped.join('|'))) find('c5.twin-token-not-accepted', 'high', mk(`screens[${idx}].answer.acceptedOrders`, 'answer'), a.tokens.find(t => t.id === grp[0]).text, 0, 20, 'identical-looking chunks cannot be swapped in the accepted orders');
      }
      // visible duplicate chunks in the bank
    }
    for (const grp of twins) if (grp.length > 1) find('c5.duplicate-bank-chip', 'low', mk(`screens[${idx}].answer.tokens`, 'token'), a.tokens.find(t => t.id === grp[0]).text, 0, 20, 'identical chips appear more than once in the bank');
  }
}

// ---- Check 6: layout risk
const layout = [];
for (const it of items) {
  if (it.phase === 'tts') continue;
  const t = it.text;
  if (it.lang === 'en') for (const w of t.split(/\s+/)) if (w.length > 28 && !hasJa(w)) layout.push({ kind: 'en-unbroken-token', len: w.length, threshold: 28, ratio: w.length / 28, it, text: w });
  const jaChip = /^(option\.ja|token\.|pair\.(left|right)\.ja|gloss\.japanese)/.test(it.ft);
  if (jaChip && [...t].length > 22) layout.push({ kind: 'ja-chip>22', len: [...t].length, threshold: 22, ratio: [...t].length / 22, it, text: t });
  if (it.ft === 'table.cell' && t.length > 40) layout.push({ kind: 'table-cell>40', len: t.length, threshold: 40, ratio: t.length / 40, it, text: t });
  if (it.ft === 'prompt' && t.length > 160) layout.push({ kind: 'prompt>160', len: t.length, threshold: 160, ratio: t.length / 160, it, text: t });
  if (it.ft === 'option.en' && t.split(/\s+/).some(w => w.length > 28)) { /* covered above */ }
  if (/^(support\.before|support\.after)\.japanese$/.test(it.ft) === false && it.lang === 'ja' && /^kanji\.example\.word$/.test(it.ft) && [...t].length > 12) layout.push({ kind: 'kanji-word>12', len: [...t].length, threshold: 12, ratio: [...t].length / 12, it, text: t });
}
layout.sort((a, b) => b.ratio - a.ratio);
const layoutCounts = {}; for (const l of layout) layoutCounts[l.kind] = (layoutCounts[l.kind] || 0) + 1;
const layoutCurrent = layout.filter(l => l.it.cur);
for (const l of layoutCurrent) findings.push({ check: 'c6.layout-risk', severity: 'low', recordId: l.it.rid, contentVersion: l.it.ver, current: l.it.cur, screenId: l.it.sid, renderer: l.it.rend, field: l.it.path, fieldType: l.it.ft, excerpt: excerpt(l.text, 0, 60, 0), note: `${l.kind}: ${l.len} (threshold ${l.threshold})`, kind: l.kind });

// ---- Check 7: instruction templates
const tpl = s => s.replace(/[぀-ヿ㐀-鿿ｦ-ﾟー・々]+/g, '‹JA›').replace(/\s+/g, ' ').replace(/[“”"‘’']([^“”"‘’']+)[“”"‘’']/g, '‹Q›').replace(/‹JA›(?=[A-Za-z])/g, '‹JA› ').trim();
const tplByRend = {};
for (const sm of screensMeta) {
  if (!sm.cur || !sm.screen.prompt) continue;
  const t = tpl(sm.screen.prompt);
  const r = sm.rend + (sm.rend === 'truth' ? `/${sm.truthMode || 'supported'}` : '') + (sm.rend === 'choice' && sm.noTranscript ? '/transcript-free' : '') + (sm.rend === 'gaps' || sm.rend === 'ordering' ? (sm.noTranscript ? '/transcript-free' : '') : '');
  ((tplByRend[r] ??= {})[t] ??= { count: 0, examples: [] }).count++;
  const e = tplByRend[r][t].examples; if (e.length < 2) e.push(`${sm.rid} ${sm.sid}`);
}
// verb / listen-prefix / suffix-cue distribution per renderer group (the "which words do we use to ask for the same action" view)
const VERBS = ['choose', 'select', 'complete', 'insert', 'fill', 'supply', 'build', 'arrange', 'reconstruct', 'place', 'type', 'write', 'match', 'study', 'learn', 'compare', 'read', 'listen', 'identify', 'notice', 'form', 'mark', 'borrow', 'which', 'what', 'how', 'is'];
const verbDist = {}, prefixDist = {}, cueDist = {};
for (const sm of screensMeta) {
  if (!sm.cur || !sm.screen.prompt) continue;
  const p = sm.screen.prompt.trim();
  const g = sm.rend + (sm.rend === 'truth' ? `/${sm.truthMode || 'supported'}` : '') + ((['choice', 'gaps', 'ordering'].includes(sm.rend) && sm.noTranscript) ? '/transcript-free' : '');
  const prefix = (/^(Read and listen|Listen and read|Listen carefully and|Listen again if needed and|Listen and|Listen to|Listen\.|Listen,|Read and|Look,)/i.exec(p) || [''])[0] || '(none)';
  (prefixDist[g] ??= {})[prefix] = (prefixDist[g][prefix] || 0) + 1;
  const rest = p.replace(/^(Read and listen|Listen and read|Listen carefully and|Listen again if needed and|Listen and|Listen\.|Listen,|Read and)\s*/i, '');
  const verb = (rest.match(/^[A-Za-z]+/) || ['(JA/other)'])[0].toLowerCase();
  const v = VERBS.includes(verb) ? verb : '(other:' + verb + ')';
  (verbDist[g] ??= {})[v] = (verbDist[g][v] || 0) + 1;
  const cues = []; if (/then select Check/i.test(p)) cues.push('then select Check'); if (/\bsupplied\b/i.test(p)) cues.push('mentions supplied text'); if (/\bhiragana\b/i.test(p)) cues.push('says hiragana'); if (/kana or romaji|hiragana or romaji|or romaji/i.test(p)) cues.push('mentions romaji');
  for (const c of cues) { (cueDist[g] ??= {})[c] = (cueDist[g][c] || 0) + 1; }
}
const leadOf = t => t.toLowerCase().replace(/[^a-z‹› ]/g, '').split(' ').slice(0, 3).join(' ');
const templateTable = {}; const nearDup = [];
const STOP = new Set(['the', 'a', 'an', 'to', 'of', 'in', 'and', 'for', 'with', 'is', 'are', 'this', 'that', 'it', 'its', 'by', 'on']);
const wordsOf = t => new Set(t.toLowerCase().replace(/[^a-z‹› ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)));
for (const [r, m] of Object.entries(tplByRend)) {
  const rows = Object.entries(m).map(([t, v]) => ({ template: t, ...v })).sort((a, b) => b.count - a.count);
  const leads = {}; for (const row of rows) { const l = leadOf(row.template); leads[l] = (leads[l] || 0) + row.count; }
  templateTable[r] = { totalScreens: rows.reduce((s, x) => s + x.count, 0), distinctTemplates: rows.length, leadVerbPhrases: Object.entries(leads).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} (${v})`), top: rows.slice(0, 12), all: rows };
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const A = wordsOf(rows[i].template), B = wordsOf(rows[j].template); const inter = [...A].filter(x => B.has(x)).length; const jac = inter / (A.size + B.size - inter || 1);
    if (jac >= 0.6 && rows[i].template !== rows[j].template) nearDup.push({ renderer: r, a: rows[i].template, aCount: rows[i].count, b: rows[j].template, bCount: rows[j].count, similarity: +jac.toFixed(2) });
  }
}
// ---- Check 8: other
const extra = [];
function X(id, sev, sm, p, text, note, ft = 'misc') { find(id, sev, { rid: sm.rid, ver: sm.ver, cur: sm.cur, sid: sm.sid, rend: sm.rend, path: p, ft }, text, 0, 80, note); }
const explanationCounts = {};
for (const sm of screensMeta) {
  const s = sm.screen, idx = screensMeta.indexOf(sm);
  // before/after duplicates (both rendered in feedback)
  const vis = [];
  const beforeBlocks = (s.sourceContract?.transcriptBeforeAnswer === false ? [] : s.support.before);
  for (const b of beforeBlocks) vis.push({ b, ph: 'before' });
  for (const b of s.support.after) vis.push({ b, ph: 'after' });
  const seenB = new Map();
  vis.forEach(({ b, ph }) => { const k = b.kind + '|' + b.text; if (seenB.has(k)) X('c8.support-duplicate-in-feedback', 'medium', sm, `screens[${idx}].support`, b.text, `identical ${b.kind} block shown twice in the post-answer view (${seenB.get(k)} + ${ph})`); else seenB.set(k, ph); });
  // kanji screens: support repeats the model's examples
  if (s.renderer === 'kanji' && s.kanji) {
    const dupSentence = s.kanji.examples.filter(e => s.support.before.some(b => b.kind === 'japanese' && b.text.includes(e.sentence)));
    if (dupSentence.length) X('c8.kanji-support-repeats-model', 'low', sm, `screens[${idx}].support.before`, s.support.before.find(b => b.kind === 'japanese').text, 'support blocks repeat the example sentences already rendered by the kanji model (visible twice)', 'kanji');
  }
  // table translation block as space-joined cell list
  if (s.renderer === 'table') for (const b of s.support.before.concat(s.support.after)) if (b.kind === 'translation' && !/[.?!]$/.test(b.text) && b.text.split(/\s+/).length >= 4 && !/[;,]/.test(b.text.slice(-5))) X('c8.table-translation-is-word-list', 'low', sm, `screens[${idx}].support`, b.text, 'translation block is an unpunctuated word list built from table cells', 'support.translation');
  // table integrity
  if (s.table) {
    if (!s.table.caption) X('c8.table-no-caption', 'low', sm, `screens[${idx}].table`, '(none)', 'table has no caption', 'table');
    s.table.rows.forEach((r, ri) => { if (r.cells.length !== s.table.columns.length) X('c8.table-ragged-row', 'high', sm, `screens[${idx}].table.rows[${ri}]`, r.cells.join(' | '), `row has ${r.cells.length} cells for ${s.table.columns.length} columns`, 'table'); r.cells.forEach((c, ci) => { if (c == null || String(c).trim() === '') X('c8.table-empty-cell', 'medium', sm, `screens[${idx}].table.rows[${ri}].cells[${ci}]`, String(c), 'empty table cell', 'table'); }); });
  }
  // dialogue without context -> shared fallback "Hotel scene"
  if (s.dialogue && !s.sceneContext && !s.dialogue.context) X('c8.dialogue-default-context', 'medium', sm, `screens[${idx}].dialogue.context`, '(missing)', 'dialogue has no context so the shared fallback caption "Hotel scene" is shown; check it fits this scene', 'dialogue');
  if (s.hint && s.hint.text == null) X('c8.hint-no-text', 'high', sm, `screens[${idx}].hint`, '(null)', 'hint has no text; learner sees "Hint text unavailable in retained evidence."', 'hint');
  // prompt vs mechanics
  const p = s.prompt || '';
  if (hasJa(p) && !/[A-Za-z]{3,}/.test(p)) X('c8.prompt-japanese-only', 'medium', sm, `screens[${idx}].prompt`, p, 'the instruction line is a Japanese-only question with no English task instruction (other prompts in B2 are English instructions)');
  if (/[。？！」][A-Za-z]/.test(p)) X('c8.prompt-ja-en-no-space', 'low', sm, `screens[${idx}].prompt`, p, 'Japanese sentence runs straight into the English instruction with no space; other prompts quote the Japanese or put it after a colon');
  if (/\blisten\b/i.test(p) && s.audio?.required === false && s.renderer !== 'model') X('c8.prompt-listen-but-audio-optional', 'medium', sm, `screens[${idx}].prompt`, p, 'prompt says "Listen" but audio is not required/offered before answering');
  if (/\bread\b/i.test(p) && s.truthMode === 'audio_only') X('c8.prompt-read-but-hidden-script', 'high', sm, `screens[${idx}].prompt`, p, 'prompt says "Read" but the script is hidden before answering (audio_only)');
  if (/\b(true or false|true\/false)\b/i.test(p) && s.renderer !== 'truth') X('c8.prompt-renderer-mismatch', 'high', sm, `screens[${idx}].prompt`, p, `prompt asks true/false but renderer is ${s.renderer}`);
  if (/\bmatch (each|the|these)\b/i.test(p) && s.renderer !== 'pairs') X('c8.prompt-renderer-mismatch', 'medium', sm, `screens[${idx}].prompt`, p, `prompt says "match" but renderer is ${s.renderer}`);
  if (/^Type\b|\bType (the|a|an|your)\b/.test(p) && s.renderer !== 'typed') X('c8.prompt-renderer-mismatch', 'low', sm, `screens[${idx}].prompt`, p, `prompt says "Type" but renderer is ${s.renderer}`);
  if (s.renderer === 'multi_choice' && !new RegExp(`\\b(${s.answer.requiredCount}|${['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'][s.answer.requiredCount]}|all)\\b`, 'i').test(p)) X('c8.multi-choice-count-not-in-prompt', 'low', sm, `screens[${idx}].prompt`, p, `prompt does not state how many answers to pick (${s.answer.requiredCount}); the shared caption does`);
  // translation vs Japanese question/statement parity (adjacent blocks)
  for (const ph of ['before', 'after']) {
    const blocks = s.support[ph]; blocks.forEach((b, i) => { if (b.kind === 'japanese') { const nxt = blocks[i + 1]; if (nxt?.kind === 'translation' && /か。?$|？$/.test(b.text.trim()) && !/\?\s*$/.test(nxt.text) && !/^(Which|What|Where|Who|How|Why|When)/.test(nxt.text)) { /* fragment */ }
      if (nxt?.kind === 'translation' && /[?？]$/.test(b.text.trim()) && !/\?$/.test(nxt.text.trim()) && /^[A-Z]/.test(nxt.text)) X('c8.question-translation-mismatch', 'low', sm, `screens[${idx}].support.${ph}[${i + 1}]`, `${b.text}  ⟷  ${nxt.text}`, 'Japanese ends with ？ but translation does not end with "?"', 'support.translation'); } });
  }
  // long repeated explanation
  for (const b of s.support.before.concat(s.support.after)) if (b.kind === 'explanation' && b.text.length > 100 && sm.cur) { const k = sm.rid + '|' + b.text; (explanationCounts[k] ??= { rid: sm.rid, text: b.text, screens: new Set() }).screens.add(sm.sid); }
  // Japanese in english-only blocks without lang (explanation / hint / table cell) -> accessibility, counted below
}
const repeatedExplanations = Object.values(explanationCounts).filter(v => v.screens.size >= 3).map(v => ({ recordId: v.rid, screens: v.screens.size, length: v.text.length, text: v.text.slice(0, 160) })).sort((a, b) => b.screens - a.screens);
for (const v of Object.values(explanationCounts)) if (v.screens.size >= 3) find('c8.repeated-explanation', 'low', { rid: v.rid, ver: currentVersion.get(v.rid), cur: true, sid: [...v.screens][0], rend: 'multiple', path: 'support.*.explanation', ft: 'support.explanation' }, v.text, 0, 100, `identical ${v.text.length}-char explanation appears on ${v.screens.size} screens in this lesson`, { screens: [...v.screens] });
// reading spacing style (word-spaced "おなまえは なんと…" vs run-together "おなまえはなんと…") per chapter and per lesson
const spacing = {}, spacingLesson = {};
for (const it of items) if (it.cur && (/^support\.(before|after)\.reading$/.test(it.ft) || it.ft === 'table.readingCell')) {
  const kana = it.text.replace(/\s/g, '').length; if (kana < 12) continue;
  const spaced = / /.test(it.text);
  for (const [map, key] of [[spacing, chapterOf(it.rid)], [spacingLesson, it.rid]]) (map[key] ??= { spaced: 0, unspaced: 0 })[spaced ? 'spaced' : 'unspaced']++;
}
const pct = v => ({ ...v, pctSpaced: Math.round(v.spaced / (v.spaced + v.unspaced) * 100) });
const spacingRatio = Object.fromEntries(Object.entries(spacing).map(([k, v]) => [k, pct(v)]));
const mixedSpacingLessons = Object.entries(spacingLesson).map(([k, v]) => [k, pct(v)]).filter(([, v]) => v.spaced >= 2 && v.unspaced >= 2);
for (const [rid, v] of mixedSpacingLessons) findings.push({ check: 'c8.reading-spacing-mixed-in-lesson', severity: 'medium', recordId: rid, contentVersion: currentVersion.get(rid), current: true, screenId: null, renderer: 'multiple', field: 'support.*.secondary / table reading cells', fieldType: 'reading', excerpt: `${v.spaced} word-spaced vs ${v.unspaced} run-together readings`, note: 'readings in this lesson mix word-spaced and run-together styles' });
// Owner decision 8 Oct 2026: readings are run-together (Busuu style, as in C01-C04). Flag any lesson whose visible readings still contain word spaces.
const spacingByLesson = Object.fromEntries(Object.entries(spacingLesson).map(([k, v]) => [k, pct(v)]));
const spacingDeviants = Object.entries(spacingByLesson).filter(([, v]) => v.spaced > 0).map(([rid, v]) => ({ recordId: rid, ...v }));
for (const d of spacingDeviants) findings.push({ check: 'c8.reading-spacing-deviates', severity: 'medium', recordId: d.recordId, contentVersion: currentVersion.get(d.recordId), current: true, screenId: null, renderer: 'multiple', field: 'support.*.secondary / table reading cells', fieldType: 'reading', excerpt: `${d.unspaced} run-together vs ${d.spaced} word-spaced readings`, note: 'readings should be run-together (no spaces between words); this lesson still has word-spaced readings' });
// praise and prompt-style per chapter
const praiseDist = {}; const promptLeadByChapter = {};
for (const it of items) if (it.cur) {
  if (it.ft === 'praise') (praiseDist[chapterOf(it.rid)] ??= {})[it.text] = (praiseDist[chapterOf(it.rid)][it.text] || 0) + 1;
  if (it.ft === 'prompt') { const w = it.text.split(/\s+/)[0].replace(/[^A-Za-z]/g, '') || '(JA)'; (promptLeadByChapter[chapterOf(it.rid)] ??= {})[w] = (promptLeadByChapter[chapterOf(it.rid)][w] || 0) + 1; }
}
for (const it of items) if (it.cur && it.ft === 'praise' && it.text !== 'Well done!') find('c8.praise-differs', 'low', it, it.text, 0, 30, `praise "${it.text}" differs from the standard "Well done!" used by ${Object.values(praiseDist).reduce((s, d) => s + (d['Well done!'] || 0), 0)} screens`);
// ellipsis style and list-separator style
const ellipsis = { '…': 0, '...': 0 }; for (const it of items) if (it.cur && it.phase !== 'tts') { if (it.text.includes('…')) ellipsis['…']++; if (it.text.includes('...')) ellipsis['...']++; }
// Japanese embedded in English-lang fields without lang markup (presentation)
const mixedLang = {};
for (const it of items) if (it.cur && it.lang === 'en' && hasJa(it.text) && it.phase !== 'tts') { mixedLang[it.ft] = (mixedLang[it.ft] || 0) + 1; }
const tableCellsMixed = items.filter(i => i.cur && i.ft === 'table.cell' && hasJa(i.text)).length;

// ---------------------------------------------------------------- summary
const curFindings = findings.filter(f => f.current);
const countBy = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; return m; }, {});
const byCheck = {};
for (const f of findings) { const c = (byCheck[f.check] ??= { current: { high: 0, medium: 0, low: 0, total: 0 }, olderVersionsOnly: 0 }); if (f.current) { c.current[f.severity]++; c.current.total++; } else c.olderVersionsOnly++; }
const byGroup = {};
for (const [k, v] of Object.entries(byCheck)) { const g = k.split('.')[0]; const gg = (byGroup[g] ??= { high: 0, medium: 0, low: 0, total: 0 }); for (const s of ['high', 'medium', 'low', 'total']) gg[s] += v.current[s]; }
const posSummary = positions;
const chapters = [...new Set(packs.map(p => chapterOf(p.pack.recordId)))].sort();
const perChapter = {}; for (const f of curFindings) { const c = chapterOf(f.recordId); (perChapter[c] ??= {}); perChapter[c][f.check.split('.')[0]] = (perChapter[c][f.check.split('.')[0]] || 0) + 1; }

const out = {
  meta: {
    generated: new Date().toISOString(), script: 'apps/web/content/busuu/b2-polish/consistency-scan.mjs',
    packFilesScanned: files.length, canonicalRecords: currentVersion.size, currentVersionPacks: packs.filter(p => currentVersion.get(p.pack.recordId) === p.pack.contentVersion).length,
    olderVersionsScanned: packs.filter(p => currentVersion.get(p.pack.recordId) !== p.pack.contentVersion).map(p => `${p.pack.recordId}@${p.pack.contentVersion}`),
    unregisteredFiles: unregistered, currentScreens: screensMeta.filter(s => s.cur).length, visibleStringsScanned: items.filter(i => i.cur).length,
    note: 'Findings with current:false belong to preserved older versions and are excluded from current totals. Hidden transcript-free scripts, audio text, provenance/sourceContract/evidence are not scanned (audio.reading only for reading validity).',
  },
  summary: { byCheckCurrent: byCheck, byGroupCurrent: byGroup, perChapterCurrent: perChapter, severityCurrent: countBy(curFindings, f => f.severity) },
  distributions: {
    englishEndPunctuationByFieldType: enEndDist,
    japaneseSentenceEndingByFieldType: termDist,
    tildeVariants: { counts: tildeCounts, examples: tildeFirst },
    spelling: spellSummary,
    quotes: { straightApostrophe: quoteStats.straightApos.length, curlyApostrophe: quoteStats.curlyApos.length, straightDoubleQuote: quoteStats.straightDq.length, curlyDoubleQuote: quoteStats.curlyDq.length },
    readingCoverageByFieldType: rdStats,
    readingsWithKatakana: kataReadings.length, readingsHiraganaOnly: hiraReadings,
    readingSpacingByChapter: spacingRatio, readingSpacingDeviantLessons: spacingDeviants, readingSpacingMixedLessons: mixedSpacingLessons.map(([k, v]) => ({ recordId: k, ...v })),
    praiseByChapter: praiseDist, promptFirstWordByChapter: promptLeadByChapter, ellipsisStyle: ellipsis,
    correctOptionPosition: posSummary,
    englishFieldsContainingJapanese: mixedLang, tableCellsWithJapanese: tableCellsMixed,
    layoutRiskCounts: layoutCounts,
  },
  layoutRiskWorst30: layoutCurrent.slice(0, 30).map(l => ({ kind: l.kind, length: l.len, threshold: l.threshold, recordId: l.it.rid, screenId: l.it.sid, field: l.it.path, text: l.text.slice(0, 90) })),
  instructionTemplates: { verbDistribution: verbDist, prefixDistribution: prefixDist, cueDistribution: cueDist, perRenderer: Object.fromEntries(Object.entries(templateTable).map(([k, v]) => [k, { totalScreens: v.totalScreens, distinctTemplates: v.distinctTemplates, leadVerbPhrases: v.leadVerbPhrases, top: v.top, all: v.all }])), nearDuplicatePairs: nearDup.sort((a, b) => (b.aCount + b.bCount) - (a.aCount + a.bCount)) },
  repeatedExplanations,
  findings: findings.sort((a, b) => (b.current - a.current) || (SEV[b.severity] - SEV[a.severity]) || a.check.localeCompare(b.check) || a.recordId.localeCompare(b.recordId) || String(a.screenId).localeCompare(String(b.screenId))),
  sharedComponentObservations: [
    { file: 'components/busuu/LessonScreen.tsx', note: 'Kanji screens show hard-coded caption "Static shape study · animation replacement" (internal build-language visible to learners).' },
    { file: 'components/busuu/LessonScreen.tsx', note: 'Dialogue caption is hard-coded as "<context> · app TTS dialogue replacement"; falls back to "Hotel scene" when a pack omits dialogue.context.' },
    { file: 'components/busuu/LessonRunner.tsx', note: 'Hard-coded sentence "Reuses the <context> from screen N." on scene-reuse screens and fallback "guest/staff hotel scene".' },
    { file: 'components/busuu/LessonScreen.tsx', note: 'Support/explanation blocks, hint paragraphs, kanji notes and table <td> cells are rendered without lang="ja" on embedded Japanese runs (screen readers read Japanese in the English voice). Only top-level Japanese blocks and ItemText set lang.' },
    { file: 'components/busuu/LessonLaunch.tsx', note: 'Launch copy mixes British "Ready to practise" with American spelling elsewhere (for example "favorite" in pack text, "color" if introduced).' },
    { file: 'components/busuu/LessonLaunch.tsx', note: 'Readiness list and "Documented lesson sequence" use developer language (screen IDs, "Source limitations and app choices", "Images and video use neutral placeholders").' },
  ],
};
fs.writeFileSync(process.env.B2_SCAN_OUT ? path.resolve(process.env.B2_SCAN_OUT) : path.join(here, 'consistency-scan.json'), JSON.stringify(out, null, 1));
// console digest
console.log(`Packs scanned: ${files.length} (${currentVersion.size} canonical records; ${out.meta.olderVersionsScanned.length} older versions)`);
console.log(`Visible strings (current): ${out.meta.visibleStringsScanned}; screens (current): ${out.meta.currentScreens}`);
console.log('Findings (current) by check:'); for (const [k, v] of Object.entries(byCheck).sort()) console.log(`  ${k.padEnd(38)} ${String(v.current.total).padStart(5)}  (H${v.current.high} M${v.current.medium} L${v.current.low})  older-only:${v.olderVersionsOnly}`);
console.log('By group:', JSON.stringify(byGroup));
console.log('Wrote', process.env.B2_SCAN_OUT ? path.resolve(process.env.B2_SCAN_OUT) : path.join(here, 'consistency-scan.json'));
