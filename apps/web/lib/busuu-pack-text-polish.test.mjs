import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as checks from '../content/busuu/b2-polish/pack-text-checks.mjs';
import { buildAll, transformPack, australian, curlyApostrophes, PROMPT_RULES, restoreKatakana } from '../content/busuu/b2-polish/pack-text-transform.mjs';
import { runSavedPaths } from '../content/busuu/b2-polish/pack-text-saved-path.mjs';

// B2 learner-text polish (8 October 2026). Mechanics and invariants live in content/busuu/b2-polish/pack-text-*.mjs.

test('every pre-polish B2 version keeps its exact bytes and saved-attempt fingerprint', () => {
  const r = checks.checkBaseline();
  assert.equal(r.versions, 75);
});

test('polished versions are current, older versions stay registered and resolve by exact version', () => {
  const r = checks.checkRegistry();
  assert.deepEqual(r, { changedRecords: 70, unchangedRecords: 3, records: 73 });
});

test('every polished version is playable and aligned with the recorded lesson sequence', () => {
  assert.equal(checks.checkReadinessAndAlignment().packs, 70);
});

test('answer keys, accepted forms, tokens, option IDs, partitions, counts, audio, source contracts and evidence equal the predecessor; only learner text differs', () => {
  const r = checks.checkAllInvariance();
  assert.equal(r.packs, 70);
  assert.ok(r.changedFields > 1000);
});

test('regenerating the polish from the immutable baseline reproduces every new pack file byte for byte', () => {
  const { results } = buildAll();
  assert.equal(results.length, 70);
  for (const r of results) assert.equal(fs.readFileSync(path.resolve(import.meta.dirname, '../content/busuu', r.file), 'utf8'), r.bytes, r.file);
});

test('current B2 learner text is free of engine wording, uses Australian spelling and curly apostrophes, and readings are run together', () => {
  const r = checks.checkWording();
  assert.equal(r.records, 73);
  assert.ok(r.learnerStrings > 7000);
});

test('B2.C02.L02 1.2.0 adds the third 参 example; its 1.1.0 predecessor keeps its bytes and fingerprint and nothing else differs', () => {
  assert.deepEqual(checks.checkFollowups(), { followups: 1, changedLeaves: 1 });
  const pack = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../content/busuu/b2-c02-l02.v3.json'), 'utf8'));
  const s = pack.screens.find(x => x.screenId === 'B2.C02.L02.A01.S01');
  assert.deepEqual(s.kanji.examples.map(e => [e.word, e.reading]), [['参る', 'まいる'], ['お墓参り', 'おはかまいり'], ['参加', 'さんか']]);
});

test('TTS-only readings are deliberately left as they were', () => {
  const r = checks.checkLeftAlone();
  assert.ok(r.audioReadingsWithSpaces > 0 && r.dialogueReadingsWithSpaces > 0);
});

test('mechanical transforms: Australian spelling keeps honorific, program and Japanese text', () => {
  assert.equal(australian('The favorite color: honorific, program, 色, Romanized'), 'The favourite colour: honorific, program, 色, Romanised');
  assert.equal(australian('emphasizes, recognize, nominalizing, skillful, judgment, enrollment'), 'emphasises, recognise, nominalising, skilful, judgement, enrolment');
  assert.equal(curlyApostrophes("I'm from Kyoto. 'quoted' stays"), "I’m from Kyoto. 'quoted' stays");
  const rule = name => PROMPT_RULES.find(r => r[0] === name)[2];
  assert.equal(rule('check-instruction')('Type the reading, then select Check.'), 'Type the reading.');
  assert.equal(rule('listen-prefix')('Listen. Insert the two kanji.'), 'Listen and insert the two kanji.');
  assert.equal(rule('listen-prefix')('Listen. Which topic interests the speaker?'), 'Listen. Which topic interests the speaker?');
  assert.equal(rule('ordering-verb')('Arrange the request.'), 'Build the request.');
});

test('reading spacing is removed from visible readings only and never from a string that is also an answer surface', () => {
  const base = { recordId: 'B2.C99.T01', contentVersion: '1.0.0', screens: [{
    screenId: 'S1', renderer: 'typed', prompt: 'Type it.', praise: 'Well done!', support: { before: [], after: [{ kind: 'japanese', text: 'あ い', secondary: 'お なまえ は' }] },
    answer: { kind: 'typed', acceptedForms: ['お なまえ は'], normalization: 'nfkc_trim' }, typed: { label: 'Your answer', before: '', after: '' }, audio: { required: true, text: 'x', reading: 'お なまえ は' } }] };
  const log = [];
  const { pack, skippedReadings } = transformPack(base, log);
  assert.equal(pack.screens[0].support.after[0].secondary, 'お なまえ は', 'reading equal to an accepted form is left and reported');
  assert.equal(skippedReadings.length, 1);
  base.screens[0].answer.acceptedForms = ['x'];
  const second = transformPack(base, []);
  assert.equal(second.pack.screens[0].support.after[0].secondary, 'おなまえは');
  assert.equal(second.pack.screens[0].audio.reading, 'お なまえ は', 'TTS-only reading untouched');
  assert.deepEqual(second.pack.screens[0].answer, base.screens[0].answer);
});

