// Brief static inspection of real changed components. No account, capture or remote action.
import fs from 'node:fs';
import http from 'node:http';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
const css = new Proxy({}, { get: (_, key) => String(key) });
const overrides = { '@/app/busuu/runner.module.css': { __esModule:true,default:css }, '@/app/busuu/busuu.module.css': { __esModule:true,default:css } };
const registry = loadCourseModule('lib/busuu/content-registry.ts');
const RunnerScreen = loadCourseModule('components/busuu/LessonScreen.tsx',overrides).default;
const renderScreen = (record,index) => {
  const pack = registry.getContentPack(record), screen = pack.screens[index];
  return renderToStaticMarkup(React.createElement('main',{className:'runner'},React.createElement('h1',{className:'prompt'},screen.prompt),
    React.createElement(RunnerScreen,{screen,state:{phase:screen.renderer==='dialogue'?'presentation':'response',audioReady:true,slots:[],matches:[]},dispatch(){}})));
};
const inventory = loadCourseModule('lib/busuu/inventory.ts'), spec = inventory.getLessonSpec('B2.C03.CP');
const entry = inventory.getCourseEntry('B2',spec.recordId);
const Launch = loadCourseModule('components/busuu/LessonLaunch.tsx',overrides).default;
const launch = renderToStaticMarkup(React.createElement(Launch,{...entry,levelId:'B2',spec,readiness:loadCourseModule('lib/busuu/readiness.ts').getLessonReadiness(spec)}));
const pack = registry.getContentPack('B2.C03.L02');
const runner = loadCourseModule('lib/busuu/runner.ts');
const retryState = {...runner.createLessonState(pack),phase:'response',index:7,audioReady:false,visited:[0,1,2,3,4,5,6,7,8],outcomes:{7:{correct:false}},
  retry:{queue:[7],position:0,outcomes:{}}};
const renderRetry = state => {
  let first = true;
  const Runner = loadCourseModule('components/busuu/LessonRunner.tsx',{...overrides,react:{...React,useState(value){
    const initial = first ? state : value; first=false; return React.useState(initial);
  }}}).default;
  return renderToStaticMarkup(React.createElement(Runner,{pack,preview:true,title:'Listening retry',returnHref:'/busuu/B2',onExit(){}}));
};
const body = `<h1>Chapter 3 changed UI</h1><h2>Japanese-only service dialogue</h2>${renderScreen('B2.C03.L03',11)}<h2>Standalone checkpoint context review</h2>${launch}<h2>Delayed question without player</h2>${renderScreen('B2.C03.CP',3)}<h2>Listening retry</h2>${renderRetry(retryState)}<h2>Correct retry feedback</h2>${renderRetry({...retryState,phase:'feedback',audioReady:true,selectedChoice:'o1',retry:{...retryState.retry,outcomes:{7:{correct:true}}}})}`;
const styles = ['runner','busuu'].map(n=>fs.readFileSync(new URL(`../../../app/busuu/${n}.module.css`,import.meta.url),'utf8')).join('\n');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chapter 3 UI inspection</title><style>:root{--course-ink:#213d36;--course-muted:#64748b;--course-border:#d2e0e3;--course-accent:#087f8c}*{box-sizing:border-box}body{margin:16px;background:white;font-family:Arial,sans-serif}body>h2{border-top:2px solid #d2e0e3;padding-top:20px}${styles}</style>${body}</html>`;
fs.writeFileSync(new URL('./ui.html',import.meta.url),html);
if(process.argv.includes('--serve')) http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}).listen(4179,'127.0.0.1',()=>console.log('Local changed UI inspection http://127.0.0.1:4179'));
else console.log('Changed real-component UI HTML generated.');
