const jp = (text, secondary) => ({ kind: 'japanese', text, ...(secondary ? { secondary } : {}) });
const en = text => ({ kind: 'translation', text }), rule = text => ({ kind: 'explanation', text });
const fb = (text, reading, english, reason) => [jp(text, reading), en(english), rule(reason)];
const model = (prompt, text, reading, english, reason) => ({ renderer: 'model', prompt, support: { before: [jp(text, reading), en(english), ...(reason ? [rule(reason)] : [])], after: [] }, audio: { text, reading } });
const gap = (prompt, marked, reading, english, distractors, reason) => {
  const scaffold = [], targets = []; let last = 0;
  for (const m of marked.matchAll(/〔([^〕]+)〕/g)) { scaffold.push(marked.slice(last, m.index)); targets.push(m[1]); last = m.index + m[0].length; }
  scaffold.push(marked.slice(last)); const text = marked.replace(/〔([^〕]+)〕/g, '$1');
  const tokens = [...targets, ...distractors].map((text, i) => ({ id: `t${i}`, text }));
  // Stable authored shuffle; equivalent repeated text gets distinct IDs and explicit accepted mappings.
  const bank = [...tokens.filter((_, i) => i % 2), ...tokens.filter((_, i) => !(i % 2)).reverse()];
  return { renderer: 'gaps', prompt, scaffold, answer: { kind: 'ordered_slots', tokens: bank,
    slots: targets.map((target, i) => ({ id: `gap-${i + 1}`, acceptedTokenIds: tokens.filter(t => t.text === target).map(t => t.id) })) },
    praise: 'Well done!', support: { before: [], after: fb(text, reading, english, reason) }, audio: { text, reading, feedbackText: text } };
};
const choice = (prompt, options, accepted, text, reading, english, reason) => ({ renderer: 'choice', prompt,
  answer: { kind: 'choice', options: options.map((text, i) => ({ id: `o${i}`, text })), acceptedOptionIds: [`o${accepted}`] },
  praise: 'Well done!', support: { before: [], after: fb(text, reading, english, reason) }, audio: { text, reading, feedbackText: text } });
const truth = (statement, accepted, text, reading, english, reason, hidden = false) => ({ renderer: 'truth', truthMode: hidden ? 'audio_only' : 'supported',
  prompt: hidden ? 'Listen. Is the statement true or false?' : 'Read and listen. Is the statement true or false?', statement, answer: { kind: 'truth', accepted },
  praise: 'Well done!', support: { before: hidden ? [] : [jp(text, reading)], after: fb(text, reading, english, reason) }, audio: { text, reading, feedbackText: text } });
const order = (prompt, chunks, reading, english, reason, fixedPrefix) => {
  const tokens = chunks.map((text, i) => ({ id: `t${i}`, text })); const text = (fixedPrefix ?? '') + chunks.join('');
  const acceptedOrders = [tokens.map(t => t.id)];
  return { renderer: 'ordering', prompt, ...(fixedPrefix ? { fixedPrefix } : {}), answer: { kind: 'ordered_tokens', tokens: [...tokens].reverse(), acceptedOrders },
    praise: 'Well done!', support: { before: [], after: fb(text, reading, english, reason) }, audio: { text, reading, feedbackText: text } };
};
const typed = (prompt, before, after, acceptedForms, text, reading, english, reason) => ({ renderer: 'typed', prompt,
  typed: { label: 'Your answer', before, after }, answer: { kind: 'typed', acceptedForms, normalization: 'nfkc_trim' },
  praise: 'Well done!', support: { before: [], after: fb(text, reading, english, reason) }, audio: { text, reading, feedbackText: text } });
const table = (prompt, caption, columns, rows, text, reading, reason) => ({ renderer: 'table', prompt,
  table: { caption, columns, rows: rows.map((cells, i) => ({ id: `row${i}`, cells })) },
  support: { before: [rule(reason)], after: [] }, audio: { text, reading } });


export { jp, en, rule, fb, model, gap, choice, truth, order, typed, table };

export const pairs=(prompt,rows,text,reading,english,reason)=>({renderer:'pairs',prompt,left:rows.map((r,i)=>({id:`l${i}`,text:r[0]})),right:rows.map((r,i)=>({id:`r${i}`,text:r[1]})).reverse(),answer:{kind:'pairs',pairs:rows.map((_,i)=>({id:`p${i}`,leftId:`l${i}`,rightId:`r${i}`}))},praise:'Well done!',support:{before:[],after:fb(text,reading,english,reason)},audio:{text,reading,feedbackText:text}});

