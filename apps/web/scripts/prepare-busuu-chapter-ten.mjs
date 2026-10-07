// One-time immutable baseline plus assigned-record occurrence metadata; no runtime raw edits.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadCourseModule} from '../lib/busuu-test-helpers.mjs';
const root=path.resolve(import.meta.dirname,'../content/busuu'), output=path.join(root,'chapter-ten-validation');
const target=path.join(output,'prior-fingerprints.json');
if(fs.existsSync(target))throw Error('Baseline already captured; do not replace it');
fs.mkdirSync(output,{recursive:true});
const server=loadCourseModule('lib/busuu/attempt-server.ts'), digest=b=>createHash('sha256').update(b).digest('hex');
const packs=fs.readdirSync(root).filter(n=>/^b2-c0[1-9]-.*\.v\d+\.json$/.test(n)).map(file=>{
 const bytes=fs.readFileSync(path.join(root,file)),p=JSON.parse(bytes);
 return{file,recordId:p.recordId,contentVersion:p.contentVersion,fileHash:digest(bytes),persistenceFingerprint:server.coursePack(p.recordId,p.contentVersion).hash};
});
if(packs.length!==65)throw Error('Expected 65 prior released versions');
const rawFiles=['b2-structure.json','inventory.json','source-index.json'].map(file=>({file,fileHash:digest(fs.readFileSync(path.join(root,file)))}));
const reference=process.argv[2];if(!reference)throw Error('Explicit local reference root required');
const file=path.join(reference,'Unified-B2-Lesson-Records.json'),u=JSON.parse(fs.readFileSync(file));
const assigned=u.records.filter(r=>r.record_id.startsWith('B2.C10.')),screens={};
for(const r of assigned)for(const s of r.architecture.screen_records)screens[s.canonical_screen_id]={
 feedbackCategories:s.feedback_paraphrase?[s.feedback_paraphrase]:[],targetConceptIds:s.target_concepts,priorConceptIds:s.prior_concepts,
 optionCount:s.option_count,occurrenceNotes:s.occurrence_notes,feedbackParaphrase:s.feedback_paraphrase,
};
const referenceFiles=['Unified-B2-Lesson-Records.json','Evidence/S52-Analysis-Records-B2-C10.json','Evidence/S57-Lesson-Structural-Evidence-B2-C10.md','Evidence/S56-Japanese-Curriculum-Analysis-B2-C10.md','Evidence/S59-Validation-B2-C10.md'].map(file=>({file,fileHash:digest(fs.readFileSync(path.join(reference,file)))}));
fs.writeFileSync(target,JSON.stringify({date:'2026-10-06',packs,rawFiles,referenceFiles},null,2)+'\n');
fs.writeFileSync(path.join(import.meta.dirname,'busuu-chapter-ten-occurrences.json'),JSON.stringify({sourceFileHash:digest(fs.readFileSync(file)),screens},null,2)+'\n');
console.log('Preserved baseline: 65 versions, three raw projections and assigned reference digests; extracted 157 observed C10 occurrences.');
