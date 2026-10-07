import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
const web=path.resolve(import.meta.dirname,'../../..'),root=path.join(web,'content/busuu');
const digest=value=>createHash('sha256').update(value).digest('hex');
const names=['l01','l02','l03','l04','l05','cp'].map(k=>`b2-c04-${k}.v1.json`);
const prior=JSON.parse(fs.readFileSync(new URL('./prior-fingerprints.json',import.meta.url)));
assert.equal(prior.packs.length,23);
const retained=['b2-structure.json','inventory.json','source-index.json',...prior.packs.map(p=>p.file)];
const before=retained.map(name=>digest(fs.readFileSync(path.join(root,name))));
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'busuu-chapter-four-'));
try {
 execFileSync(process.execPath,[path.join(web,'scripts/assemble-busuu-chapter-four.mjs'),temporary]);
 const server=loadCourseModule('lib/busuu/attempt-server.ts'),readiness=loadCourseModule('lib/busuu/content-readiness.ts');
 for(const p of prior.packs) {
  assert.equal(server.coursePack(p.recordId,p.contentVersion).hash,p.persistenceFingerprint);
  assert.equal(digest(fs.readFileSync(path.join(root,p.file))),p.fileHash);
 }
 const packs=names.map(name=>{
  const bytes=fs.readFileSync(path.join(root,name));assert.deepEqual(fs.readFileSync(path.join(temporary,name)),bytes);
  const p=JSON.parse(bytes);assert.equal(readiness.getPackReadiness(p).playable,true);assert.equal(p.completion,undefined);
  assert.ok(p.screens.every(s=>s.evidence.length&&s.evidence.every(e=>/^[a-f0-9]{64}$/.test(e.sourceHash))));
  assert.ok(!/test_fixture|Fixture explanation|テストです/u.test(JSON.stringify(p)));
  return {recordId:p.recordId,contentVersion:p.contentVersion,coreScreens:p.baseScreenCount,fileHash:digest(bytes),persistenceFingerprint:server.coursePack(p.recordId).hash};
 });
 assert.equal(packs.reduce((n,p)=>n+p.coreScreens,0),114);
 assert.deepEqual(retained.map(n=>digest(fs.readFileSync(path.join(root,n)))),before);
 fs.writeFileSync(new URL('./provenance.json',import.meta.url),JSON.stringify({date:'2026-10-05',deterministicRegeneration:true,all23PriorFingerprintsUnchanged:true,rawRuntimeEvidenceUnchanged:true,packs},null,2)+'\n');
 console.log('Deterministic six-pack regeneration, 114 required screens, raw projections and all 23 prior version bytes/fingerprints verified.');
} finally {
 assert.equal(path.dirname(temporary),path.resolve(os.tmpdir()));
 for(const name of names)if(fs.existsSync(path.join(temporary,name)))fs.unlinkSync(path.join(temporary,name));
 fs.rmdirSync(temporary);
}
