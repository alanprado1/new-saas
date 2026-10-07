import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
const web = path.resolve(import.meta.dirname, '../../..'), root = path.join(web, 'content/busuu');
const digest = value => createHash('sha256').update(value).digest('hex');
const names = ['l01','l02','l03','l04','l05','l06','cp'].map(k => `b2-c03-${k}.v1.json`);
const prior = JSON.parse(fs.readFileSync(new URL('./prior-fingerprints.json', import.meta.url)));
assert.equal(prior.packs.length, 16, 'baseline covers every prior registered version');
const retained = ['b2-structure.json','inventory.json','source-index.json', ...prior.packs.map(p => p.file)];
const before = retained.map(name => digest(fs.readFileSync(path.join(root, name))));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'busuu-chapter-three-'));
try {
  execFileSync(process.execPath, [path.join(web, 'scripts/assemble-busuu-chapter-three.mjs'), temporary]);
  const registry = loadCourseModule('lib/busuu/attempt-server.ts');
  for (const p of prior.packs) {
    assert.equal(registry.coursePack(p.recordId, p.contentVersion).hash, p.persistenceFingerprint, `${p.recordId}@${p.contentVersion}: saved fingerprint unchanged`);
    assert.equal(digest(fs.readFileSync(path.join(root, p.file))), p.fileHash, `${p.file}: exact bytes unchanged`);
  }
  const packs = names.map(name => {
    const bytes = fs.readFileSync(path.join(root, name)); assert.deepEqual(fs.readFileSync(path.join(temporary, name)), bytes);
    const pack = JSON.parse(bytes); assert.equal(loadCourseModule('lib/busuu/content-readiness.ts').getPackReadiness(pack).playable, true);
    assert.ok(pack.screens.every(s => s.evidence.length && s.evidence.every(e => /^[a-f0-9]{64}$/.test(e.sourceHash))));
    assert.ok(!/test_fixture|Fixture explanation|テストです/u.test(JSON.stringify(pack)));
    return { recordId: pack.recordId, contentVersion: pack.contentVersion, coreScreens: pack.baseScreenCount,
      optionalScreenIds: pack.completion?.optionalSurfaces.map(s => s.screenId) ?? [], fileHash: digest(bytes), persistenceFingerprint: registry.coursePack(pack.recordId).hash };
  });
  assert.equal(packs.reduce((n, p) => n + p.coreScreens, 0), 98);
  assert.equal(packs.reduce((n, p) => n + p.optionalScreenIds.length, 0), 1);
  assert.deepEqual(retained.map(name => digest(fs.readFileSync(path.join(root, name)))), before);
  const report = { date: '2026-10-04', deterministicRegeneration: true, allSixteenPriorFingerprintsUnchanged: true,
    rawRuntimeEvidenceUnchanged: true, priorFingerprintBaseline: 'prior-fingerprints.json', packs };
  fs.writeFileSync(path.join(import.meta.dirname, 'provenance.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('Deterministic chapter 3 assembly, 98 required screens plus optional writing, and all 16 prior version fingerprints verified.');
} finally {
  assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
  for (const name of names) if (fs.existsSync(path.join(temporary, name))) fs.unlinkSync(path.join(temporary, name));
  fs.rmdirSync(temporary);
}
