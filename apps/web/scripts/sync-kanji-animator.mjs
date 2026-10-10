// Copies the standalone Kanji Stroke Animation Engine (AnimCJK brush artwork) into the app. Safe to rerun: files are only written
// when their bytes differ, and files that no longer belong in the managed destinations are removed.
//
//   node scripts/sync-kanji-animator.mjs [--from <engine folder>] [--check]
//
// Source folder: --from, else KANJI_ANIMATOR_DIR, else "<repo parent>/Kanji Animator New" next to the project folder.
//   runtime modules  src/**                                -> lib/kanji-animator/src/**   (byte-identical); LICENSE and THIRD_PARTY_LICENSES.md -> lib/kanji-animator/
//                    plus a placeholder lib/kanji-animator/data/kanji/index.js for the loader's default base URL
//   geometry         data/kanji/animcjk-brush-v1/<hex>.json -> public/kanji/animcjk-brush-v1/<hex>.json, for the kanji taught on
//                    kanji screens in content/busuu (rerun after adding kanji screens)
//   manifest         public/kanji/manifest.json lists exactly the bundled characters
//   notices          AnimCJK/Arphic licence files and third-party licences -> public/kanji/
// --check changes nothing and exits 1 when anything would change.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const fromIndex = args.indexOf('--from');
const fromArg = fromIndex >= 0 ? args[fromIndex + 1] : undefined;
const source = path.resolve(fromArg ?? process.env.KANJI_ANIMATOR_DIR ?? path.join(webRoot, '..', '..', '..', 'Kanji Animator New'));
const STYLE = 'animcjk-brush-v1';

const vendorDir = path.join(webRoot, 'lib', 'kanji-animator');
const publicDir = path.join(webRoot, 'public', 'kanji');
const contentDir = path.join(webRoot, 'content', 'busuu');

if (!fs.existsSync(path.join(source, 'src', 'index.js'))) { console.error(`Not a Kanji Animator folder: ${source}`); process.exit(2); }

let changed = 0;
const note = (verb, file) => { changed++; console.log(`${check ? 'would ' : ''}${verb} ${path.relative(webRoot, file).replaceAll('\\', '/')}`); };

function copyFile(from, to) { writeBytes(fs.readFileSync(from), to); }
function writeBytes(data, to) {
  if (fs.existsSync(to) && fs.readFileSync(to).equals(data)) return;
  note(fs.existsSync(to) ? 'update' : 'add', to);
  if (check) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, data);
}
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
/** Writes `files` (destination -> source) and removes every other file under `toDir`. */
function mirror(files, toDir) {
  for (const [to, from] of files) copyFile(from, to);
  const wanted = new Set([...files.keys()].map(file => path.resolve(file)));
  for (const file of walk(toDir)) {
    if (wanted.has(path.resolve(file))) continue;
    note('remove', file);
    if (!check) fs.rmSync(file);
  }
}

// Runtime modules (the whole src tree is runtime code) and their licences.
const srcDir = path.join(source, 'src');
mirror(new Map(walk(srcDir).map(file => [path.join(vendorDir, 'src', path.relative(srcDir, file)), file])), path.join(vendorDir, 'src'));
for (const name of ['LICENSE', 'THIRD_PARTY_LICENSES.md']) copyFile(path.join(source, name), path.join(vendorDir, name));
// The loader's unused default base URL, new URL('../../data/kanji/', import.meta.url), must resolve for the bundler; the app always passes /kanji/.
writeBytes(Buffer.from('// Placeholder so the bundler can resolve the engine loader\'s default base URL. Geometry is served from public/kanji/.\nexport {};\n'), path.join(vendorDir, 'data', 'kanji', 'index.js'));

// The kanji taught on kanji screens, in first-seen order.
const taught = new Set();
const collect = node => {
  if (Array.isArray(node)) return node.forEach(collect);
  if (!node || typeof node !== 'object') return;
  if (node.renderer === 'kanji' && typeof node.kanji?.character === 'string' && [...node.kanji.character].length === 1) taught.add(node.kanji.character);
  Object.values(node).forEach(collect);
};
for (const file of walk(contentDir).filter(file => file.endsWith('.json')).sort()) collect(JSON.parse(fs.readFileSync(file, 'utf8')));

// Geometry for every taught kanji the engine has; anything else keeps the static glyph.
const available = new Set(JSON.parse(fs.readFileSync(path.join(source, 'data', 'kanji', 'manifest.json'), 'utf8')).charactersByStyle[STYLE]);
const bundled = [...taught].filter(c => available.has(c));
const hexFile = c => `${c.codePointAt(0).toString(16).padStart(5, '0')}.json`;
mirror(new Map(bundled.map(c => [path.join(publicDir, STYLE, hexFile(c)), path.join(source, 'data', 'kanji', STYLE, hexFile(c))])), path.join(publicDir, STYLE));
const manifest = { schemaVersion: 3, defaultStyle: STYLE, characters: bundled };
writeBytes(Buffer.from(JSON.stringify(manifest, null, 2) + '\n'), path.join(publicDir, 'manifest.json'));

// Notices that must travel with the geometry (Arphic Public License artwork). Everything else in public/kanji is removed.
const licenceDir = path.join(source, 'data', 'raw', 'animcjk', 'licenses');
const notices = new Map([
  [path.join(publicDir, 'THIRD_PARTY_LICENSES.md'), path.join(source, 'THIRD_PARTY_LICENSES.md')],
  [path.join(publicDir, 'ARPHICPL.TXT'), path.join(licenceDir, 'APL', 'english', 'ARPHICPL.TXT')],
  [path.join(publicDir, 'ANIMCJK-COPYING.txt'), path.join(licenceDir, 'COPYING.txt')],
]);
for (const [to, from] of notices) copyFile(from, to);
const keep = new Set([...notices.keys(), path.join(publicDir, 'manifest.json')].map(file => path.resolve(file)));
for (const file of walk(publicDir)) {
  if (keep.has(path.resolve(file)) || path.dirname(path.resolve(file)) === path.resolve(publicDir, STYLE)) continue;
  note('remove', file);
  if (!check) fs.rmSync(file);
}
if (!check) for (const dir of fs.readdirSync(publicDir, { withFileTypes: true })) if (dir.isDirectory() && dir.name !== STYLE) fs.rmSync(path.join(publicDir, dir.name), { recursive: true, force: true });

const missing = [...taught].filter(c => !available.has(c));
if (missing.length) console.log(`No ${STYLE} geometry for: ${missing.join(' ')} (static glyph).`);
console.log(changed === 0 ? `Already in sync (${bundled.length} characters).` : `${check ? 'Out of sync' : 'Synced'}: ${changed} file change(s); ${bundled.length} characters in public/kanji/${STYLE}.`);
if (check && changed > 0) process.exit(1);
