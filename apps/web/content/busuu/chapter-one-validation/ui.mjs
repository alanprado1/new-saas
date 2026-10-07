// Brief shared-component visual inspection; static snapshots, no auth/TTS/database actions.
import fs from 'node:fs';
import http from 'node:http';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
const css = new Proxy({}, { get: (_, key) => String(key) });
const overrides = { '@/app/busuu/runner.module.css': { __esModule: true, default: css } };
const Renderer = loadCourseModule('components/busuu/LessonScreen.tsx', overrides).default;
// Open the actual writing branch for visual QA, without adding a production route.
let call = 0;
const Optional = loadCourseModule('components/busuu/OptionalProduction.tsx', { ...overrides,
  react: { ...React, useState: value => [call++ % 2 === 0 ? true : value, () => {}] } }).default;
const pack = loadCourseModule('lib/busuu/content-registry.ts').getContentPack('B2.C01.L05');
const screen = pack.screens[5], state = { ...loadCourseModule('lib/busuu/attempt.ts').initialAttemptState(pack),
  index: 5, phase: 'response', audioReady: true, slots: ['japan', null, null, null, null] };
const body = renderToStaticMarkup(React.createElement('main', { className: 'runner', style: { margin: '24px auto', padding: '24px', maxWidth: '620px' } },
  React.createElement('h1', null, screen.prompt), React.createElement(Renderer, { screen, state, dispatch() {} }),
  React.createElement('p', null, 'Local component inspection: partially placed sentence and separate optional writing.'),
  React.createElement(Optional, { surface: pack.completion.optionalSurfaces[0] })));
const stylesheet = fs.readFileSync(new URL('../../../app/busuu/runner.module.css', import.meta.url), 'utf8');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Course shared UI inspection</title><style>*{box-sizing:border-box}body{margin:0;background:white;color:#213d36;font-family:Arial,sans-serif}button,textarea{font:inherit}h1{font-size:25px;line-height:1.4}${stylesheet}</style>${body}</html>`;
fs.writeFileSync(new URL('./ui.html', import.meta.url), html);
if (process.argv.includes('--serve')) http.createServer((_req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); }).listen(4177, '127.0.0.1', () => console.log('Local static shared-component inspection: http://127.0.0.1:4177'));
else console.log('Shared UI inspection HTML generated.');
