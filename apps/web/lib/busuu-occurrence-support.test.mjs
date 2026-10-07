import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadCourseModule} from './busuu-test-helpers.mjs';
const registry=loadCourseModule('lib/busuu/content-registry.ts'),content=loadCourseModule('lib/busuu/content-readiness.ts');
const Screen=loadCourseModule('components/busuu/LessonScreen.tsx').default;
const screen=()=>structuredClone(registry.getContentPack('B2.C05.L01').screens[3]);

test('documented omitted listening feedback allows cue-only correction without weakening ordinary audio-only truth',()=>{
 const s=screen();s.sourceContract.feedbackTranscript='omitted';s.sourceContract.recordedSupport.transcript_in_feedback=false;
 s.support.after=[{kind:'explanation',text:'The plate count contradicts the statement.'}];delete s.audio.feedbackText;
 assert.deepEqual(content.getScreenContentGaps(s),[]);
 delete s.sourceContract.feedbackTranscript;assert.ok(content.getScreenContentGaps(s).length);
 s.sourceContract.feedbackTranscript='omitted';s.sourceContract.recordedSupport.transcript_in_feedback=true;
 assert.ok(content.getScreenContentGaps(s).length);
 s.sourceContract.recordedSupport.transcript_in_feedback=false;s.audio.feedbackText=s.audio.text;assert.ok(content.getScreenContentGaps(s).length);
});

test('English-only cultural teaching remains visible while transcript-free graded tasks stay hidden',()=>{
 const s=screen();s.renderer='table';s.answer=null;s.audio.required=false;s.sourceContract.translationBeforeAnswer=true;
 s.table={caption:'Restaurant practice',columns:['Situation','Explanation'],rows:[{id:'row',cells:['This restaurant','Food is priced by serving.']}]};
 s.support={before:[{kind:'translation',text:'A serving is one portion of food.'}],after:[]};
 assert.deepEqual(content.getScreenContentGaps(s),[]);
 const html=renderToStaticMarkup(React.createElement(Screen,{screen:s,state:{phase:'presentation',audioReady:true,slots:[],matches:[]},dispatch(){}}));
 assert.match(html,/A serving is one portion of food/);
 s.support.before.push({kind:'japanese',text:'料理は一皿です。'});assert.ok(content.getScreenContentGaps(s).length);
 const graded=screen();graded.sourceContract.translationBeforeAnswer=true;graded.support.before=[{kind:'translation',text:'The answer is true.'}];
 assert.ok(content.getScreenContentGaps(graded).length);
});

test('optional scene recap requires an exact earlier visible complete dialogue and exposes it in a closed details element',()=>{
 const p=structuredClone(registry.getContentPack('B2.C05.L04')),s=p.screens[15];
 s.sourceContract.transcriptAccess='scene_recap';s.sourceContract.transcriptBeforeAnswer=true;s.support.before=[];
 assert.deepEqual(content.getScreenContentGaps(s),[]);assert.equal(content.getPackReadiness(p).playable,true);
 const Recap=loadCourseModule('components/busuu/LessonRunner.tsx').SceneRecap;
 const html=renderToStaticMarkup(React.createElement(Recap,{screen:s,source:content.getSceneReuse(p,s)}));
 assert.match(html,/<details/);assert.doesNotMatch(html,/<details[^>]*open/);assert.match(html,/チェックアウトは十時/);
 assert.equal(renderToStaticMarkup(React.createElement(Recap,{screen:{...s,sourceContract:{...s.sourceContract,transcriptAccess:undefined}},source:p.screens[10]})),'');
 s.sourceContract.sceneReuse=p.screens[12].screenId;assert.equal(content.getPackReadiness(p).playable,false);
 s.sourceContract.sceneReuse=p.screens[10].screenId;p.screens[10].dialogue.japaneseVisible=false;assert.equal(content.getPackReadiness(p).playable,false);
});

test('configured no-source-replay tasks hide pre-answer audio and guard stale playback handlers while keeping feedback replay',async()=>{
 const p=structuredClone(registry.getContentPack('B2.C06.CP')),s=p.screens[0];
 const calls=[];const audio={setScreen(){},async play(item){calls.push(item);return true;}};
 const buttons=tree=>{const out=[];const walk=v=>{if(!v||typeof v!=='object')return;if(v.type==='button')out.push(v);for(const c of [v.props?.children].flat(Infinity))walk(c);};walk(tree);return out;};
 function render(phase){let count=0;const state={phase,index:0,preview:true,audioReady:true,visited:[],outcomes:{0:{correct:true}},slots:[],matches:[]};
  const Runner=loadCourseModule('components/busuu/LessonRunner.tsx',{react:{...React,useState(initial){count++;return[count===1?state:count===6?true:typeof initial==='function'?initial():initial,()=>{}];},useRef(initial){return{current:initial===null?audio:initial};},useCallback(fn){return fn;},useEffect(){}}}).default;
  return buttons(Runner({pack:p,preview:true,title:'Counter practice',returnHref:'/busuu/B2',onExit(){}}));
 }
 delete s.audio.beforeAnswer;const stale=render('response').find(b=>String(b.props['aria-label']??b.props.children).includes('Replay audio'));assert.ok(stale);
 s.audio.beforeAnswer=false;await stale.props.onClick();assert.equal(calls.length,0,'stale source-play handler must check the occurrence contract');
 assert.ok(!render('response').some(b=>String(b.props['aria-label']??b.props.children).includes('Replay audio')));
 const corrected=render('feedback').find(b=>String(b.props.children).includes('Replay corrected sentence'));assert.ok(corrected);await corrected.props.onClick();assert.equal(calls[0].text,s.audio.feedbackText);
 s.audio.required=true;assert.ok(content.getScreenAudioGaps(s).length,'required playback cannot be unavailable');
});
