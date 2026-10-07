// Writes pack-followups.json (run from apps/web after pack-followups-build.mjs --write):  node content/busuu/b2-polish/pack-followups-manifest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
import { KANJI_SAN_EXAMPLE } from './pack-followups-build.mjs';
const root = path.resolve(import.meta.dirname, '..');
const server = loadCourseModule('lib/busuu/attempt-server.ts');
const digest = f => createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex');
const entry = { recordId: 'B2.C02.L02', screenId: 'B2.C02.L02.A01.S01', kind: 'kanji-example-added', origin: 'app_authored',
  from: { file: 'b2-c02-l02.v2.json', contentVersion: '1.1.0', fileHash: digest('b2-c02-l02.v2.json'), persistenceFingerprint: server.coursePack('B2.C02.L02', '1.1.0').hash },
  toVersion: '1.2.0', file: 'b2-c02-l02.v3.json', fileHash: digest('b2-c02-l02.v3.json'),
  insertedAfterWord: '参る', addedExamples: [KANJI_SAN_EXAMPLE] };
fs.writeFileSync(path.join(import.meta.dirname, 'pack-followups.json'), JSON.stringify({ date: '2026-10-08', packs: [entry] }, null, 2) + '\n');
console.log(JSON.stringify(entry, null, 1));
