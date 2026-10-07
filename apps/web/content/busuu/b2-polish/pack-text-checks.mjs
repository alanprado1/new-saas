// Shared checks for the B2 pack-text polish. Imported by pack-text-validation.mjs and lib/busuu-pack-text-polish.test.mjs.
// Everything here is read-only and runs against the real registry/readiness/alignment modules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
import { australian, curlyApostrophes, learnerFields, KANJI_DISCLAIMER_BLOCKS } from './pack-text-transform.mjs';

export const root = path.resolve(import.meta.dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const JA = /[぀-ヿ㐀-鿿]/;

export const baseline = () => read('b2-polish/registered-fingerprints.json');
export const changes = () => read('b2-polish/pack-text-changes.json');
export const rawStructure = () => read('b2-structure.json').records;

// ------------------------------------------------------------------ 1. old versions are untouched
export function checkBaseline() {
  const server = loadCourseModule('lib/busuu/attempt-server.ts');
  const registry = loadCourseModule('lib/busuu/content-registry.ts');
  const b = baseline();
  for (const p of b.packs) {
    const bytes = fs.readFileSync(path.join(root, p.file));
    assert.equal(digest(bytes), p.fileHash, `${p.file} bytes unchanged`);
    const { pack, hash } = server.coursePack(p.recordId, p.contentVersion);
    assert.equal(hash, p.persistenceFingerprint, `${p.file} persistence fingerprint unchanged`);
    assert.equal(pack.contentVersion, p.contentVersion);
    assert.equal(registry.getContentPack(p.recordId, p.contentVersion).contentVersion, p.contentVersion, `${p.recordId}@${p.contentVersion} still resolves`);
  }
  for (const r of b.rawFiles) assert.equal(digest(fs.readFileSync(path.join(root, r.file))), r.fileHash, `${r.file} raw evidence unchanged`);
  return { versions: b.packs.length, rawFiles: b.rawFiles.length };
}

// ------------------------------------------------------------------ 2. registry
export function checkRegistry() {
  const registry = loadCourseModule('lib/busuu/content-registry.ts');
  const c = changes(), b = baseline();
  const changed = new Set(c.packs.map(p => p.recordId));
  for (const p of c.packs) {
    const current = registry.getContentPack(p.recordId);
    assert.equal(current.contentVersion, p.toVersion, `${p.recordId} current version`);
    assert.equal(registry.getContentPack(p.recordId, p.toVersion), current);
    assert.equal(registry.getContentPack(p.recordId, p.fromVersion).contentVersion, p.fromVersion, `${p.recordId} previous version still resolves`);
    const stored = read(p.file);
    assert.deepEqual(current, stored, `${p.file} is what the registry serves`);
  }
  let unchangedCurrent = 0;
  for (const rid of new Set(b.packs.map(p => p.recordId))) if (!changed.has(rid)) {
    const newest = b.packs.filter(p => p.recordId === rid).map(p => p.contentVersion).sort((x, y) => x.localeCompare(y, undefined, { numeric: true })).at(-1);
    assert.equal(registry.getContentPack(rid).contentVersion, newest, `${rid} unchanged current`); unchangedCurrent++;
  }
  return { changedRecords: changed.size, unchangedRecords: unchangedCurrent, records: changed.size + unchangedCurrent };
}

// ------------------------------------------------------------------ 3. readiness and alignment for every new version
export function checkReadinessAndAlignment() {
  const registry = loadCourseModule('lib/busuu/content-registry.ts');
  const readiness = loadCourseModule('lib/busuu/content-readiness.ts');
  const raw = rawStructure();
  let n = 0;
  for (const p of changes().packs) {
    const pack = read(p.file), spec = raw.find(r => r.recordId === pack.recordId);
    assert.ok(spec, `${pack.recordId} has a canonical structure record`);
    assert.equal(readiness.getPackReadiness(pack).playable, true, `${p.file} playable`);
    registry.assertContentAlignment(pack, spec);
    n++;
  }
  return { packs: n };
}

// ------------------------------------------------------------------ 4. answer-key invariance (leaf-level diff against the predecessor)
function flatten(value, prefix, out) {
  if (Array.isArray(value)) { out.set(`${prefix}#len`, value.length); value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out)); }
  else if (value && typeof value === 'object') { out.set(`${prefix}#keys`, Object.keys(value).join(',')); for (const k of Object.keys(value)) flatten(value[k], prefix ? `${prefix}.${k}` : k, out); }
  else out.set(prefix, value);
}
const screenPath = 'screens\\[(\\d+)\\]';

