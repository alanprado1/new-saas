// Writes (once, before the polish) or verifies the exact bytes and saved-attempt fingerprint of every registered B2 pack version.
//   node content/busuu/b2-polish/registered-fingerprints.mjs baseline   -> writes registered-fingerprints.json from the CURRENT registry
//   node content/busuu/b2-polish/registered-fingerprints.mjs            -> verifies every recorded version is still registered, byte-identical and fingerprint-identical
// Run from apps/web. Reads only; the baseline file is the immutable list that later versions are checked against.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';

const root = path.resolve(import.meta.dirname, '..');
const baselineFile = new URL('./registered-fingerprints.json', import.meta.url);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const registrySource = fs.readFileSync(path.resolve(import.meta.dirname, '../../../lib/busuu/content-registry.ts'), 'utf8');
const registeredFiles = [...registrySource.matchAll(/from '@\/content\/busuu\/(b2-c\d+-(?:l\d+|cp)\.v\d+\.json)'/g)].map(m => m[1]);
const server = loadCourseModule('lib/busuu/attempt-server.ts');

function describe(file) {
  const bytes = fs.readFileSync(path.join(root, file));
  const pack = JSON.parse(bytes);
  return { file, recordId: pack.recordId, contentVersion: pack.contentVersion, fileHash: digest(bytes), persistenceFingerprint: server.coursePack(pack.recordId, pack.contentVersion).hash };
}

if (process.argv[2] === 'baseline') {
  const packs = registeredFiles.map(describe);
  const raw = ['b2-structure.json', 'inventory.json', 'source-index.json'].map(file => ({ file, fileHash: digest(fs.readFileSync(path.join(root, file))) }));
  fs.writeFileSync(baselineFile, JSON.stringify({ date: '2026-10-08', note: 'Every B2 pack version registered before the pack-text polish. These bytes and persistence fingerprints must never change.', packs, rawFiles: raw }, null, 2) + '\n');
  console.log(`Wrote baseline for ${packs.length} registered versions.`);
} else {
  const baseline = JSON.parse(fs.readFileSync(baselineFile));
  let checked = 0;
  for (const p of baseline.packs) {
    assert.ok(registeredFiles.includes(p.file), `${p.file} is still imported by the registry`);
    const now = describe(p.file);
    assert.deepEqual(now, p, `${p.file} is byte- and fingerprint-identical`);
    assert.equal(server.coursePack(p.recordId, p.contentVersion).pack.contentVersion, p.contentVersion, 'exact old version still resolves');
    checked++;
  }
  for (const r of baseline.rawFiles) assert.equal(digest(fs.readFileSync(path.join(root, r.file))), r.fileHash, `${r.file} raw evidence unchanged`);
  console.log(`${checked} baseline versions are still registered with identical bytes and persistence fingerprints; raw evidence unchanged.`);
}
