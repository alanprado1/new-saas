#!/usr/bin/env node
// Follow-up content versions made after the 8 October 2026 text polish. Each entry builds the NEXT version of one record from its
// current polished version (never modifying it) and is described in pack-followups.json (checked by pack-text-checks.mjs checkFollowups).
//   node content/busuu/b2-polish/pack-followups-build.mjs           dry run (prints and compares with the files on disk)
//   node content/busuu/b2-polish/pack-followups-build.mjs --write   writes the new version files
// Run from apps/web.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { KANJI_BUSUU_SYNC } from './kanji-busuu-sync.mjs';

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

// Kanji screens synced to Busuu (8 October 2026, owner-approved): the observed readings, meaning and example words of the 55 B2 kanji teaching
// screens (data and per-item origins in kanji-busuu-sync.mjs). One new version per affected record, built from the record's current latest file.
const SYNC_DATE_NOTE = '8 October 2026, owner-approved';
function buildKanjiBusuuSync(recordId) {
  const target = KANJI_BUSUU_SYNC[recordId];
  const pack = JSON.parse(read(target.fromFile));
  assert.equal(pack.recordId, recordId);
  assert.equal(pack.contentVersion, target.fromVersion, `${recordId} starts from ${target.fromVersion}`);
  const kanjiScreens = pack.screens.filter(s => s.renderer === 'kanji');
  assert.deepEqual(kanjiScreens.map(s => s.screenId), target.screens.map(s => s.screenId), 'every kanji screen of the record is covered, in order');
  let authored = 0;
  for (const t of target.screens) {
    const screen = kanjiScreens.find(s => s.screenId === t.screenId);
    const k = screen.kanji;
    assert.equal(k.character, t.character, `${t.screenId} glyph`);
    const oldReadings = new Map(k.readings.map(r => [r.text, r.note]));
    const oldExamples = new Map(k.examples.map(e => [e.word, e]));
    k.meaning = t.meaning;
    k.readings = t.readings.map(r => {
      if (r.noteOrigin === 'app_existing') assert.ok(r.note && [...oldReadings.values()].includes(r.note), `${t.screenId} ${r.text}: kept note exists in the starting pack`);
      return { text: r.text, note: r.note };
    });
    k.examples = t.examples.map(e => {
      let sentence = e.sentence, sentenceReading = e.sentenceReading, translation = e.translation;
      if (e.sentenceOrigin === 'app_existing') {
        const old = oldExamples.get(e.word);
        assert.ok(old, `${t.screenId} ${e.word} was already taught on this screen`);
        ({ sentence, sentenceReading, translation } = old);
      } else {
        assert.equal(e.sentenceOrigin, 'app_authored');
        assert.ok(!oldExamples.has(e.word), `${t.screenId} ${e.word} is a new word`);
        assert.ok(sentence.includes(e.word), `${t.screenId} sentence uses ${e.word} exactly as written`);
        authored++;
      }
      return { word: e.word, reading: e.reading, meaning: e.meaning, sentence, sentenceReading, translation };
    });
  }
  pack.contentVersion = target.toVersion;
  pack.provenance.note += ` Content ${target.toVersion} (${SYNC_DATE_NOTE}): the ${target.screens.length} kanji teaching screens (${target.screens.map(s => s.character).join(' ')}) now carry the readings, meaning and example words observed on busuu.com's kanji lessons on 8 October 2026${authored ? `; the sentences for the ${authored} newly added example words are app-authored` : ''}, and every other sentence is unchanged. Nothing else changed from ${target.fromVersion}.`;
  return JSON.stringify(pack, null, 2) + '\n';
}
export const buildC02L02V4 = () => buildKanjiBusuuSync('B2.C02.L02');
export const buildC02L07V3 = () => buildKanjiBusuuSync('B2.C02.L07');
export const buildC03L06V3 = () => buildKanjiBusuuSync('B2.C03.L06');
export const buildC04L04V3 = () => buildKanjiBusuuSync('B2.C04.L04');
export const buildC05L02V3 = () => buildKanjiBusuuSync('B2.C05.L02');
export const buildC06L05V3 = () => buildKanjiBusuuSync('B2.C06.L05');
export const buildC07L04V3 = () => buildKanjiBusuuSync('B2.C07.L04');
export const buildC08L04V3 = () => buildKanjiBusuuSync('B2.C08.L04');
export const buildC09L03V3 = () => buildKanjiBusuuSync('B2.C09.L03');
export const buildC09L08V3 = () => buildKanjiBusuuSync('B2.C09.L08');
export const buildC10L05V3 = () => buildKanjiBusuuSync('B2.C10.L05');

export const FOLLOWUP_BUILDS = [
  { recordId: 'B2.C02.L02', file: 'b2-c02-l02.v3.json', build: buildC02L02V3 },
  ...[['B2.C02.L02', buildC02L02V4], ['B2.C02.L07', buildC02L07V3], ['B2.C03.L06', buildC03L06V3], ['B2.C04.L04', buildC04L04V3], ['B2.C05.L02', buildC05L02V3],
    ['B2.C06.L05', buildC06L05V3], ['B2.C07.L04', buildC07L04V3], ['B2.C08.L04', buildC08L04V3], ['B2.C09.L03', buildC09L03V3], ['B2.C09.L08', buildC09L08V3],
    ['B2.C10.L05', buildC10L05V3]].map(([recordId, build]) => ({ recordId, file: KANJI_BUSUU_SYNC[recordId].toFile, build, kind: 'kanji-busuu-sync' })),
];

if (process.argv[1]?.endsWith('pack-followups-build.mjs')) {
  const write = process.argv.includes('--write');
  for (const b of FOLLOWUP_BUILDS) {
    const bytes = b.build();
    const target = path.join(root, b.file);
    if (write) { fs.writeFileSync(target, bytes); console.log('wrote', b.file); }
    else console.log(b.file, fs.existsSync(target) && fs.readFileSync(target, 'utf8') === bytes ? 'matches' : 'differs/missing');
  }
}
