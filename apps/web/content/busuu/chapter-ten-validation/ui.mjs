// Brief actual shared-component inspection; not an authenticated or live TTS walkthrough.
import fs from 'node:fs';
import http from 'node:http';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadCourseModule} from '../../../lib/busuu-test-helpers.mjs';
const css=new Proxy({},{get:(_,k)=>String(k)}),overrides={'@/app/busuu/runner.module.css':{__esModule:true,default:css}};
const registry=loadCourseModule('lib/busuu/content-registry.ts'),runner=loadCourseModule('lib/busuu/runner.ts');
const Screen=loadCourseModule('components/busuu/LessonScreen.tsx',overrides).default,Optional=loadCourseModule('components/busuu/OptionalProduction.tsx',overrides).default;
const render=(id,index,feedback=false)=>{const p=registry.getContentPack(id),s=p.screens[index];return renderToStaticMarkup(React.createElement('main',{className:'runner'},React.createElement('h2',{className:'prompt'},s.prompt),React.createElement(Screen,{screen:s,state:{...runner.createLessonState(p),index,phase:feedback?'feedback':s.answer?'response':'presentation',audioReady:true,outcomes:feedback?{[index]:{correct:false}}:{},slots:s.answer?.tokens?Array(s.answer.tokens.length).fill(null):[],matches:[],selectedOptionIds:[]},dispatch(){}})));};
const renderRunner=(id,index,feedback=false)=>{
 const p=registry.getContentPack(id);let stateCount=0;
 const Runner=loadCourseModule('components/busuu/LessonRunner.tsx',{...overrides,react:{...React,useState(initial){const ordinary=React.useState(initial);return ++stateCount===1?[{...runner.createLessonState(p),index,preview:true,phase:feedback?'feedback':'presentation',audioReady:true,outcomes:feedback?{[index]:{correct:false}}:{}},()=>{}]:ordinary;}}}).default;
 return renderToStaticMarkup(React.createElement(Runner,{pack:p,preview:true,title:'Restaurant practice',returnHref:'/busuu/B2',onExit(){}}));
};
const samples=[['Authored causative formation table','B2.C10.L01',6],['Complete static kanji for formerly blank 吸 model','B2.C10.L05',5],['Hidden listening response','B2.C10.L06',0],['Bound cue-only feedback','B2.C10.L06','feedback'],['One-speaker restaurant scene','B2.C10.L09','runner'],['Untranslated departure scene','B2.C10.L09',9],['Private optional writing','B2.C10.L04','optional'],['Observed checkpoint multi-selection','B2.C10.CP',10]];
const body='<h1>Chapter 10 content inspection</h1>'+samples.map(([label,id,i])=>`<h2>${label}</h2>${i==='optional'?renderToStaticMarkup(React.createElement(Optional,{surface:registry.getContentPack(id).completion.optionalSurfaces[0]})):i==='runner'?renderRunner(id,1):i==='feedback'?renderRunner(id,0,true):render(id,i)}`).join('');
const styles=fs.readFileSync(new URL('../../../app/busuu/runner.module.css',import.meta.url),'utf8');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chapter 10 UI inspection</title><style>:root{--course-ink:#213d36;--course-muted:#64748b;--course-border:#d2e0e3;--course-accent:#087f8c}*{box-sizing:border-box}body{margin:16px;background:white;font-family:Arial,sans-serif}body>h2{border-top:2px solid #d2e0e3;padding-top:20px}${styles}</style>${body}</html>`;
fs.writeFileSync(new URL('./ui.html',import.meta.url),html);
if(process.argv.includes('--serve'))http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}).listen(4190,'127.0.0.1',()=>console.log('Local chapter 10 component inspection http://127.0.0.1:4190'));
else console.log('Chapter 10 actual shared-component inspection generated.');