// Returns the list of changed leaf paths; throws on any change that is not learner text.
export function checkInvariance(oldPackRaw, newPack) {
  // The only structural edit allowed: meta-only explanation blocks on kanji screens are deleted (exact text match against KANJI_DISCLAIMER_BLOCKS).
  const oldPack = structuredClone(oldPackRaw);
  for (const screen of oldPack.screens) if (screen.renderer === 'kanji') for (const ph of ['before', 'after']) screen.support[ph] = screen.support[ph].filter(b => !(b.kind === 'explanation' && KANJI_DISCLAIMER_BLOCKS.has(b.text)));
  const a = new Map(), b = new Map();
  flatten(oldPack, '', a); flatten(newPack, '', b);
  const isL01 = oldPack.recordId === 'B2.C01.L01';
  const changed = [];
  const keys = new Set([...a.keys(), ...b.keys()]);
  const screenOf = (pack, p) => { const m = new RegExp(`^${screenPath}`).exec(p); return m ? pack.screens[Number(m[1])] : null; };
  for (const p of keys) {
    const va = a.get(p), vb = b.get(p);
    if (a.has(p) && b.has(p) && Object.is(va, vb)) continue;
    const m = new RegExp(`^${screenPath}\\.(.*)$`).exec(p);
    const rel = m ? m[2] : p, sa = screenOf(oldPack, p), sb = screenOf(newPack, p);
    const fail = why => assert.fail(`${oldPack.recordId}@${oldPack.contentVersion}→${newPack.contentVersion}: forbidden change at ${p} (${why}): ${JSON.stringify(va)} → ${JSON.stringify(vb)}`);
    const english = () => typeof va === 'string' && typeof vb === 'string';
    // a reading edit is: spacing only, or spacing removed plus hiragana letters swapped for the same katakana letters (never any other content change); L01 authored its own reading layer
    const reading = () => typeof vb === 'string' && !/[ 　]/.test(vb) && (isL01 || (typeof va === 'string' && (sameReadingModuloKatakana(va.replace(/[ 　]+/g, ''), vb) || punctuationFix(sa?.screenId, rel, va.replace(/[ 　]+/g, ''), vb))));
    // container markers: only a new `secondary` key (L01 reading layer) may change a key list
    if (p.endsWith('#keys')) {
      const owner = p.slice(0, -5);
      if (isL01 && /^screens\[\d+\]\.support\.(before|after)\[\d+\]$/.test(owner)) { assert.equal(vb, 'kind,text,secondary'); assert.equal(va, 'kind,text'); changed.push(p); continue; }
      fail('object keys differ');
    }
    if (p.endsWith('#len')) fail('array length differs');
    if (p === 'contentVersion') { assert.match(vb, /^\d+\.\d+\.0$/); continue; }
    if (p === 'provenance.note') { assert.ok(vb.startsWith(va), 'provenance note only appended'); changed.push(p); continue; }
    if (!sa || !sb) fail('not a screen field');
    let mm;
    if (/^(prompt|statement)$/.test(rel) || /^hint\.text$/.test(rel) || rel === 'typed.label') { if (!english()) fail('not text'); changed.push(p); continue; }
    if (rel === 'praise') { assert.equal(vb, 'Well done!'); changed.push(p); continue; }
    if ((mm = /^support\.(before|after)\[(\d+)\]\.(text|secondary)$/.exec(rel))) {
      const block = sa.support[mm[1]][Number(mm[2])] ?? sb.support[mm[1]][Number(mm[2])];
      if (mm[3] === 'text') { if (block.kind === 'japanese') fail('Japanese support text must not change'); if (!english()) fail('not text'); }
      else { if (block.kind !== 'japanese' || !reading()) fail('reading edit not spacing-only'); }
      changed.push(p); continue;
    }
    if (/^dialogue\.(context|speakerLabels\.(guest|staff)|turns\[\d+\]\.english|glosses\[\d+\]\.english)$/.test(rel)) { if (!english()) fail('not text'); changed.push(p); continue; }
    if (/^dialogue\.glosses\[\d+\]\.reading$/.test(rel)) { if (!reading()) fail('reading edit'); changed.push(p); continue; }
    if (/^kanji\.(shapeNote|meaning|readings\[\d+\]\.note|examples\[\d+\]\.(meaning|translation))$/.test(rel)) { if (!english()) fail('not text'); changed.push(p); continue; }
    if (/^kanji\.examples\[\d+\]\.(reading|sentenceReading)$/.test(rel)) { if (!reading()) fail('reading edit'); changed.push(p); continue; }
    if (rel === 'table.caption' || /^table\.columns\[\d+\]$/.test(rel)) { if (!english()) fail('not text'); changed.push(p); continue; }
    if ((mm = /^table\.rows\[(\d+)\]\.cells\[(\d+)\]$/.exec(rel))) {
      const col = sa.table.columns[Number(mm[2])];
      if (/^reading( in this example)?$/i.test(col.trim())) { if (!reading()) fail('reading cell edit'); }
      else { if (!english() || JA.test(va)) fail('only English cells may change'); }
      changed.push(p); continue;
    }
    if ((mm = /^answer\.options\[(\d+)\]\.(text|secondary)$/.exec(rel))) {
      if (mm[2] === 'secondary') { if (!reading()) fail('option reading edit'); }
      else { if (!english() || JA.test(va) || vb !== australian(curlyApostrophes(va))) fail('option text may only change by spelling'); }
      changed.push(p); continue;
    }
    if ((mm = /^(left|right)\[(\d+)\]\.(text|secondary)$/.exec(rel))) {
      if (mm[3] === 'secondary') { if (!reading()) fail('pair reading edit'); }
      else { if (!english() || JA.test(va) || vb !== australian(curlyApostrophes(va))) fail('pair text may only change by spelling'); }
      changed.push(p); continue;
    }
    if (/^completion\.optionalSurfaces\[\d+\]\.(prompt|hint)$/.test(p)) { if (vb !== australian(curlyApostrophes(va))) fail('spelling only'); changed.push(p); continue; }
    fail('not a learner-text field');
  }
  return changed;
}

