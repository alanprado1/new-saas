// Static real-component inspection of new teaching/input/anchor variants; no account or remote actions.
import fs from 'node:fs';
import http from 'node:http';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
const css = new Proxy({}, { get: (_, key) => String(key) });
const Renderer = loadCourseModule('components/busuu/LessonScreen.tsx', { '@/app/busuu/runner.module.css': { __esModule: true, default: css } }).default;
const registry = loadCourseModule('lib/busuu/content-registry.ts'), initial = loadCourseModule('lib/busuu/attempt.ts').initialAttemptState;
const body = renderToStaticMarkup(React.createElement('main', { className: 'runner' },
  ...[['B2.C02.L02',0], ['B2.C02.L06',6], ['B2.C02.CP',12], ['B2.C02.L06',1]].map(([id, index]) => {
    const pack = registry.getContentPack(id), screen = pack.screens[index];
    const state = { ...initial(pack), index, phase: screen.renderer === 'kanji' ? 'presentation' : 'response', audioReady: true,
      typedDraft: screen.renderer === 'typed' ? 'やさ' : undefined, slots: screen.renderer === 'ordering' ? ['t0', null, null, null, null, null] : [] };
    return React.createElement('section', { key: screen.screenId, style: { marginBottom: '50px' } },
      React.createElement('h1', { className: 'prompt' }, screen.prompt), React.createElement(Renderer, { screen, state, dispatch() {} }));
  })));
const stylesheet = fs.readFileSync(new URL('../../../app/busuu/runner.module.css', import.meta.url), 'utf8');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Chapter 2 shared UI inspection</title><style>:root{--course-ink:#213d36;--course-muted:#64748b;--course-border:#d2e0e3;--course-accent:#087f8c}*{box-sizing:border-box}body{margin:0;background:white;font-family:Arial,sans-serif}${stylesheet}</style>${body}</html>`;
fs.writeFileSync(new URL('./ui.html', import.meta.url), html);
if (process.argv.includes('--serve')) http.createServer((_req, res) => { res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(html); }).listen(4178, '127.0.0.1', () => console.log('Local component inspection: http://127.0.0.1:4178'));
else console.log('Real-component chapter 2 inspection HTML generated.');
