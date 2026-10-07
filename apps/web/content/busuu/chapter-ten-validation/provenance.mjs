import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {loadCourseModule} from '../../../lib/busuu-test-helpers.mjs';
const web=path.resolve(import.meta.dirname,'../../..'),root=path.join(web,'content/busuu');
const prior=JSON.parse(fs.readFileSync(new URL('./prior-fingerprints.json',import.meta.url))),digest=b=>createHash('sha256').update(b).digest('hex');
assert.equal(prior.packs.length,65);
const keys=['l01','l02','l03','l04','l05','l06','l07','l08','l09','cp'],names=keys.map(k=>`b2-c10-${k}.v1.json`),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'busuu-chapter-ten-'));
try{
 execFileSync(process.execPath,[path.join(web,'scripts/assemble-busuu-chapter-ten.mjs'),temporary]);
 const server=loadCourseModule('lib/busuu/attempt-server.ts'),registry=loadCourseModule('lib/busuu/content-registry.ts'),readiness=loadCourseModule('lib/busuu/content-readiness.ts'),raw=JSON.parse(fs.readFileSync(path.join(root,'b2-structure.json'))).records;
 for(const p of prior.packs){assert.equal(server.coursePack(p.recordId,p.contentVersion).hash,p.persistenceFingerprint);assert.equal(digest(fs.readFileSync(path.join(root,p.file))),p.fileHash);}
 for(const p of prior.rawFiles)assert.equal(digest(fs.readFileSync(path.join(root,p.file))),p.fileHash);
 // Optional explicit reference root verifies immutable retained originals without using them at runtime.
 if(process.argv[2])for(const p of prior.referenceFiles)assert.equal(digest(fs.readFileSync(path.join(process.argv[2],p.file))),p.fileHash);
 const packs=names.map(name=>{
  const bytes=fs.readFileSync(path.join(root,name));assert.deepEqual(fs.readFileSync(path.join(temporary,name)),bytes);const p=JSON.parse(bytes),spec=raw.find(r=>r.recordId===p.recordId);
  assert.equal(readiness.getPackReadiness(p).playable,true);registry.assertContentAlignment(p,spec);assert.ok(p.screens.every(s=>s.evidence.length&&s.evidence.every(e=>/^[a-f0-9]{64}$/.test(e.sourceHash))));
  return{recordId:p.recordId,contentVersion:p.contentVersion,observedRows:spec.screens.length,authoredRows:p.structuralContract?p.baseScreenCount:0,requiredScreens:p.baseScreenCount,optionalSurfaces:p.completion?.optionalSurfaces.length??0,physicalResponses:p.structuralContract?p.structuralContract.tasks.reduce((n,t)=>n+t.responseCount,0):p.screens.reduce((n,s)=>n+s.sourceContract.responseSlotCount,0),physicalCountOrigin:p.structuralContract?'app_authored':'retained_observed_structure',fileHash:digest(bytes),persistenceFingerprint:server.coursePack(p.recordId).hash};
 });
 assert.equal(packs.reduce((n,p)=>n+p.observedRows,0),157);assert.equal(packs.reduce((n,p)=>n+p.authoredRows,0),18);assert.equal(packs.reduce((n,p)=>n+p.requiredScreens,0),174);assert.equal(packs.reduce((n,p)=>n+p.optionalSurfaces,0),1);assert.equal(packs.slice(1).reduce((n,p)=>n+p.physicalResponses,0),232);
 const inventory=loadCourseModule('lib/busuu/inventory.ts').getLevelInventory('B2');const entries=inventory.chapters.flatMap(c=>c.entries);
 assert.equal(entries.length,73);assert.ok(entries.every(e=>registry.getContentPack(e.id)), 'all canonical B2 entries have packs');
 const all=raw.filter(r=>r.recordId.startsWith('B2.')).map(spec=>{const p=registry.getContentPack(spec.recordId);assert.equal(readiness.getPackReadiness(p).playable,true);return{recordId:spec.recordId,observedRows:spec.screens.length,authoredRows:p.structuralContract?p.baseScreenCount:0,requiredScreens:p.baseScreenCount,optionalSurfaces:p.completion?.optionalSurfaces.length??0};});
 fs.writeFileSync(new URL('./provenance.json',import.meta.url),JSON.stringify({date:'2026-10-06',deterministicRegeneration:true,all65PriorFingerprintsUnchanged:true,rawRuntimeEvidenceUnchanged:true,retainedReferenceFilesVerified:Boolean(process.argv[2]),registeredVersions:75,canonicalB2Entries:73,packs,b2Accounting:all},null,2)+'\n');
 console.log(`Ten deterministic packs: 157 observed rows + 18 authored L01 tasks; 174 required + one optional; 232 known + ${packs[0].physicalResponses} authored responses. All 65 prior bytes/fingerprints preserved; all 73 B2 entries playable.`);
}finally{
 assert.equal(path.dirname(temporary),path.resolve(os.tmpdir()));for(const name of names)if(fs.existsSync(path.join(temporary,name)))fs.unlinkSync(path.join(temporary,name));fs.rmdirSync(temporary);
}