export function checkAllInvariance() {
  const out = { packs: 0, changedFields: 0, screens: 0 };
  for (const p of changes().packs) {
    const oldPack = read(baselineFile(p.recordId, p.fromVersion)), newPack = read(p.file);
    const changed = checkInvariance(oldPack, newPack);
    // explicit answer-surface equality (belt and braces on top of the leaf diff)
    assert.equal(oldPack.screens.length, newPack.screens.length);
    oldPack.screens.forEach((s, i) => {
      const t = newPack.screens[i];
      assert.equal(t.screenId, s.screenId);
      const key = x => JSON.stringify({ renderer: x.renderer, truthMode: x.truthMode, scaffold: x.scaffold, fixedPrefix: x.fixedPrefix, typed: x.typed && { before: x.typed.before, after: x.typed.after },
        answer: x.answer && { ...x.answer, options: x.answer.options?.map(o => o.id) }, leftIds: x.left?.map(o => o.id), rightIds: x.right?.map(o => o.id),
        audio: x.audio, sourceContract: x.sourceContract, evidence: x.evidence, unresolved: x.unresolved, sceneContext: x.sceneContext, visual: x.visual,
        dialogue: x.dialogue && { ...x.dialogue, context: undefined, speakerLabels: undefined, turns: x.dialogue.turns?.map(u => ({ id: u.id, speaker: u.speaker, japanese: u.japanese, reading: u.reading })), glosses: x.dialogue.glosses?.map(g => ({ japanese: g.japanese })) } });
      assert.equal(key(t), key(s), `${s.screenId} answer spec, tokens, option IDs, audio, source contract and evidence identical`);
      out.screens++;
    });
    for (const k of Object.keys(oldPack)) if (!['screens', 'contentVersion', 'provenance'].includes(k)) assert.deepEqual(newPack[k], oldPack[k], `${p.recordId} ${k} identical (partitions, counts, retry policy, completion, contract)`);
    out.packs++; out.changedFields += changed.length;
  }
  return out;
}
const baselineFile = (recordId, version) => baseline().packs.find(p => p.recordId === recordId && p.contentVersion === version).file;

