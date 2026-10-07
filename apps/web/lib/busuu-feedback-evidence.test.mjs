import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadCourseModule} from './busuu-test-helpers.mjs';
const raw=JSON.parse(fs.readFileSync(new URL('../content/busuu/b2-structure.json',import.meta.url))).records;
const spec=raw.find(r=>r.recordId==='B2.C10.L06');
function fixture(index=0){
 const source=spec.screens[index],s=structuredClone(loadCourseModule('lib/busuu/content-registry.ts').getContentPack('B2.C09.L01').screens[16]);
 s.screenId=source.screenId;s.renderer='truth';s.truthMode='audio_only';s.statement='The speaker uses casual language.';s.answer={kind:'truth',accepted:true};
 s.audio={required:true,text:'これにする。',reading:'これにする。'};s.support={before:[],after:[{kind:'explanation',text:'The plain form is casual.'}]};s.evidence=structuredClone(source.evidence);
 Object.assign(s.sourceContract,{sourceScreenId:source.sourceScreenId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,responseSlotCount:1,transcriptBeforeAnswer:false,recordedSupport:structuredClone(source.rawSupport),feedbackTranscript:'omitted',feedbackTranscriptResolution:{version:'1.0',kind:'retained_prose',field:'rawFeedbackParaphrase',quote:source.rawFeedbackParaphrase,evidence:structuredClone(source.evidence[0])}});
 return s;
}
test('explicit retained cue-only prose resolves null feedback flags without changing the raw record',()=>{
 const before=structuredClone(spec),r=loadCourseModule('lib/busuu/content-readiness.ts');
 for(const i of [0,4]){const s=fixture(i);assert.equal(s.sourceContract.recordedSupport.transcript_in_feedback,null);assert.deepEqual(r.getScreenContentGaps(s),[]);}
 assert.deepEqual(spec,before);
});
test('cue-only resolution rejects absent, unrelated, forged or contradictory evidence and complete replay',()=>{
 const r=loadCourseModule('lib/busuu/content-readiness.ts');
 const mutations=[s=>delete s.sourceContract.feedbackTranscriptResolution,s=>s.sourceContract.feedbackTranscriptResolution.quote='Feedback observed.',s=>s.sourceContract.feedbackTranscriptResolution.evidence.sourceHash='bad',s=>s.sourceContract.feedbackTranscriptResolution.evidence.jsonPointerOrHeading='/another/screen',s=>s.sourceContract.recordedSupport.transcript_in_feedback=true,s=>s.audio.feedbackText=s.audio.text,s=>s.support.after.push({kind:'japanese',text:s.audio.text}),s=>s.support.after.push({kind:'japanese',text:s.audio.text+' '}),s=>s.support.after.push({kind:'explanation',text:'Source: 「'+s.audio.text+'」'}),s=>s.support.after.push({kind:'japanese',text:'Reading',secondary:s.audio.reading}),s=>s.audio.required=false,s=>s.truthMode='supported',s=>s.sourceContract.transcriptBeforeAnswer=true];
 for(const mutate of mutations){const s=fixture();mutate(s);assert.ok(r.getScreenContentGaps(s).length);}
 const full=fixture();delete full.sourceContract.feedbackTranscript;delete full.sourceContract.feedbackTranscriptResolution;
 assert.ok(r.getScreenContentGaps(full).some(g=>g.field==='statement'),'audio-only truth remains strict without an omission contract');
 const flagged=fixture();delete flagged.sourceContract.feedbackTranscriptResolution;flagged.sourceContract.recordedSupport={...flagged.sourceContract.recordedSupport,transcript_in_feedback:false};
 assert.deepEqual(r.getScreenContentGaps(flagged),[],'released false-flag contract remains supported');
});
test('prose resolution alignment binds the exact retained occurrence and cannot override an explicit flag',()=>{
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),source=spec.screens[0],s=fixture();
 const one={...spec,baseScreenCount:1,screens:[source]},pack={recordId:spec.recordId,baseScreenCount:1,screens:[s],schemaVersion:'1.0'};
 assert.doesNotThrow(()=>registry.assertContentAlignment(pack,one));
 const forged=structuredClone(pack);forged.screens[0].sourceContract.feedbackTranscriptResolution.quote='No full transcript is shown in feedback.';
 assert.throws(()=>registry.assertContentAlignment(forged,one));
 const other=structuredClone(one);other.screens[0].rawFeedbackParaphrase='Unknown feedback';assert.throws(()=>registry.assertContentAlignment(pack,other));
 const contradicted=structuredClone(one);contradicted.screens[0].rawSupport.transcript_in_feedback=true;assert.throws(()=>registry.assertContentAlignment(pack,contradicted));
});
