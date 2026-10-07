import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCourseModule} from './busuu-test-helpers.mjs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
function scene(){
 const registry=loadCourseModule('lib/busuu/content-registry.ts'),p=registry.getContentPack('B2.C05.L04'),s=structuredClone(p.screens.find(s=>s.renderer==='dialogue'));
 s.dialogue.kind='single_speaker';s.dialogue.speakers=['staff'];s.dialogue.turns=s.dialogue.turns.filter(t=>t.speaker==='staff');s.sourceContract.recordedSpeakerCount=1;return s;
}
test('explicit single-speaker scene retains ordered staff TTS turns without fabricating a guest',()=>{
 const s=scene(),r=loadCourseModule('lib/busuu/scene-context.ts'),ready=loadCourseModule('lib/busuu/content-readiness.ts');
 assert.deepEqual(r.getDialogueContentGaps(s),[]);assert.equal(ready.getAudioScript(s),s.dialogue.turns.map(t=>t.japanese).join('\n'));
});
test('single-speaker opt-in requires one documented supported role and complete turns; default conversations remain strict',()=>{
 const r=loadCourseModule('lib/busuu/scene-context.ts');
 for(const mutate of [s=>delete s.dialogue.kind,s=>s.sourceContract.recordedSpeakerCount=null,s=>s.dialogue.speakers=['staff','guest'],s=>s.dialogue.speakers=['narrator'],s=>s.dialogue.turns[0].japanese=null,s=>s.dialogue.turns[0].speaker='guest']){
  const s=scene();mutate(s);assert.ok(r.getDialogueContentGaps(s).length);
 }
});
test('single-speaker player uses the actual ordered-turn playback handler and names only the configured role',async()=>{
 const s=scene(),p={...loadCourseModule('lib/busuu/content-registry.ts').getContentPack('B2.C05.L04'),screens:[s],baseScreenCount:1},calls=[],dispatched=[];
 const state={phase:'presentation',index:0,preview:true,audioReady:false,visited:[],outcomes:{},slots:[],matches:[]};
 const audio={setScreen(){},async playDialogue(items){calls.push(items);return true;},async play(){throw Error('Single-speaker scenes use ordered dialogue TTS');}};let stateCount=0;
 const Runner=loadCourseModule('components/busuu/LessonRunner.tsx',{react:{...React,useState(initial){stateCount++;return[stateCount===1?state:stateCount===6?true:typeof initial==='function'?initial():initial,fn=>{if(typeof fn==='function')dispatched.push(fn(state));}];},useRef(initial){return{current:initial===null?audio:initial};},useCallback(fn){return fn;},useEffect(){}}}).default;
 const tree=Runner({pack:p,preview:true,title:'Staff scene',returnHref:'/busuu/B2',onExit(){}}),walk=(v,out=[])=>{if(!v||typeof v!=='object')return out;out.push(v);for(const c of[v.props?.children].flat(Infinity))walk(c,out);return out;};
 const nodes=walk(tree),button=nodes.find(n=>n.type==='button'&&String(n.props['aria-label']??n.props.children).includes('Replay audio'));assert.ok(button);await button.props.onClick();
 assert.deepEqual(calls[0].map(t=>t.text),s.dialogue.turns.map(t=>t.japanese));assert.ok(calls[0].every(t=>t.voice==='ja-JP-KeitaNeural'));assert.equal(dispatched.at(-1).audioReady,true);
 assert.ok(!nodes.some(n=>n.type==='p'&&/TTS/.test(String(n.props.children))),'no developer wording in the player');
});
test('single-speaker dialogue accessibility names only its configured speaker',()=>{
 const s=scene(),Dialogue=loadCourseModule('components/busuu/LessonScreen.tsx').Dialogue,html=renderToStaticMarkup(React.createElement(Dialogue,{screen:s}));
 assert.ok(html.includes(`aria-label="${s.dialogue.speakerLabels.staff} scene"`));assert.ok(!html.includes(`${s.dialogue.speakerLabels.guest} and ${s.dialogue.speakerLabels.staff}`));
});
