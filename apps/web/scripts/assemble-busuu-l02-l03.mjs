// Offline assembly from retained evidence only. No capture, TTS generation or invented lesson copy.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const reference = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Provide the retained outputs package directory.');
const output = path.resolve(process.argv[3] ?? path.join(import.meta.dirname, '../content/busuu'));
const planning = path.resolve(process.argv[4] ?? path.join(import.meta.dirname, '../../../planning/2026-10-03-busuu-integration'));
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const unifiedPath = 'Unified-B2-Lesson-Records.json';
const unified = JSON.parse(fs.readFileSync(path.join(reference, unifiedPath), 'utf8'));
const master = 'Master-Japanese-Course-and-Implementation-Reference.md';
const structural = 'Evidence/S18-B2-Lesson-Structural-Evidence.md';
// Read every packaged textual evidence file before assessing availability. Preserve a reproducible search inventory.
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const searches = walk(reference).filter(p => /\.(json|md)$/i.test(p)).map(file => {
  const text = fs.readFileSync(file, 'utf8');
  return { packagedPath: path.relative(reference, file).replaceAll('\\', '/'), sourceHash: digest(file),
    relevant: /B2[.-]C0?1[.-]L[23]|C1\.[23]|Asking a question respectfully|Talking about your interests|Hotel guest\/staff/i.test(text) };
});
const planningSearches = walk(planning).filter(p => /\.(json|md)$/i.test(p)).map(file => ({
  packagedPath: `planning/2026-10-03-busuu-integration/${path.relative(planning, file).replaceAll('\\', '/')}`, sourceHash: digest(file),
  relevant: /B2[.-]C0?1[.-]L[23]|C1\.[23]|Asking a question respectfully|Talking about your interests/i.test(fs.readFileSync(file, 'utf8')),
}));
const packagedImages = walk(reference).filter(p => /\.(jpg|png|webp)$/i.test(p)).map(file => ({
  packagedPath: path.relative(reference, file).replaceAll('\\', '/'), sourceHash: digest(file),
}));
const evidence = (file, sourceId, locator, classification = 'O') => ({ sourceId, packagedPath: file, sourceHash: digest(path.join(reference, file)), jsonPointerOrHeading: locator, classification });
const renderers = { speaker_model: 'model', audio_gap: 'gaps', grammar_table: 'table', matching: 'pairs', sentence_choice: 'choice', listening_choice: 'choice', word_model: 'model', text_true_false: 'truth', scene_model: 'dialogue' };
fs.mkdirSync(output, { recursive: true });
const packs = [];
for (const id of ['B2.C01.L02', 'B2.C01.L03']) {
  const index = unified.records.findIndex(r => r.canonical_id === id), r = unified.records[index];
  if (!r) throw new Error(`Missing canonical record ${id}`);
  const screens = r.architecture.screen_records.map((s, i) => {
    const renderer = renderers[s.renderer];
    if (!renderer) throw new Error(`Unmapped renderer ${s.renderer}`);
    const gap = (field, reason) => ({ screenId: s.canonical_screen_id, field, reason });
    const teaching = ['model', 'table', 'dialogue'].includes(renderer);
    const transcriptBeforeAnswer = s.support.japanese_transcript_before_answer ??
      ((renderer === 'model' || (id.endsWith('L03') && i === 3)) ? true : null);
    const hintBeforeAnswer = id.endsWith('L02') && i === 4;
    const parallelReadingBeforeAnswer = id.endsWith('L03') && i === 2;
    const translationBeforeAnswer = parallelReadingBeforeAnswer ? true : s.support.translation_visible;
    const required = s.media.length > 0 || teaching;
    const unresolved = [gap('prompt', 'Exact instruction text is not retained; the recorded purpose is a paraphrase.')];
    if (renderer === 'model') unresolved.push(gap('model.japanese', 'Complete Japanese example and any parallel reading are unavailable.'), gap('model.english', 'Complete model translation is unavailable.'));
    if (parallelReadingBeforeAnswer) unresolved.push(gap('model.reading', 'The recorded parallel kana/kanji history model is unavailable.'));
    if (!teaching) unresolved.push(gap('answer.options', 'Complete visible bank/options and their order are unavailable.'), gap('answer.mapping', 'A complete reviewed mapping is unavailable; research success is not an answer key.'), gap('feedback.correction', 'Complete corrected Japanese, permitted readings and translation are unavailable.'), gap('feedback.explanation', 'Exact feedback/praise copy is unavailable.'));
    if (renderer === 'gaps') unresolved.push(gap('scaffold', 'Complete Japanese scaffold and gap boundaries are unavailable.'));
    if (renderer === 'truth') unresolved.push(gap('statement', 'Exact judgment statement and supported Japanese source are unavailable.'));
    if (renderer === 'pairs') unresolved.push(gap('pairs.left', 'Both actor endpoints are unavailable.'), gap('pairs.right', 'Both predicate endpoints are unavailable.'));
    if (renderer === 'table') unresolved.push(gap('table.caption', 'Exact explanation/caption is unavailable.'), gap('table.rows', 'Complete actor/register table cells, readings and example order are unavailable.'));
    if (hintBeforeAnswer) unresolved.push(gap('hint.text', 'A pre-answer hint is recorded, but its exact copy is unavailable.'));
    if (renderer === 'dialogue') unresolved.push(gap('dialogue.turns', 'Guest/staff roles are recorded; exact Japanese speaker turns and turn order are unavailable.'), gap('dialogue.english', 'English dialogue support was visible, but the complete wording is unavailable.'));
    if (required) unresolved.push(gap(renderer === 'dialogue' ? 'audio.dialogue' : 'audio.text', 'Complete Japanese script for the identified app TTS replacement is unavailable.'));
    return {
      screenId: s.canonical_screen_id, renderer, prompt: null, answer: null, praise: null,
      support: { before: [], after: [] }, audio: { required, text: null },
      visual: s.renderer === 'speaker_model' || renderer === 'dialogue' ? 'video' : 'none',
      ...(renderer === 'table' ? { table: { caption: null, columns: ['Actor', 'Register', 'Japanese example'], rows: [] } } : {}),
      ...(hintBeforeAnswer ? { hint: { text: null } } : {}),
      ...(renderer === 'dialogue' ? { dialogue: { japaneseVisible: false, speakers: ['guest', 'staff'], turns: [] } } : {}),
      sourceContract: { purpose: s.cognitive_purpose, sourceRenderer: s.renderer, sourceRendererId: s.source_renderer_id,
        sourceActivityId: s.activity_id_from_visible_url, responseSlotCount: s.response_slot_count, responseSlotCountState: s.response_slot_count_state,
        transcriptBeforeAnswer, translationBeforeAnswer, parallelReadingBeforeAnswer, hintBeforeAnswer,
        recordedSupport: s.support, feedbackCategories: s.feedback_categories, targetConceptIds: s.target_concepts, priorConceptIds: s.prior_concepts,
        ...(id.endsWith('L03') && i === 9 ? { sceneReuse: 'B2.C01.L03.A01.S09' } : {}) },
      evidence: [evidence(unifiedPath, 'UNIFIED-B2', `/records/${index}/architecture/screen_records/${i}`),
        evidence(structural, 'S18', id.endsWith('L02') ? 'C1.2 Asking a question respectfully' : 'C1.3 Talking about your interests'),
        evidence(master, 'MASTER', `#### ${id}`), evidence(r.source_provenance.packaged_path, r.source_provenance.source_id, r.source_provenance.locator)],
      unresolved,
    };
  });
  const pack = { schemaVersion: '1.0', contentVersion: '1.0.0', recordId: id, status: 'development_preview', baseScreenCount: screens.length,
    provenance: { origin: 'source_observation', note: 'Retained O structural observations and I mappings, not complete source lesson copy. Recorded purposes/support flags remain separate from unavailable literal content. Preview headers, table column labels and missing-field placeholders are app-authored. No new capture or research; no test fixture becomes runtime content.' },
    policies: { assessment: 'No score, saved attempt or completion while required fields remain missing. Once reviewed, use the shared server evaluator with equal weight per graded screen; teaching table/models/dialogue are ungraded.',
      incorrectResponses: 'App policy: completed choices/gaps lock; wrong pairs can be retried while retaining a screen mistake. Source wrong-answer rules remain unknown.',
      audio: 'Existing Japanese TTS options. Dialogue replacement uses identified guest/staff turns with visible documented English support. Original video/audio are deferred; no invented script.',
      visuals: 'Replaceable neutral visual slots; original media deferred.' },
    unresolvedSourceFacts: r.unknowns,
    screens };
  const filename = `b2-c01-${id.slice(-3).toLowerCase()}.v1.json`;
  fs.writeFileSync(path.join(output, filename), JSON.stringify(pack, null, 2) + '\n');
  packs.push({ recordId: id, filename, sourceRecordIndex: index, contentHash: createHash('sha256').update(JSON.stringify(pack)).digest('hex'),
    fieldGaps: screens.flatMap(s => s.unresolved) });
}
fs.mkdirSync(path.join(output, 'expansion-validation'), { recursive: true });
fs.writeFileSync(path.join(output, 'expansion-validation/evidence-audit.json'), JSON.stringify({
  date: '2026-10-04', searches, planningSearches, packagedImages, conclusion: 'S18, S16, S25, unified records, master reference and planning baseline retain purposes/support functions but no complete L02/L03 text, answer banks, hint or hotel dialogue. Packaged images cover maps/results. No new capture. Null fields remain null.', packs,
}, null, 2) + '\n');
console.log('Assembled L02 (9) and L03 (10) development packs; retained evidence unchanged.');