test('registered saved paths: current and previous versions of a sample complete, reload and keep their own version', async () => {
  const r = await runSavedPaths(['B2.C01.L01', 'B2.C06.L04', 'B2.C10.L05']);
  assert.equal(r.records.length, 6);
  assert.ok(r.records.every(x => x.saved && x.reloaded && x.accuracy === 100));
  assert.equal(r.liveDatabaseWrites, false);
});

test('the invariance check rejects answer-key, token, option, Japanese-text, reading-content and structure changes', () => {
  const rd = f => JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../content/busuu', f), 'utf8'));
  const oldPack = rd('b2-c05-l01.v1.json'), newPack = rd('b2-c05-l01.v2.json');
  assert.ok(checks.checkInvariance(oldPack, newPack).length > 0, 'the real pair passes');
  const mutate = (label, fn) => { const copy = structuredClone(newPack); fn(copy); assert.throws(() => checks.checkInvariance(oldPack, copy), undefined, label); };
  const gaps = newPack.screens.findIndex(s => s.answer?.kind === 'ordered_slots'), choice = newPack.screens.findIndex(s => s.answer?.kind === 'choice');
  mutate('token text', p => { p.screens[gaps].answer.tokens[0].text += 'x'; });
  mutate('token id', p => { p.screens[gaps].answer.tokens[0].id += 'x'; });
  mutate('accepted slot', p => { p.screens[gaps].answer.slots[0].acceptedTokenIds = ['zz']; });
  mutate('accepted option', p => { p.screens[choice].answer.acceptedOptionIds = ['zz']; });
  mutate('option order', p => { p.screens[choice].answer.options.reverse(); });
  mutate('Japanese support text', p => { const b = p.screens[0].support.before.find(x => x.kind === 'japanese'); b.text += 'あ'; });
  mutate('reading content (not just spacing)', p => { const b = p.screens[0].support.before.find(x => x.kind === 'japanese'); b.secondary = b.secondary.slice(1); });
  mutate('scaffold', p => { p.screens[gaps].scaffold[0] += 'あ'; });
  mutate('audio text', p => { p.screens[0].audio.text += 'あ'; });
  mutate('screen removed', p => { p.screens.pop(); });
  mutate('support block removed', p => { p.screens[0].support.before.pop(); });
  mutate('source contract', p => { p.screens[0].sourceContract.responseSlotCount = 9; });
  mutate('retry policy', p => { p.retryPolicy = { kind: 'end_once', screenIds: [] }; });
  mutate('base count', p => { p.baseScreenCount += 1; });
});

test('B2.C01.L01 reading lines hold kana only: katakana words stay katakana, kanji get hiragana readings', () => {
  assert.ok(checks.checkL01Readings().readingLines === 11);
});

test('every visible reading line keeps the katakana runs of its surface (skipped and deferred lines are listed)', () => {
  const r = checks.checkKatakanaReadings();
  assert.ok(r.linesWithKatakana > 150);
  assert.equal(r.listedStillLacking, 0, 'no skipped or deferred katakana lines remain');
});

test('katakana alignment restores katakana words, skips instead of guessing, and the invariance rule allows only that swap', () => {
  assert.equal(restoreKatakana('今日はカレーライスです。', 'きょうはかれーらいすです。').text, 'きょうはカレーライスです。');
  assert.equal(restoreKatakana('ペコペコなので', 'ぺこぺこなので').text, 'ペコペコなので');
  assert.equal(restoreKatakana('チェックアウト', 'ちぇっくあうと').text, 'チェックアウト');
  assert.equal(restoreKatakana('カレーはカレー', 'かれーはかれー').text, 'カレーはカレー');
  assert.equal(restoreKatakana('ニ', 'ここ').status, 'nomatch');
  assert.equal(restoreKatakana('漢コ漢', 'ここここ').status, 'ambiguous');
  assert.equal(restoreKatakana('テスト。', 'てすと！').status, 'nomatch');
  assert.equal(restoreKatakana('もう', 'もう').status, 'ok');
  assert.ok(checks.sameReadingModuloKatakana('ぴあのをならう', 'ピアノをならう'));
  assert.ok(!checks.sameReadingModuloKatakana('ぴあのをならう', 'ピアノをならえ'));
  assert.ok(!checks.sameReadingModuloKatakana('ぴあの', 'ピアのん'));
});
