// Brief real-component inspection, not an authenticated or live acoustic walkthrough.
import fs from 'node:fs';
import http from 'node:http';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadCourseModule} from '../../../lib/busuu-test-helpers.mjs';
const css=new Proxy({},{get:(_,k)=>String(k)}),overrides={'@/app/busuu/runner.module.css':{__esModule:true,default:css}};
const registry=loadCourseModule('lib/busuu/content-registry.ts'),runner=loadCourseModule('lib/busuu/runner.ts');
const Screen=loadCourseModule('components/busuu/LessonScreen.tsx',overrides).default;
const Recap=loadCourseModule('components/busuu/LessonRunner.tsx',overrides).SceneRecap;
const reuse=loadCourseModule('lib/busuu/content-readiness.ts').getSceneReuse;
const render=(id,index)=>{const p=registry.getContentPack(id),s=p.screens[index];
 return renderToStaticMarkup(React.createElement('main',{className:'runner'},React.createElement('h2',{className:'prompt'},s.prompt),
  React.createElement(Recap,{screen:s,source:reuse(p,s)}),React.createElement(Screen,{screen:s,state:{...runner.createLessonState(p),index,phase:s.answer?'response':'presentation',audioReady:true,slots:s.answer?.kind==='ordered_tokens'?Array(s.answer.tokens.length).fill(null):[],matches:[]},dispatch(){}})));};
const optional=registry.getContentPack('B2.C06.L02').completion.optionalSurfaces[0];
let hook=0;
const Writing=loadCourseModule('components/busuu/OptionalProduction.tsx',{...overrides,react:{...React,useState(initial){hook++;return[hook===1?true:initial,()=>{}];}}}).default;
const writing=renderToStaticMarkup(React.createElement('main',{className:'runner'},React.createElement(Writing,{surface:optional})));
const body=`<h1>Chapter 6 changed UI</h1><h2>English-only cultural teaching</h2>${render('B2.C06.L04',3)}<h2>Optional complete Japanese scene recap</h2>${render('B2.C06.L06',2)}<h2>Kana response support</h2>${render('B2.C06.CP',8)}<h2>Ordering without source replay</h2>${render('B2.C06.CP',0)}<h2>Private food writing</h2>${writing}`;
const styles=fs.readFileSync(new URL('../../../app/busuu/runner.module.css',import.meta.url),'utf8');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chapter 6 UI inspection</title><style>:root{--course-ink:#213d36;--course-muted:#64748b;--course-border:#d2e0e3;--course-accent:#087f8c}*{box-sizing:border-box}body{margin:16px;background:white;font-family:Arial,sans-serif}body>h2{border-top:2px solid #d2e0e3;padding-top:20px}${styles}</style>${body}</html>`;
fs.writeFileSync(new URL('./ui.html',import.meta.url),html);
if(process.argv.includes('--serve'))http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}).listen(4182,'127.0.0.1',()=>console.log('Local changed UI inspection http://127.0.0.1:4182'));
else console.log('Actual chapter 6 shared-component inspection HTML generated.');
