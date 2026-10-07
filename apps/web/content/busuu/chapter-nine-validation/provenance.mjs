import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {loadCourseModule} from '../../../lib/busuu-test-helpers.mjs';
const web=path.resolve(import.meta.dirname,'../../..'),root=path.join(web,'content/busuu'),digest=v=>createHash('sha256').update(v).digest('hex');
const names=['l01','l02','l03','l04','l05','l06','l07','l08','cp'].map(k=>`b2-c09-${k}.v1.json`);
const prior=JSON.parse(fs.readFileSync(new URL('./prior-fingerprints.json',import.meta.url)));assert.equal(prior.packs.length,56);
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'busuu-chapter-nine-'));
try{
 execFileSync(process.execPath,[path.join(web,'scripts/assemble-busuu-chapter-nine.mjs'),temporary]);
 const server=loadCourseModule('lib/busuu/attempt-server.ts'),readiness=loadCourseModule('lib/busuu/content-readiness.ts'),raw=JSON.parse(fs.readFileSync(path.join(root,'b2-structure.json'))).records;
 for(const p of prior.packs){assert.equal(server.coursePack(p.recordId,p.contentVersion).hash,p.persistenceFingerprint);assert.equal(digest(fs.readFileSync(path.join(root,p.file))),p.fileHash);}
 for(const p of prior.rawFiles)assert.equal(digest(fs.readFileSync(path.join(root,p.file))),p.fileHash);
 const packs=names.map(name=>{
  const bytes=fs.readFileSync(path.join(root,name));assert.deepEqual(fs.readFileSync(path.join(temporary,name)),bytes);const p=JSON.parse(bytes);
  assert.equal(readiness.getPackReadiness(p).playable,true);const spec=raw.find(r=>r.recordId===p.recordId);loadCourseModule('lib/busuu/content-registry.ts').assertContentAlignment(p,spec);
  assert.ok(p.screens.every(s=>s.evidence.length&&s.evidence.every(e=>/^[a-f0-9]{64}$/.test(e.sourceHash))));
  return{recordId:p.recordId,contentVersion:p.contentVersion,observedRows:spec.screens.length,requiredScreens:p.baseScreenCount,optionalSurfaces:p.completion?.optionalSurfaces.length??0,physicalResponses:p.structuralContract?p.structuralContract.tasks.reduce((n,t)=>n+t.responseCount,0):p.screens.reduce((n,s)=>n+s.sourceContract.responseSlotCount,0),physicalCountOrigin:p.structuralContract?'app_authored':'retained_observed_structure',fileHash:digest(bytes),persistenceFingerprint:server.coursePack(p.recordId).hash};
 });
 assert.equal(packs.reduce((n,p)=>n+p.observedRows,0),136);assert.equal(packs.reduce((n,p)=>n+p.requiredScreens,0),155);assert.equal(packs.reduce((n,p)=>n+p.optionalSurfaces,0),1);
 assert.equal(packs.slice(0,8).reduce((n,p)=>n+p.physicalResponses,0),173);assert.equal(packs[8].physicalResponses,40);
 fs.writeFileSync(new URL('./provenance.json',import.meta.url),JSON.stringify({date:'2026-10-06',deterministicRegeneration:true,all56PriorFingerprintsUnchanged:true,rawRuntimeEvidenceUnchanged:true,packs},null,2)+'\n');
 console.log('Nine deterministic packs: 136 retained lesson rows + 20 authored CP tasks; 155 required + one optional; 173 retained + 40 authored physical responses. All 56 prior bytes/fingerprints and raw projections unchanged.');
}finally{
 assert.equal(path.dirname(temporary),path.resolve(os.tmpdir()));
 for(const name of names)if(fs.existsSync(path.join(temporary,name)))fs.unlinkSync(path.join(temporary,name));fs.rmdirSync(temporary);
}
