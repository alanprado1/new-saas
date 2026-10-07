import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {loadCourseModule} from '../../../lib/busuu-test-helpers.mjs';
const web=path.resolve(import.meta.dirname,'../../..'),root=path.join(web,'content/busuu');
const digest=v=>createHash('sha256').update(v).digest('hex');
const names=['l01','l02','l03','l04','l05','l06','cp'].map(k=>`b2-c06-${k}.v1.json`);
const prior=JSON.parse(fs.readFileSync(new URL('./prior-fingerprints.json',import.meta.url)));assert.equal(prior.packs.length,35);
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'busuu-chapter-six-'));
try {
 execFileSync(process.execPath,[path.join(web,'scripts/assemble-busuu-chapter-six.mjs'),temporary]);
 const server=loadCourseModule('lib/busuu/attempt-server.ts'),readiness=loadCourseModule('lib/busuu/content-readiness.ts');
 for(const p of prior.packs){assert.equal(server.coursePack(p.recordId,p.contentVersion).hash,p.persistenceFingerprint);assert.equal(digest(fs.readFileSync(path.join(root,p.file))),p.fileHash);}
 for(const p of prior.rawFiles)assert.equal(digest(fs.readFileSync(path.join(root,p.file))),p.fileHash);
 const packs=names.map(name=>{
  const bytes=fs.readFileSync(path.join(root,name));assert.deepEqual(fs.readFileSync(path.join(temporary,name)),bytes);
  const p=JSON.parse(bytes);assert.equal(readiness.getPackReadiness(p).playable,true);
  assert.ok(p.screens.every(s=>s.evidence.length&&s.evidence.every(e=>/^[a-f0-9]{64}$/.test(e.sourceHash))));
  assert.ok(!/test_fixture|Fixture explanation|テストです/u.test(JSON.stringify(p)));
  return {recordId:p.recordId,contentVersion:p.contentVersion,requiredScreens:p.baseScreenCount,optionalScreens:p.completion?.optionalSurfaces.length??0,
   observedRows:p.structuralContract?0:p.baseScreenCount+(p.completion?.optionalSurfaces.length??0),authoredTasks:p.structuralContract?p.baseScreenCount:0,fileHash:digest(bytes),persistenceFingerprint:server.coursePack(p.recordId).hash};
 });
 assert.equal(packs.reduce((n,p)=>n+p.requiredScreens,0),118);assert.equal(packs.reduce((n,p)=>n+p.observedRows,0),100);
 fs.writeFileSync(new URL('./provenance.json',import.meta.url),JSON.stringify({date:'2026-10-05',deterministicRegeneration:true,all35PriorFingerprintsUnchanged:true,rawRuntimeEvidenceUnchanged:true,packs},null,2)+'\n');
 console.log('Seven deterministic packs: 118 required + one optional; 100 observed rows +19 authored tasks; all 35 prior bytes/fingerprints and raw evidence unchanged.');
}finally{
 assert.equal(path.dirname(temporary),path.resolve(os.tmpdir()));
 for(const name of names)if(fs.existsSync(path.join(temporary,name)))fs.unlinkSync(path.join(temporary,name));fs.rmdirSync(temporary);
}
