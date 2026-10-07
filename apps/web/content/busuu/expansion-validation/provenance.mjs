import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const reference = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Provide the retained reference package directory.');
const content = path.resolve(import.meta.dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'busuu-l02-l03-'));
execFileSync(process.execPath, [path.resolve(content, '../../scripts/assemble-busuu-l02-l03.mjs'), reference, temporary], { stdio: 'pipe' });
const hash = data => createHash('sha256').update(data).digest('hex');
let verifiedReferences = 0;
const packs = [];
for (const lesson of ['l02', 'l03']) {
  const name = `b2-c01-${lesson}.v1.json`, bytes = fs.readFileSync(path.join(content, name)), pack = JSON.parse(bytes);
  assert.ok(bytes.equals(fs.readFileSync(path.join(temporary, name))), 'deterministic pack regeneration');
  for (const s of pack.screens) for (const e of s.evidence) {
    assert.equal(hash(fs.readFileSync(path.join(reference, e.packagedPath))), e.sourceHash); verifiedReferences++;
  }
  assert.ok(!bytes.toString().includes('C:/Users/') && !bytes.toString().includes('test_fixture'), 'runtime pack contains no external dependency path or fixture content');
  packs.push({ recordId: pack.recordId, status: pack.status, baseScreens: pack.baseScreenCount,
    fileHash: hash(bytes), persistenceFingerprint: hash(JSON.stringify(pack)), fieldGaps: pack.screens.reduce((n, s) => n + s.unresolved.length, 0) });
}
assert.equal(hash(fs.readFileSync(path.join(content, 'b2-c01-l01.v1.json'))), 'cf664c2168edc01c9ee8eb2dfb8f8b38d4a94dcb331b9f2a03f14584389ffd0a', 'L01 retained pack unchanged');
const audit = JSON.parse(fs.readFileSync(path.join(content, 'expansion-validation/evidence-audit.json')));
const result = { deterministicRegeneration: true, verifiedReferences, l01Unchanged: true, referenceTextFilesSearched: audit.searches.length,
  planningTextFilesSearched: audit.planningSearches.length, packagedImagesInspectedByInventory: audit.packagedImages.length, packs };
fs.writeFileSync(path.join(import.meta.dirname, 'provenance.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
