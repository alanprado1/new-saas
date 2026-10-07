// Runs the full validation for the B2 pack-text polish and writes pack-text-validation.json. Run from apps/web:
//   node content/busuu/b2-polish/pack-text-validation.mjs
// Checks: pre-polish bytes/fingerprints, registry resolution, readiness + alignment, answer-key invariance, wording guard,
// deterministic regeneration, ten registered saved paths (current and previous version), and the consistency scan before/after.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as checks from './pack-text-checks.mjs';
import { buildAll } from './pack-text-transform.mjs';
import { runSavedPaths } from './pack-text-saved-path.mjs';

const here = import.meta.dirname, root = checks.root;
const result = { date: '2026-10-08' };
result.baseline = checks.checkBaseline();
result.registry = checks.checkRegistry();
result.readinessAndAlignment = checks.checkReadinessAndAlignment();
result.invariance = checks.checkAllInvariance();
result.wording = checks.checkWording();
result.l01Readings = checks.checkL01Readings();
result.katakanaReadings = checks.checkKatakanaReadings();
result.leftAlone = checks.checkLeftAlone();
result.followups = checks.checkFollowups();
const { results } = buildAll();
for (const r of results) assert.equal(fs.readFileSync(path.join(root, r.file), 'utf8'), r.bytes, `${r.file} deterministic`);
result.deterministicRegeneration = { packs: results.length, byteIdentical: true };
const saved = await runSavedPaths();
result.savedPaths = saved;

// consistency scan: pre-polish registered versions vs. current versions, same (Australian-English, run-together readings) rules
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'b2-scan-'));
try {
  for (const p of checks.baseline().packs) fs.copyFileSync(path.join(root, p.file), path.join(tmp, p.file));
  const beforeFile = path.join(tmp, 'scan-before.json'), afterFile = path.join(tmp, 'scan-after.json');
  const scan = path.join(here, 'consistency-scan.mjs');
  execFileSync(process.execPath, [scan], { env: { ...process.env, B2_SCAN_CONTENT_DIR: tmp, B2_SCAN_OUT: beforeFile }, stdio: 'ignore' });
  execFileSync(process.execPath, [scan], { env: { ...process.env, B2_SCAN_OUT: afterFile }, stdio: 'ignore' });
  const count = file => { const m = {}; for (const f of JSON.parse(fs.readFileSync(file, 'utf8')).findings) if (f.current) m[f.check] = (m[f.check] || 0) + 1; return m; };
  const b = count(beforeFile), a = count(afterFile);
  result.consistencyScan = Object.fromEntries([...new Set([...Object.keys(b), ...Object.keys(a)])].sort().map(k => [k, { before: b[k] || 0, after: a[k] || 0 }]));
  result.consistencyScanTotals = { before: Object.values(b).reduce((x, y) => x + y, 0), after: Object.values(a).reduce((x, y) => x + y, 0) };
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

fs.writeFileSync(path.join(here, 'pack-text-validation.json'), JSON.stringify(result, null, 2) + '\n');
console.log(`Baseline ${result.baseline.versions} versions intact; ${result.registry.changedRecords} records polished (${result.registry.unchangedRecords} unchanged); ${result.readinessAndAlignment.packs} packs playable+aligned;`);
console.log(`invariance: ${result.invariance.packs} packs / ${result.invariance.screens} screens / ${result.invariance.changedFields} learner-text changes only; wording guard over ${result.wording.learnerStrings} strings; ${saved.assertions} saved-path assertions.`);
console.log('Scan totals', result.consistencyScanTotals);
