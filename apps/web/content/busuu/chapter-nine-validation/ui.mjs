// Brief actual shared-component inspection; not an authenticated or live TTS walkthrough.
import fs from 'node:fs';
import http from 'node:http';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadCourseModule} from '../../../lib/busuu-test-helpers.mjs';
const css=new Proxy({},{get:(_,k)=>String(k)}),overrides={'@/app/busuu/runner.module.css':{__esModule:true,default:css}};
const registry=loadCourseModule('lib/busuu/content-registry.ts'),runner=loadCourseModule('lib/busuu/runner.ts');
const Screen=loadCourseModule('components/busuu/LessonScreen.tsx',overrides).default,Optional=loadCourseModule('components/busuu/OptionalProduction.tsx',overrides).default;
const render=(id,index)=>{const p=registry.getContentPack(id),s=p.screens[index];return renderToStaticMarkup(React.createElement('main',{className:'runner'},React.createElement('h2',{className:'prompt'},s.prompt),React.createElement(Screen,{screen:s,state:{...runner.createLessonState(p),index,phase:s.answer?'response':'presentation',audioReady:true,slots:s.answer?.tokens?Array(s.answer.tokens.length).fill(null):[],matches:[],selectedOptionIds:[]},dispatch(){}})));};
const samples=[['Staff/customer reservation example','B2.C09.L01',11],['Exactly three selections','B2.C09.L02',7],['Static kanji teaching','B2.C09.L03',0],['Contextual payment table','B2.C09.L05',10],['Text-only lunch retrieval','B2.C09.L06',14],['Private optional writing','B2.C09.L07','optional'],['App-authored checkpoint chunks','B2.C09.CP',12]];
const body='<h1>Chapter 9 content inspection</h1>'+samples.map(([label,id,i])=>`<h2>${label}</h2>${i==='optional'?renderToStaticMarkup(React.createElement(Optional,{surface:registry.getContentPack(id).completion.optionalSurfaces[0]})):render(id,i)}`).join('');
const styles=fs.readFileSync(new URL('../../../app/busuu/runner.module.css',import.meta.url),'utf8');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chapter 9 UI inspection</title><style>:root{--course-ink:#213d36;--course-muted:#64748b;--course-border:#d2e0e3;--course-accent:#087f8c}*{box-sizing:border-box}body{margin:16px;background:white;font-family:Arial,sans-serif}body>h2{border-top:2px solid #d2e0e3;padding-top:20px}${styles}</style>${body}</html>`;
fs.writeFileSync(new URL('./ui.html',import.meta.url),html);
if(process.argv.includes('--serve'))http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}).listen(4189,'127.0.0.1',()=>console.log('Local chapter 9 component inspection http://127.0.0.1:4189'));
else console.log('Chapter 9 actual shared-component inspection generated.');
