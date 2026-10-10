// Writes pack-followups.json (run from apps/web after pack-followups-build.mjs --write):  node content/busuu/b2-polish/pack-followups-manifest.mjs
// Entries are in release order; a record can appear twice (B2.C02.L02: 1.1.0 -> 1.2.0 -> 1.3.0), each entry starting from the previous file.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
import { KANJI_SAN_EXAMPLE } from './pack-followups-build.mjs';
import { KANJI_BUSUU_SOURCE, KANJI_BUSUU_SYNC } from './kanji-busuu-sync.mjs';
const root = path.resolve(import.meta.dirname, '..');
const server = loadCourseModule('lib/busuu/attempt-server.ts');
const digest = f => createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex');
const from = (file, contentVersion, recordId) => ({ file, contentVersion, fileHash: digest(file), persistenceFingerprint: server.coursePack(recordId, contentVersion).hash });

const packs = [{ recordId: 'B2.C02.L02', screenId: 'B2.C02.L02.A01.S01', kind: 'kanji-example-added', origin: 'app_authored',
  from: from('b2-c02-l02.v2.json', '1.1.0', 'B2.C02.L02'),
  toVersion: '1.2.0', file: 'b2-c02-l02.v3.json', fileHash: digest('b2-c02-l02.v3.json'),
  insertedAfterWord: '参る', addedExamples: [KANJI_SAN_EXAMPLE] }];
for (const [recordId, t] of Object.entries(KANJI_BUSUU_SYNC)) {
  const screens = t.screens.map(s => ({ screenId: s.screenId, character: s.character, exampleCount: s.examples.length,
    reusedSentences: s.examples.filter(e => e.sentenceOrigin === 'app_existing').length,
    authoredSentences: s.examples.filter(e => e.sentenceOrigin === 'app_authored').length }));
  packs.push({ recordId, kind: 'kanji-busuu-sync', origin: 'observed_busuu (word, reading, meaning) + app_authored (new sentences)', source: KANJI_BUSUU_SOURCE,
    from: from(t.fromFile, t.fromVersion, recordId), toVersion: t.toVersion, file: t.toFile, fileHash: digest(t.toFile), screens });
}
fs.writeFileSync(path.join(import.meta.dirname, 'pack-followups.json'), JSON.stringify({ date: '2026-10-08', packs }, null, 2) + '\n');
console.log(`${packs.length} follow-up entries written`);
