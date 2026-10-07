// Capture before registering chapter six. Do not overwrite after implementation.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadCourseModule} from '../lib/busuu-test-helpers.mjs';
const root=path.resolve(import.meta.dirname,'../content/busuu'),output=path.join(root,'chapter-six-validation');
fs.mkdirSync(output,{recursive:true});
const destination=path.join(output,'prior-fingerprints.json');
if(fs.existsSync(destination))throw new Error('Prior snapshot already captured');
const server=loadCourseModule('lib/busuu/attempt-server.ts');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const packs=fs.readdirSync(root).filter(n=>/^b2-c0[1-5]-.*\.v\d+\.json$/.test(n)).map(file=>{
 const bytes=fs.readFileSync(path.join(root,file)),p=JSON.parse(bytes);
 return {file,recordId:p.recordId,contentVersion:p.contentVersion,fileHash:digest(bytes),persistenceFingerprint:server.coursePack(p.recordId,p.contentVersion).hash};
});
if(packs.length!==35)throw new Error('Expected all 35 released versions');
const rawFiles=['b2-structure.json','inventory.json','source-index.json'].map(file=>({file,fileHash:digest(fs.readFileSync(path.join(root,file)))}));
fs.writeFileSync(destination,JSON.stringify({date:'2026-10-05',packs,rawFiles},null,2)+'\n');
console.log('Captured all 35 released bytes/save fingerprints and raw runtime evidence.');