// ------------------------------------------------------------------ 5. wording guard on every CURRENT pack (changed or not)
const toHira = x => x.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
// The single approved punctuation alignment: the B2.C08.L07.A01.S04 reading ended its question with 。 while the surface has ？.
export function punctuationFix(screenId, rel, before, after) {
  return screenId === 'B2.C08.L07.A01.S04' && rel === 'support.after[0].secondary' && before.includes('どう。') && sameReadingModuloKatakana(before.replace('どう。', 'どう？'), after);
}
export function sameReadingModuloKatakana(before, after) {
  if (before.length !== after.length) return false;
  for (let k = 0; k < before.length; k++) if (before[k] !== after[k] && !(/[ァ-ヶ]/.test(after[k]) && toHira(after[k]) === before[k])) return false;
  return true;
}
export const LEAK = /NFKC|\b(this|the) app (accepts|checks|grades|authors|forms)\b|\bapp forms\b|\bAccepted app\b|\b(this|the) occurrence\b|\bretained\b|\bauthored\b|\bphysical\b|\btokens?\b|source animation|replac(es|ing|ed) (the )?(source |deferred )?animation|animation (is )?deferred|\bresponse slots?\b|source focus|reviewed romaji|\bexplicit(ly)? accepts?\b|explicit (romaji|script)|without a full|full (listening )?transcript|feedback (gives|retains)|\bdistractor\b|romani[sz]|Unicode width|\bnormali[sz]ed\b|etymolog|stroke-order|historical (derivation|account)|\bmemory aids?\b|visual (aid|mnemonic)|\bmakes no\b|\bpartial credit\b|\bthis (example|task) (describes|does not|practises|states|requests)\b/i;
export function checkWording() {
  const registry = loadCourseModule('lib/busuu/content-registry.ts');
  const records = [...new Set(baseline().packs.map(p => p.recordId))];
  let strings = 0;
  for (const rid of records) {
    const pack = registry.getContentPack(rid);
    for (const screen of pack.screens) for (const f of learnerFields(structuredClone(screen))) {
      strings++;
      if (f.type === 'en') {
        const t = f.obj[f.key];
        assert.ok(!LEAK.test(t), `${screen.screenId} ${f.path} still has engine/provenance wording: ${t}`);
        assert.equal(australian(curlyApostrophes(t)), t, `${screen.screenId} ${f.path} is Australian English with curly apostrophes`);
        if (f.path === 'praise') assert.equal(t, 'Well done!');
        if (f.path === 'prompt') { assert.match(t, /[A-Za-z]{3}/, `${screen.screenId} prompt has an English instruction`); assert.ok(!/^[a-z]/.test(t), `${screen.screenId} prompt starts uppercase`); }
      } else assert.ok(!/[ 　]/.test(f.obj[f.key]), `${screen.screenId} ${f.path} reading has no word spaces`);
    }
  }
  return { records: records.length, learnerStrings: strings };
}

