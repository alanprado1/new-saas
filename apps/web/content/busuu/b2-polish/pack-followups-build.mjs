#!/usr/bin/env node
// Follow-up content versions made after the 8 October 2026 text polish. Each entry builds the NEXT version of one record from its
// current polished version (never modifying it) and is described in pack-followups.json (checked by pack-text-checks.mjs checkFollowups).
//   node content/busuu/b2-polish/pack-followups-build.mjs           dry run (prints and compares with the files on disk)
//   node content/busuu/b2-polish/pack-followups-build.mjs --write   writes the new version files
// Run from apps/web.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

// B2.C02.L02 v3 (1.2.0): the Busuu 参 screen shows three examples (参る / お墓参り / 参加); v2 had two. The word list was observed in an owner
// screenshot; the example sentence, reading and translation for お墓参り are app-authored.
export const KANJI_SAN_EXAMPLE = {
  word: 'お墓参り', reading: 'おはかまいり', meaning: 'a visit to the family grave',
  sentence: 'お盆に家族でお墓参りに行きます。', sentenceReading: 'おぼんにかぞくでおはかまいりにいきます。',
  translation: 'We visit the family grave together during Obon.',
};
const NOTE_SUFFIX = ' Content 1.2.0 (8 October 2026, owner-approved): the 参 kanji screen (A01.S01) gained a third example, お墓参り, between 参る and 参加, matching the three-word list observed in an owner screenshot of the live course; its sentence, reading and translation are app-authored. Nothing else changed from 1.1.0.';

export function buildC02L02V3() {
  const pack = JSON.parse(read('b2-c02-l02.v2.json'));
  assert.equal(pack.contentVersion, '1.1.0');
  pack.contentVersion = '1.2.0';
  pack.provenance.note += NOTE_SUFFIX;
  const screen = pack.screens.find(s => s.screenId === 'B2.C02.L02.A01.S01');
  assert.deepEqual(screen.kanji.examples.map(e => e.word), ['参る', '参加']);
  screen.kanji.examples.splice(1, 0, structuredClone(KANJI_SAN_EXAMPLE));
  return JSON.stringify(pack, null, 2) + '\n';
}
export const FOLLOWUP_BUILDS = [{ recordId: 'B2.C02.L02', file: 'b2-c02-l02.v3.json', build: buildC02L02V3 }];

if (process.argv[1]?.endsWith('pack-followups-build.mjs')) {
  const write = process.argv.includes('--write');
  for (const b of FOLLOWUP_BUILDS) {
    const bytes = b.build();
    const target = path.join(root, b.file);
    if (write) { fs.writeFileSync(target, bytes); console.log('wrote', b.file); }
    else console.log(b.file, fs.existsSync(target) && fs.readFileSync(target, 'utf8') === bytes ? 'matches' : 'differs/missing');
  }
}
