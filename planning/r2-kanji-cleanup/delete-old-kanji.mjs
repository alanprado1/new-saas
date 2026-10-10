// One-off: deletes the old Noto kanji files (listed in keys.txt, found by probing the public URL on 10 October 2026)
// from R2 bucket japanese-media. Nothing outside kanji/ is touched. Uses your `wrangler login`.
//   node planning/r2-kanji-cleanup/delete-old-kanji.mjs --dry-run
//   node planning/r2-kanji-cleanup/delete-old-kanji.mjs
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const here = new URL('.', import.meta.url);
const wrangler = new URL('../../apps/web/node_modules/wrangler/bin/wrangler.js', here);
const keys = fs.readFileSync(new URL('keys.txt', here), 'utf8').split('\n').filter(Boolean);
if (keys.some(k => !k.startsWith('kanji/'))) throw new Error('keys.txt must only list kanji/ objects');
if (process.argv.includes('--dry-run')) { console.log(`Would delete ${keys.length} objects, e.g.\n${keys.slice(0, 5).join('\n')}`); process.exit(0); }

let next = 0, done = 0; const failed = [];
async function worker() {
  while (next < keys.length) {
    const key = keys[next++];
    try { await run(process.execPath, [wrangler.pathname.replace(/^\/(\w:)/, '$1'), 'r2', 'object', 'delete', `japanese-media/${key}`, '--remote']); }
    catch { failed.push(key); }
    if (++done % 100 === 0) console.log(`${done}/${keys.length}`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log(`Deleted ${keys.length - failed.length} of ${keys.length}.`);
if (failed.length) { fs.writeFileSync(new URL('failed.txt', here), failed.join('\n') + '\n'); console.log('Failures are listed in failed.txt: copy it over keys.txt and rerun.'); process.exit(1); }
