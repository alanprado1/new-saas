import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const web = path.resolve(import.meta.dirname, '../../..');
const root = path.join(web, 'content/busuu');
const digest = value => createHash('sha256').update(value).digest('hex');
const retained = ['b2-c01-l01.v1.json', 'b2-c01-l02.v1.json', 'b2-c01-l03.v1.json'];
const before = retained.map(name => digest(fs.readFileSync(path.join(root, name))));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'busuu-production-'));
const names = ['b2-c01-l02.v2.json', 'b2-c01-l03.v2.json'];
try {
  execFileSync(process.execPath, [path.join(web, 'scripts/assemble-busuu-l02-l03-production.mjs'), temporary]);
  const packs = names.map(name => {
    const bytes = fs.readFileSync(path.join(root, name));
    assert.deepEqual(fs.readFileSync(path.join(temporary, name)), bytes);
    const pack = JSON.parse(bytes);
    assert.equal(pack.status, 'reviewed'); assert.equal(pack.provenance.origin, 'app_authored');
    assert.equal(pack.screens.flatMap(s => s.unresolved).length, 0);
    assert.ok(pack.screens.every(s => s.evidence.length && s.evidence.every(e => /^[a-f0-9]{64}$/.test(e.sourceHash))));
    assert.ok(!/test_fixture|Fixture correct|テストです/u.test(JSON.stringify(pack)));
    return { recordId: pack.recordId, contentVersion: pack.contentVersion, baseScreens: pack.baseScreenCount,
      fileHash: digest(bytes), persistenceFingerprint: digest(JSON.stringify(pack)), unresolvedRuntimeFields: 0 };
  });
  assert.deepEqual(retained.map(name => digest(fs.readFileSync(path.join(root, name)))), before);
  const report = { date: '2026-10-04', deterministicRegeneration: true, retainedBytesUnchangedByAssembly: true, packs };
  fs.writeFileSync(path.join(import.meta.dirname, 'provenance.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  // Delete only named generated files in the freshly created task temporary directory.
  assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
  for (const name of names) if (fs.existsSync(path.join(temporary, name))) fs.unlinkSync(path.join(temporary, name));
  fs.rmdirSync(temporary);
}
