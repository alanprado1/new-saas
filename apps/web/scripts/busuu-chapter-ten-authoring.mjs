// Offline occurrence assembler. Raw structure remains read-only; all literal copy is reviewed app authoring.
import fs from 'node:fs';
import path from 'node:path';
export {jp,en,rule,fb,model,gap,choice,truth,order,typed,table,pairs} from './busuu-chapter-nine-authoring.mjs';
import {jp,en,rule,fb} from './busuu-chapter-nine-authoring.mjs';
const root=path.resolve(import.meta.dirname,'../content/busuu');
const records=JSON.parse(fs.readFileSync(path.join(root,'b2-structure.json'),'utf8')).records;
const occurrences=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'busuu-chapter-ten-occurrences.json'),'utf8')).screens;
export const multi=(prompt,options,accepted,text,reading,english,reason)=>({renderer:'multi_choice',prompt,
 answer:{kind:'multi_choice',options:options.map((text,i)=>({id:`o${i}`,text})),acceptedOptionIds:accepted.map(i=>`o${i}`),requiredCount:accepted.length,grading:'exact_set'},
 praise:'Well done!',support:{before:[],after:fb(text,reading,english,reason)},audio:{text,reading,feedbackText:text}});
export const kmodel=(character,shapeNote,meaning,readings,examples)=>({renderer:'kanji',prompt:`Learn ${character} and its contextual readings.`,
 kanji:{character,shapeNote,meaning,readings:readings.map(([text,note])=>({text,note})),examples:examples.map(([word,reading,meaning,sentence,sentenceReading,translation])=>({word,reading,meaning,sentence,sentenceReading,translation}))},
 support:{before:[jp(examples.map(e=>e[3]).join(' '),examples.map(e=>e[4]).join(' ')),en(meaning+'. '+examples.map(e=>e[5]).join(' ')),rule(shapeNote)],after:[]},
 audio:{text:examples.map(e=>e[3]).join(' '),reading:examples.map(e=>e[4]).join(' ')}});

