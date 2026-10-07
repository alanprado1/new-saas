import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
const web = path.resolve(import.meta.dirname, '../../..'), root = path.join(web, 'content/busuu');
const digest = value => createHash('sha256').update(value).digest('hex');
const retained = ['b2-structure.json', 'inventory.json', 'b2-c01-l01.v1.json', 'b2-c01-l02.v1.json', 'b2-c01-l03.v1.json', 'b2-c01-l02.v2.json', 'b2-c01-l03.v2.json'];
const before = retained.map(name => digest(fs.readFileSync(path.join(root, name))));
const names = ['b2-c01-l04.v1.json', 'b2-c01-l05.v1.json', 'b2-c01-cp.v1.json'];
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'busuu-chapter-one-'));
try {
  execFileSync(process.execPath, [path.join(web, 'scripts/assemble-busuu-chapter-one.mjs'), temporary]);
  const registry = loadCourseModule('lib/busuu/attempt-server.ts');
  const packs = names.map(name => {
    const bytes = fs.readFileSync(path.join(root, name)); assert.deepEqual(fs.readFileSync(path.join(temporary, name)), bytes);
    const pack = JSON.parse(bytes);
    assert.equal(loadCourseModule('lib/busuu/content-readiness.ts').getPackReadiness(pack).playable, true);
    assert.equal(pack.provenance.origin, 'app_authored');
    assert.ok(pack.screens.every(s => s.evidence.length && s.evidence.every(e => /^[a-f0-9]{64}$/.test(e.sourceHash))));
    assert.equal(pack.screens.flatMap(s => s.unresolved).length, 0);
    assert.ok(!/test_fixture|Fixture explanation|テストです/u.test(JSON.stringify(pack)));
    return { recordId: pack.recordId, contentVersion: pack.contentVersion, schemaVersion: pack.schemaVersion, coreScreens: pack.baseScreenCount,
      optionalScreenIds: pack.completion?.optionalSurfaces.map(s => s.screenId) ?? [], fileHash: digest(bytes), persistenceFingerprint: registry.coursePack(pack.recordId).hash };
  });
  for (const [id, version, hash] of [
    ['B2.C01.L01', '1.0.0', '631c827850208d3fbd9f26d5a81f8cb7957c665de3872ffd571e62fa0388d349'],
    ['B2.C01.L02', '1.0.0', 'abdd416ac0bb652a6873da6510cb5160dacd8882fd28440e02fe24b9adce8506'],
    ['B2.C01.L03', '1.0.0', 'c257100fe9e44cb830e98a660f9acf83847c2fed0b3d7c15f400dd11da835f7d'],
    ['B2.C01.L02', '1.1.0', '44b4d8497704a5eb1e42f2aa0072eda16964130bb70d994558035975f00b6a9b'],
    ['B2.C01.L03', '1.1.0', '0b64d96b733a82ad7324ced0e35101f9943afe38616204b3cbba71275144a2ee'],
  ]) assert.equal(registry.coursePack(id, version).hash, hash);
  assert.deepEqual(retained.map(name => digest(fs.readFileSync(path.join(root, name)))), before);
  const report = { date: '2026-10-04', deterministicRegeneration: true, retainedAssemblyInputsUnchanged: true, releasedFingerprintsUnchanged: true, packs };
  fs.writeFileSync(path.join(import.meta.dirname, 'provenance.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
  for (const name of names) if (fs.existsSync(path.join(temporary, name))) fs.unlinkSync(path.join(temporary, name));
  fs.rmdirSync(temporary);
}
