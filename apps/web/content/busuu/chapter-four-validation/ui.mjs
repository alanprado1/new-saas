// Brief local static inspection of actual changed components; no account or remote actions.
import fs from 'node:fs';
import http from 'node:http';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
const css=new Proxy({},{get:(_,key)=>String(key)}),overrides={'@/app/busuu/runner.module.css':{__esModule:true,default:css}};
const registry=loadCourseModule('lib/busuu/content-registry.ts'),engine=loadCourseModule('lib/busuu/runner.ts');
const p=registry.getContentPack('B2.C04.L05'),Screen=loadCourseModule('components/busuu/LessonScreen.tsx',overrides).default;
const show=(index,state={})=>renderToStaticMarkup(React.createElement('main',{className:'runner'},React.createElement('h2',{className:'prompt'},p.screens[index].prompt),React.createElement(Screen,{screen:p.screens[index],state:{...engine.createLessonState(p),phase:p.screens[index].renderer==='dialogue'?'presentation':'response',index,audioReady:true,...state},dispatch(){}})));
const retryPack=registry.getContentPack('B2.C04.L01');
const retryState={...engine.createLessonState(retryPack),phase:'response',index:1,audioReady:true,visited:Array.from({length:10},(_,i)=>i),outcomes:{1:{correct:false}},slots:[null,null,null,null],retry:{queue:[1],position:0,outcomes:{},returnIndex:10}};
const renderRunner=(pack,state)=>{
 let first=true;
 const Runner=loadCourseModule('components/busuu/LessonRunner.tsx',{...overrides,react:{...React,useState(value){const initial=first?state:value;first=false;return React.useState(initial);}}}).default;
 return renderToStaticMarkup(React.createElement(Runner,{pack,preview:true,title:'Chapter 4',returnHref:'/busuu/B2',onExit(){}}));
};
const body=`<h1>Chapter 4 changed UI inspection</h1><h2>Japanese-only game scene</h2>${show(2)}<h2>Japanese-only multiplayer scene</h2>${show(8)}<h2>Select two: editable selection</h2>${show(11,{selectedOptionIds:['o0']})}<h2>Select two: graded feedback</h2>${show(11,{phase:'feedback',selectedOptionIds:['o0','o2'],outcomes:{11:{correct:true}}})}<h2>Activity-boundary four-slot retry</h2>${renderRunner(retryPack,retryState)}<h2>Correct scene replay binding</h2>${renderRunner(p,{...engine.createLessonState(p),phase:'response',index:13,audioReady:false})}`;
const styles=fs.readFileSync(new URL('../../../app/busuu/runner.module.css',import.meta.url),'utf8');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chapter 4 UI inspection</title><style>:root{--course-ink:#213d36;--course-muted:#64748b;--course-border:#d2e0e3;--course-accent:#087f8c}*{box-sizing:border-box}body{margin:16px;background:white;font-family:Arial,sans-serif}body>h2{border-top:2px solid #d2e0e3;padding-top:20px}${styles}</style>${body}</html>`;
fs.writeFileSync(new URL('./ui.html',import.meta.url),html);
if(process.argv.includes('--serve'))http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}).listen(4180,'127.0.0.1',()=>console.log('Local changed UI inspection http://127.0.0.1:4180'));
else console.log('Chapter 4 real-component UI HTML generated.');