export function retainedMedia(media){
 if(!Array.isArray(media))throw Error('Expected retained media list');
 const kinds=media.map(m=>typeof m==='string'?m:m&&typeof m==='object'&&typeof m.kind==='string'?m.kind:null);
 if(kinds.some(k=>!['audio','video','image','rendered_player','visual_kanji_player'].includes(k)))throw Error('Unknown retained media kind; review explicitly');
 return{audio:kinds.some(k=>['audio','video','rendered_player'].includes(k)),visual:kinds.includes('video')?'video':kinds.some(k=>['image','visual_kanji_player'].includes(k))?'image':'none'};
}
const responseCount=s=>s.answer?.kind==='ordered_slots'?s.answer.slots.length:s.answer?.kind==='ordered_tokens'?s.answer.tokens.length:s.answer?.kind==='pairs'?s.answer.pairs.length:s.answer?.kind==='multi_choice'?s.answer.requiredCount:s.answer?1:0;
export function writePack(key,copies,options={},output=process.argv[2]??root){
 const recordId=`B2.C10.${key.toUpperCase()}`,record=records.find(r=>r.recordId===recordId);
 const optional=options.optional,required=record.screens.length-(optional?1:0);
 if(copies.length!==required)throw Error(`${recordId}: expected ${required} required copies, received ${copies.length}`);
 const screens=copies.map((original,i)=>{
  const copy=structuredClone(original),source=record.screens[i],meta=occurrences[source.screenId],media=retainedMedia(source.rawMedia);
  const flags=source.rawSupport,hidden=flags.japanese_transcript_before_answer===false;
  const before=[...copy.support.before];
  // Supply scaffold/question support, never a completed gap or ordered answer as a convenience.
  if(flags.japanese_transcript_before_answer===true&&!before.some(b=>b.kind==='japanese')&&copy.renderer!=='dialogue'){
   const text=copy.renderer==='gaps'?copy.scaffold.join('＿'):copy.renderer==='typed'?copy.typed.before+'＿'+copy.typed.after:copy.renderer==='pairs'?(copy.left??[]).map(t=>t.text).join(' ／ '):copy.audio.text;
   if(text)before.push(jp(text,copy.renderer==='model'||copy.renderer==='truth'||copy.renderer==='kanji'?copy.audio.reading:undefined));
  }
  if(flags.translation_visible===true&&copy.renderer!=='dialogue'&&!before.some(b=>b.kind==='translation')){
   const english=copy.support.after.find(b=>b.kind==='translation')?.text;
   if(english)before.push(en(english));
   else if(copy.renderer==='table')throw Error(`${source.screenId}: author explicit table English support`);
  }
  const audio={required:media.audio,text:null,...copy.audio};
  // Empty media is an omission for an explicitly observed scene-video renderer: retained controls document its player.
  const scene=source.rawRenderer==='scene_video_v1'&&copy.renderer==='dialogue'&&/scene.*controls/i.test(source.purpose??'');
  const videoControls=/\bVideo controls\b/.test(source.purpose??'');
  if(scene||videoControls)audio.required=true;
  else if(!media.audio||source.rawMediaStructure?.source_replay_available===false){audio.required=false;audio.beforeAnswer=false;}
  const omitted=Boolean(copy.answer&&(flags.transcript_in_feedback===false||copy.sourceContract?.feedbackTranscript==='omitted'));
  const after=omitted?copy.support.after.filter(b=>b.kind==='explanation'):copy.support.after;
  if(omitted)delete audio.feedbackText;
  const c={purpose:source.purpose,sourceScreenId:source.sourceScreenId,sourceRenderer:source.rawRenderer,sourceRendererId:source.sourceRendererId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,responseSlotCount:source.rawResponseSlotCount,responseSlotCountState:source.responseSlotCountState,
   transcriptBeforeAnswer:flags.japanese_transcript_before_answer,translationBeforeAnswer:flags.translation_visible,parallelReadingBeforeAnswer:false,hintBeforeAnswer:false,recordedSupport:source.rawSupport,
   feedbackCategories:meta.feedbackCategories,targetConceptIds:meta.targetConceptIds,priorConceptIds:meta.priorConceptIds,recordedSpeakerCount:source.rawMediaStructure?.speaker_count??null,...copy.sourceContract,...(omitted?{feedbackTranscript:'omitted'}:{})};
  if(omitted&&flags.transcript_in_feedback===null)c.feedbackTranscriptResolution={version:'1.0',kind:'retained_prose',field:'rawFeedbackParaphrase',quote:source.rawFeedbackParaphrase,evidence:source.evidence[0]};
  if(responseCount(copy)!==source.rawResponseSlotCount)throw Error(`${source.screenId}: ${responseCount(copy)} responses != ${source.rawResponseSlotCount}`);
  if(meta.optionCount&&copy.answer?.options&&copy.answer.options.length!==meta.optionCount)throw Error(`${source.screenId}: option count differs from evidence`);
  return{screenId:source.screenId,prompt:null,answer:null,praise:null,...copy,support:{before:hidden?[]:before.map(b=>flags.parallel_kana_available===false&&b.kind==='japanese'?{kind:b.kind,text:b.text}:b),after},audio,visual:scene||videoControls?'video':copy.renderer==='kanji'?'image':media.visual,sourceContract:c,evidence:source.evidence,unresolved:[]};
 });
 const pack={schemaVersion:optional?'1.1':'1.0',contentVersion:'1.0.0',recordId,status:'reviewed',baseScreenCount:required,
  provenance:{origin:'app_authored',note:'Owner-authorized reviewed Chapter 10 Japanese, readings, translations, banks and alternatives adapted/authored from retained targets on 6 October 2026. Literal content is app authoring, distinct from observed source sequence, identities, counts, support timing and analytical dependencies. '+(options.note??'')},
  policies:{assessment:'One outcome per graded base screen. Required completion is distinct from immutable first accuracy and checkpoint pass reporting.',incorrectResponses:'Configured occurrence-only single retry; either outcome permits completion. No inferred remediation.',audio:'Existing Japanese TTS replacement; occurrence-specific source and feedback support.',visuals:'Complete static kanji and shared replaceable visuals; original media deferred.'},
  unresolvedSourceFacts:['Exact source wording, exhaustive equivalents, original assets and acoustic alignment are unavailable; reviewed app authoring supplies complete content.','Research scores and analytical dependencies imply neither owner progress nor enforced unlocks.'],screens,
  ...(options.retryPolicy?{retryPolicy:options.retryPolicy}:{}),...(key==='cp'?{passPolicy:{kind:'none'}}:{})};
 if(optional){const tail=record.screens.at(-1);pack.completion={contractVersion:'1.0',requiredScreenIds:screens.map(s=>s.screenId),optionalSurfaces:[{screenId:tail.screenId,sourceExerciseNumber:tail.sourceExerciseNumber,sourceActivityId:tail.sourceActivityId,purpose:tail.purpose,...optional,modes:['write'],provenance:{origin:'app_authored',note:'Private optional ungraded local writing outside required completion and course attempt events; exact source numbering retained.'}}]};}
 fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,`b2-c10-${key}.v1.json`),JSON.stringify(pack,null,2)+'\n');return pack;
}