// ------------------------------------------------------------------ 6. what was deliberately left alone
export function checkLeftAlone() {
  // TTS-only strings keep their old spacing; Japanese support text, scaffolds and tokens never change (covered by checkInvariance too).
  let audioReadingsWithSpaces = 0, dialogueReadingsWithSpaces = 0;
  const registry = loadCourseModule('lib/busuu/content-registry.ts');
  for (const rid of new Set(baseline().packs.map(p => p.recordId))) for (const s of registry.getContentPack(rid).screens) {
    if (s.audio?.reading && /\s/.test(s.audio.reading)) audioReadingsWithSpaces++;
    for (const t of s.dialogue?.turns ?? []) if (t.reading && /\s/.test(t.reading)) dialogueReadingsWithSpaces++;
  }
  return { audioReadingsWithSpaces, dialogueReadingsWithSpaces };
}

// ------------------------------------------------------------------ 7. B2.C01.L01 authored reading layer: kana only, katakana words stay katakana, no spaces, no kanji
export function checkL01Readings() {
  const pack = loadCourseModule('lib/busuu/content-registry.ts').getContentPack('B2.C01.L01');
  const pairs = [];
  for (const s of pack.screens) {
    for (const ph of ['before', 'after']) for (const b of s.support[ph]) if (b.kind === 'japanese' && b.secondary) pairs.push([s.screenId, b.text, b.secondary]);
    for (const o of s.answer?.options ?? []) if (o.secondary) pairs.push([s.screenId, o.text, o.secondary]);
    for (const side of ['left', 'right']) for (const o of s[side] ?? []) if (o.secondary) pairs.push([s.screenId, o.text, o.secondary]);
  }
  for (const [id, text, reading] of pairs) {
    assert.ok(!/[㐀-䶿一-鿿々]/.test(reading), `${id} reading has no kanji: ${reading}`);
    assert.ok(!/[ \u3000]/.test(reading), `${id} reading has no spaces`);
    for (const word of text.match(/[゠-ヿー]+/g) ?? []) assert.ok(reading.includes(word), `${id} keeps katakana ${word} in its reading: ${reading}`);
  }
  return { readingLines: pairs.length };
}

// ------------------------------------------------------------------ 8. every visible reading keeps the katakana runs of its Japanese surface
export function checkKatakanaReadings() {
  const registry = loadCourseModule('lib/busuu/content-registry.ts');
  const c = changes();
  const listed = new Set([...(c.skippedKatakana ?? []).map(k => `${k.screenId}|${k.path}`), ...(c.deferredKatakanaNoVersion ?? []).flatMap(d => d.lines.map(l => `${l.screenId}|${l.path}`))]);
  const unlisted = [], seen = new Set();
  let linesWithKatakana = 0;
  for (const rid of new Set(baseline().packs.map(p => p.recordId))) for (const screen of registry.getContentPack(rid).screens) for (const f of learnerFields(structuredClone(screen))) {
    if (f.type !== 'rd' || !f.surface) continue;
    const runs = katakanaRunsOf(f.surface);
    if (!runs.length) continue;
    linesWithKatakana++;
    const missing = runs.filter(run => !f.obj[f.key].includes(run));
    if (!missing.length) continue;
    const key = `${screen.screenId}|${f.path}`;
    seen.add(key);
    if (!listed.has(key)) unlisted.push(`${key}: ${f.surface} / ${f.obj[f.key]}`);
  }
  assert.deepEqual(unlisted, [], 'every reading line keeps the katakana runs of its surface unless it is listed as skipped or deferred');
  for (const key of listed) assert.ok(seen.has(key), `${key} is listed but no longer lacks its katakana (stale list)`);
  return { linesWithKatakana, listedStillLacking: seen.size };
}
const katakanaRunsOf = surface => surface.match(/[ァ-ヶー]*[ァ-ヶ][ァ-ヶー]*/g) ?? [];
