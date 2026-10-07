import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const version = '1.0.0';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const emptyField = evidence => ({ value: null, availability: 'missing', origin: 'unknown', evidence });

// This offline importer requires an explicit source root. The running app never reads it.
export function importReference(referenceRoot, planningRoot, outputRoot) {
  const sources = [];
  function read(root, filename, sourceId) {
    const bytes = fs.readFileSync(path.join(root, filename));
    sources.push({ sourceId, packagedPath: filename, sourceHash: digest(bytes) });
    return JSON.parse(bytes);
  }
  const raw = read(referenceRoot, 'Unified-Course-Inventory.json', 'UNIFIED-INVENTORY');
  const records = read(referenceRoot, 'Unified-B2-Lesson-Records.json', 'UNIFIED-B2');
  const manifest = read(referenceRoot, 'Source-Manifest.json', 'MANIFEST');
  const audit = read(planningRoot, 'B2-Chapter-1-Content-and-Asset-Readiness.json', 'C1-AUDIT');
  const live = read(planningRoot, 'evidence-next/B2-C01-L01/B2-C01-L01-Evidence.json', 'LIVE-2026-10-03-B2-C01-L01');
  const images = read(planningRoot, 'evidence-next/B2-C01-L01/Desktop-State-Evidence/manifest.json', 'LIVE-IMAGES');
  // Fail before writing if the consolidated package disagrees with its own manifest.
  for (const source of sources.slice(0, 2)) {
    const hashRecord = manifest.primary_output_hashes?.[source.packagedPath];
    const expected = typeof hashRecord === 'string' ? hashRecord : hashRecord?.sha256;
    if (!expected || expected.toLowerCase() !== source.sourceHash) throw new Error(`Source hash mismatch or absent digest: ${source.packagedPath}`);
  }
  const ref = (sourceId, pointer, classification = 'O') => {
    const source = sources.find(s => s.sourceId === sourceId);
    return { ...source, jsonPointerOrHeading: pointer, classification };
  };
  const field = (value, origin, evidence) => ({ value, availability: value == null ? 'unknown' : 'available', origin: value == null ? 'unknown' : origin, evidence });
  const levelNames = { A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate', B2: 'Upper Intermediate' };
  const inventory = {
    version, courseId: 'complete-japanese', title: 'Complete Japanese',
    levels: raw.levels.map((l, li) => ({
      id: l.level, name: levelNames[l.level], chapters: l.chapters.map((c, ci) => {
        const chapterPointer = `/levels/${li}/chapters/${ci}`;
        const entries = [];
        const addAssessment = (a, ai) => entries.push({
          id: a.canonical_id, kind: a.entry_type, cardOrder: null, afterCardOrder: a.after_card_order,
          recordedSourceLabel: a.source_label,
          sourceLabel: field(a.source_label, 'source_observation', [ref('UNIFIED-INVENTORY', `${chapterPointer}/assessments/${ai}/source_label`, a.source_label ? 'O' : 'U')]),
          mappedObjective: field(a.mapped_label, 'map_paraphrase', [ref('UNIFIED-INVENTORY', `${chapterPointer}/assessments/${ai}/mapped_label`, 'M')]),
          evidenceDepth: a.evidence_depth, evidence: [ref('UNIFIED-INVENTORY', `${chapterPointer}/assessments/${ai}`, a.evidence_class)],
        });
        c.assessments.forEach((a, ai) => { if (a.after_card_order === 0) addAssessment(a, ai); });
        c.cards.forEach((card, ki) => {
          const pointer = `${chapterPointer}/cards/${ki}`;
          const evidence = [ref('UNIFIED-INVENTORY', pointer, card.source_navigation_label.evidence_class)];
          let label = card.source_navigation_label.text;
          // Analyst fluency suffixes are not observed navigation titles. Live C1 confirms the base label.
          if (label?.startsWith('Developing fluency')) label = 'Developing fluency';
          const labelEvidence = card.canonical_id === 'B2.C01.L05'
            ? [ref(live.capture_id, '/navigation', 'O')] : evidence;
          entries.push({ id: card.canonical_id, kind: card.entry_type, cardOrder: card.card_order, afterCardOrder: null,
            recordedSourceLabel: card.source_navigation_label.text,
            sourceLabel: field(label, 'source_observation', labelEvidence),
            mappedObjective: field(card.mapped_objective.text, 'map_paraphrase', [ref('UNIFIED-INVENTORY', `${pointer}/mapped_objective`, 'M')]),
            evidenceDepth: card.evidence_depth, evidence });
          c.assessments.forEach((a, ai) => { if (a.after_card_order === card.card_order) addAssessment(a, ai); });
        });
        if (entries.length !== c.cards.length + c.assessments.length) throw new Error(`Unplaced assessment in ${c.canonical_id}`);
        return { id: c.canonical_id, number: c.chapter_number, label: c.source_chapter_label, entries };
      }),
    })),
  };
  const lessons = {
    version,
    records: records.records.map((record, ri) => {
      const pointer = `/records/${ri}`;
      const evidence = [ref('UNIFIED-B2', pointer)];
      const rawScreens = record.architecture.screen_records ?? [];
      return {
        recordId: record.record_id, contentVersion: version,
        baseScreenCount: record.coverage.base_screen_count ?? null,
        sequenceState: record.architecture.activity_partition_state ?? 'unknown',
        evidenceDepth: record.coverage.evidence_depth,
        evidence,
        activities: (record.architecture.activities ?? []).map(a => ({
          activityId: a.canonical_activity_id, ordinal: a.activity_ordinal,
          sourceActivityIds: a.source_activity_ids, baseScreenCount: a.base_screen_count, screenIds: a.screen_ids,
        })),
        curriculum: { objective: record.curriculum.objective_paraphrase, grammarTargets: record.curriculum.grammar_targets,
          vocabularyCategories: record.curriculum.vocabulary_categories, newConceptIds: record.curriculum.new_concept_ids,
          priorConceptIds: record.curriculum.assumed_prior_concept_ids },
        dependencies: (record.curriculum.normalized_dependencies ?? []).filter(d => d.catalogued_source_record).map(d => ({
          recordId: d.catalogued_source_record, conceptId: d.concept_id, classification: d.necessity_evidence_class,
          sourceEnforced: d.necessity_enforced_by_source ?? null,
          note: d.catalogued_source_record === 'B2.C01.L05'
            ? 'Checkpoint includes cultural sake-vessel vocabulary taught in Developing fluency. Core teaching is required context; production is optional. Source unlock rules are unknown.'
            : 'Catalogued teaching dependency; necessity is an interpretation, not a proven source lock.',
        })),
        optionalProduction: record.record_id === 'B2.C01.L05' ? { endpointOptional: true, coreTeachingScreenCount: 7 } : null,
        screens: rawScreens.map((s, si) => {
          const screenEvidence = [ref('UNIFIED-B2', `${pointer}/architecture/screen_records/${si}`)];
          const captured = live.screens.find(x => x.screen_id === s.canonical_screen_id);
          const baselineAudit = audit.milestone_screens.find(x => x.screen_id === s.canonical_screen_id);
          const liveEvidence = captured ? [ref(live.capture_id, `/screens/${live.screens.indexOf(captured)}`)] : [];
          return {
            screenId: s.canonical_screen_id, baseOrdinal: s.base_ordinal, activityOrdinal: s.activity_ordinal,
            ordinalInActivity: s.ordinal_in_activity, sourceScreenId: s.source_screen_id ?? null,
            sourceExerciseNumber: s.source_exercise_number ?? null,
            sourceActivityId: s.activity_id_from_visible_url ?? baselineAudit?.source_activity_id ?? null,
            rendererId: s.renderer_id ?? null, rawRenderer: s.source_renderer ?? s.renderer ?? null,
            sourceRendererId: s.source_renderer_id ?? null, sourceReference: s.source_reference ?? null,
            purpose: s.cognitive_purpose ?? s.phase ?? null,
            rawSupport: s.support, rawResponseSlotCount: s.response_slot_count,
            responseSlotCountState: s.response_slot_count_state, rawMedia: s.media, rawMediaStructure: s.media_structure,
            rawGradingObserved: s.grading_observed ?? null, rawFeedbackParaphrase: s.feedback_paraphrase ?? null,
            prompt: captured?.content.exact_short_instruction
              ? { ...emptyField(liveEvidence), value: captured.content.exact_short_instruction.value,
                  availability: captured.content.exact_short_instruction.availability, origin: 'source_observation' }
              : emptyField(screenEvidence),
            modelOrScaffold: emptyField(screenEvidence), answerSpec: emptyField(screenEvidence),
            feedback: emptyField(screenEvidence),
            submission: captured?.response_behaviour.submission_trigger
              ? { ...field(captured.response_behaviour.submission_trigger.value, 'source_observation', liveEvidence) }
              : { value: null, availability: 'unknown', origin: 'unknown', evidence: screenEvidence },
            evidence: [...screenEvidence, ...liveEvidence],
            // Preserve additive observations and baseline unknowns separately; neither is executable content.
            baselineAudit: baselineAudit ? {
              promptAndScaffold: baselineAudit.prompt_and_scaffold,
              modelsAndExamples: baselineAudit.models_explanations_and_examples,
              answerConfiguration: baselineAudit.answer_configuration,
              supportTiming: baselineAudit.support_timing, responseMechanics: baselineAudit.response_mechanics,
              feedback: baselineAudit.feedback, audio: baselineAudit.audio,
              visualAssets: baselineAudit.visual_assets, readiness: baselineAudit.readiness,
            } : null,
            liveObservation: captured ? {
              content: captured.content, answer_configuration: captured.answer_configuration,
              support_visibility: captured.support_visibility, response_behaviour: captured.response_behaviour,
              media: captured.media, unresolved: captured.unresolved, readiness_delta: captured.readiness_delta,
            } : null,
          };
        }),
      };
    }),
  };
  const flat = inventory.levels.flatMap(l => l.chapters.flatMap(c => c.entries));
  const totals = inventory.levels.map(l => l.chapters.flatMap(c => c.entries).length);
  if (JSON.stringify(totals) !== '[249,208,174,73]' || flat.length !== 704 || new Set(flat.map(e => e.id)).size !== 704) throw new Error('Invalid course totals or identities');
  if (lessons.records.flatMap(r => r.screens).length !== 1117) throw new Error('Invalid B2 screen total');
  const sourceIndex = { version, sources,
    originalSources: manifest.source_audit.filter(s => new Set(['S12', ...records.records.flatMap(r => (r.architecture.screen_records ?? []).map(s => s.source_reference?.source_id))]).has(s.source_id))
      .map(s => ({ sourceId: s.source_id, packagedPath: s.packaged_path, sourceHash: s.sha256 })),
    screenshotManifest: { imageCount: images.images.length, sourceHash: sources.at(-1).sourceHash, courseAssets: false },
  };
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const [filename, value] of Object.entries({ 'inventory.json': inventory, 'b2-structure.json': lessons, 'source-index.json': sourceIndex })) {
    fs.writeFileSync(path.join(outputRoot, filename), `${JSON.stringify(value)}\n`);
  }
  return { entries: flat.length, chapters: inventory.levels.reduce((n, l) => n + l.chapters.length, 0), levels: totals, b2ScreenRows: 1117 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [referenceRoot, planningRoot, outputRoot = path.resolve(import.meta.dirname, '../content/busuu')] = process.argv.slice(2);
  if (!referenceRoot || !planningRoot) throw new Error('Usage: node scripts/import-busuu-reference.mjs <reference-root> <planning-root> [output-root]');
  console.log(importReference(referenceRoot, planningRoot, outputRoot));
}