import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../content/busuu');
const records=JSON.parse(fs.readFileSync(path.join(root,'b2-structure.json'),'utf8')).records;
const occurrences=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'busuu-chapter-nine-occurrences.json'),'utf8')).screens;
export function writePack(key,copies,options={},output=process.argv[2]??root){
 const recordId=`B2.C09.${key.toUpperCase()}`,record=records.find(r=>r.recordId===recordId);
 const optional=options.optional,required=record.screens.length-(optional?1:0);
 if(copies.length!==required)throw Error(`${recordId}: expected ${required} required copies`);
 const screens=copies.map((copy,i)=>{
  const source=record.screens[i],meta=occurrences[source.screenId],hidden=source.rawSupport.japanese_transcript_before_answer===false;
  const before=hidden?[]:copy.support.before.map(b=>source.rawSupport.parallel_kana_available===false&&b.kind==='japanese'?{kind:b.kind,text:b.text}:b);
  const after=source.rawSupport.transcript_in_feedback===false&&copy.answer?copy.support.after.filter(b=>b.kind==='explanation'):copy.support.after;
  const audio={required:source.rawMedia.length>0,text:null,...copy.audio};
  if(source.rawSupport.transcript_in_feedback===false&&copy.answer)delete audio.feedbackText;
  if(source.rawMedia.length===0||source.rawMediaStructure?.source_replay_available===false){audio.required=false;audio.beforeAnswer=false;}
  const c={purpose:source.purpose,sourceScreenId:source.sourceScreenId,sourceRenderer:source.rawRenderer,sourceRendererId:source.sourceRendererId,sourceActivityId:source.sourceActivityId,sourceExerciseNumber:source.sourceExerciseNumber,responseSlotCount:source.rawResponseSlotCount,responseSlotCountState:source.responseSlotCountState,transcriptBeforeAnswer:source.rawSupport.japanese_transcript_before_answer,translationBeforeAnswer:source.rawSupport.translation_visible,parallelReadingBeforeAnswer:false,hintBeforeAnswer:false,recordedSupport:source.rawSupport,feedbackCategories:meta.feedbackCategories,targetConceptIds:meta.targetConceptIds,priorConceptIds:meta.priorConceptIds,...copy.sourceContract,...(source.rawSupport.transcript_in_feedback===false&&copy.answer?{feedbackTranscript:'omitted'}:{})};
  const a=copy.answer,actual=a?.kind==='ordered_slots'?a.slots.length:a?.kind==='ordered_tokens'?a.tokens.length:a?.kind==='pairs'?a.pairs.length:a?.kind==='multi_choice'?a.requiredCount:a?1:0;
  if(actual!==source.rawResponseSlotCount)throw Error(`${source.screenId}: ${actual} responses != ${source.rawResponseSlotCount}`);
  return{screenId:source.screenId,prompt:null,answer:null,praise:null,...copy,support:{before,after},audio,visual:source.rawMedia.includes('video')?'video':'none',sourceContract:c,evidence:source.evidence,unresolved:[]};
 });
 const pack={schemaVersion:optional?'1.1':'1.0',contentVersion:'1.0.0',recordId,status:'reviewed',baseScreenCount:required,provenance:{origin:'app_authored',note:'Owner-authorized reviewed Chapter 9 Japanese, readings, translations, banks and answer alternatives adapted/authored from retained targets on 6 October 2026. Literal copy is app content; all individual observed source identities, sequence, physical counts, support timing and analytical dependencies remain retained. '+(options.note??'')},policies:{assessment:'One outcome per graded base screen; required completion is separate from first accuracy and checkpoint pass reporting.',incorrectResponses:'Locked feedback and configured occurrence-only retry; no inferred remediation.',audio:'Existing Japanese TTS replacement; occurrence-specific source/feedback access.',visuals:'Static kanji and replaceable visual slots; original media deferred.'},unresolvedSourceFacts:['Exact source wording, exhaustive equivalents, original assets and acoustic alignment are unavailable; reviewed app authoring supplies complete content.','Research scores and dependency indexing do not imply owner progress or unlock rules.'],screens,...(options.retryPolicy?{retryPolicy:options.retryPolicy}:{}),...(key==='cp'?{passPolicy:{kind:'none'}}:{})};
 if(optional){const tail=record.screens.at(-1);pack.completion={contractVersion:'1.0',requiredScreenIds:screens.map(s=>s.screenId),optionalSurfaces:[{screenId:tail.screenId,sourceExerciseNumber:tail.sourceExerciseNumber,sourceActivityId:tail.sourceActivityId,purpose:tail.purpose,...optional,modes:['write'],provenance:{origin:'app_authored',note:'Separate optional private ungraded local writing. No course attempt events or community submission. Source exercise numbering retained.'}}]};}
 fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,`b2-c09-${key}.v1.json`),JSON.stringify(pack,null,2)+'\n');return pack;
}

