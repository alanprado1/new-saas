# Japanese course code and reference map

Resolve paths against the attached Japanese Saas project. The intended app root contains `apps/web/`; a chat may start in that directory instead. Locate the root before using the paths below. This map records observed locations; if a module moves, inspect its current callers and update the map rather than rebuilding it.

## Working boundaries

| Need | Existing location |
| --- | --- |
| Current status and validation pointers | `apps/web/content/busuu/README.md` (latest section first) |
| Versioned runtime lesson packs | `apps/web/content/busuu/` |
| Pack version lookup and structural alignment | `apps/web/lib/busuu/content-registry.ts` |
| Course inventory and lesson lookup | `apps/web/lib/busuu/inventory.ts` |
| Content/readiness and renderer contracts | `apps/web/lib/busuu/{types,content-readiness,readiness}.ts` |
| Shared screen presentation and support | `apps/web/components/busuu/LessonScreen.tsx` |
| Shared sentence/chunk ordering | `LessonScreen.tsx` renderer `ordering`; `types.ts` answer `ordered_tokens`; `runner.ts` existing token/remove events |
| Required-core/optional-writing partition | Schema 1.1 pack `completion`; `content-registry.ts` alignment; `content-readiness.ts` contract checks; `components/busuu/OptionalProduction.tsx` |
| Separate checkpoint pass reporting | `runner.ts` `getPassOutcome`; pack `passPolicy` (never gates saved core completion) |
| Shared shell, audio and save orchestration | `apps/web/components/busuu/LessonRunner.tsx` |
| Shared visual rules | `apps/web/app/busuu/{runner,busuu}.module.css` |
| Transitions, grading and support timing | `apps/web/lib/busuu/runner.ts` |
| Existing Japanese TTS adapter | `apps/web/lib/busuu/audio.ts`; existing `/api/tts` and `/api/voices` routes |
| Validated server replay and saved state | `apps/web/lib/busuu/{attempt,attempt-server}.ts` |
| Retryable account-owned saves/outboxes | `apps/web/lib/busuu/attempt-client.ts` |
| Saved map progress | `apps/web/lib/busuu/progress.ts`; `components/busuu/SavedCourseMap.tsx` |
| Relevant tests and Node TypeScript loading | `apps/web/lib/busuu-*.test.mjs`, `busuu-test-helpers.mjs`, `test-loader.mjs` |
| Isolated database validation when needed | `apps/web/content/busuu/persistence-validation/database.mjs`; expansion validation has separate additional cases |
| Local no-login course walkthrough (dev only, in-memory saves) | `apps/web/content/busuu/b2-polish/README.md`; `lib/busuu/local-walkthrough.ts`; `.claude/launch.json` `busuu-walkthrough` |
| Ordering/optional-contract regression and registered saves | `lib/busuu-chapter-one.test.mjs`; `content/busuu/chapter-one-validation/database.mjs` (actual API/client/evaluator + isolated PostgreSQL) |
| Kanji stroke animation | `components/busuu/KanjiAnimation.tsx`, `lib/busuu/kanji-{animation.ts,playback-sync.ts}`, vendored `lib/kanji-animator/`, data `public/kanji/` (AnimCJK brush, course kanji only), sync `scripts/sync-kanji-animator.mjs` (source `C:/Users/alans/Documents/Kanji Animator New`), test `lib/busuu-kanji-animation.test.mjs` |

Presentation changes belong in the shared screen/shell/styles, lesson values in packs, and transition/grading changes in the engine. Existing service-side evaluation derives results from validated events and versioned content, not a submitted client score. Preserve that boundary.

## Focused checks

Run commands from `apps/web` using its existing Node runtime:

```powershell
node --test lib/busuu-readiness.test.mjs lib/busuu-runner.test.mjs lib/busuu-expansion.test.mjs
```

Select only the existing files relevant to the actual change; inspect test names when content-status expectations need updating. Use `busuu-test-helpers.mjs` to load the real readiness/registry/evaluator modules for pack checks rather than implementing a second validator. Content correctness still needs linguistic review; a passing structural validator alone cannot establish it.

When a full web regression is required, collect the current files once:

```powershell
$courseTests = @(Get-ChildItem -LiteralPath lib -Filter '*.test.mjs' | ForEach-Object { $_.FullName })
node --test @courseTests
```

Use the package's current lint/build scripts for required final checks. Do not install another test framework or change module settings solely for existing harmless warnings.

For new ordering or optional completion semantics, select the focused chapter-one tests and database harness. Reuse established persistence/ownership tests for unchanged transports/schema. `chapter-one-validation/provenance.mjs` checks deterministic assembly and all five retained pack fingerprints. `chapter-one-validation/ui.mjs` produces static real-component snapshots for brief visual inspection; it is not a live authenticated/TTS walkthrough.

Current owner policy excludes all course speaking/pronunciation actions. Listening/TTS remains. Optional free writing is separate, ungraded, and never needed for chapter completion. Preserve historical source speaking evidence without exposing it as an enabled action.

## Local curriculum references

Start with runtime `b2-structure.json` and the assigned packs. The complete reference package is currently at:

`C:/Users/alans/Documents/Codex/2026-10-03/read-c-users-alans-documents-codex/outputs/`

Use the relevant records in `Unified-B2-Lesson-Records.json`, concept/UI catalogs and master reference. Detailed source files under `Evidence/` are conditional references, not mandatory full-context inputs. These research paths are authoring references and must not become production runtime dependencies.

Planning/evidence lives under `planning/2026-10-03-busuu-integration/`. Where old records report unknown literal content, keep their historical provenance while supplying authorized reviewed app-authored content. Do not rewrite raw evidence to represent new content as source observation.

The project has an unusual separate `git/.git` arrangement; do not restore apparent deleted indexed app paths, move app files or repair Git incidentally. The current task determines implementation, migration and deployment scope.

## Checked-input and teaching capability routing

- Typed normalization/limits/IME key policy: `apps/web/lib/busuu/typed-input.ts`. Specs are `types.ts` (`typed`, `kanji`, `truthMode`, `fixedPrefix`); shared readiness is `content-readiness.ts`.
- Typed input presentation/IME lifecycle: `LessonScreen.tsx` exported `TypedAnswer`; draft/Check replay in `runner.ts` and exact event shapes in `attempt.ts`. Existing `attempt-client.ts` outbox and `attempt-server.ts` evaluate/save them unchanged. Optional draft field exists only after entering a typed screen; no database migration or old event/result shape change.
- Runtime optional projection: `content-registry.ts` `getRuntimeCompletionMetadata`, applied by `inventory.ts`; raw structural evidence remains read-only. Source exercise alignment is conditional for older packs lacking the field.
- Shared contract/component regressions: `lib/busuu-chapter-two.test.mjs`; independent production responses: `lib/busuu-chapter-two-responses.mjs`. Do not replace independent expected response data with runtime answer-key enumeration.
- Registered pack saves and typed/clear/offline/multi-activity/ownership/old-state database regression: `content/busuu/chapter-two-validation/database.mjs`. It runs actual API/client/evaluator against isolated PostgreSQL, never the live project. Deterministic assembly/fingerprints: sibling `provenance.mjs`; brief static real-component UI inspection: sibling `ui.mjs`.
- Offline pack authoring inputs: `scripts/assemble-busuu-chapter-two.mjs` and `scripts/busuu-chapter-two-occurrences.json`. Assembly reads retained runtime structure and local occurrence metadata; no external research path becomes a runtime dependency.

## Dialogue, context and retry routing

- Configurable service labels/context/translation visibility and turn readings: `types.ts`, `components/busuu/LessonScreen.tsx` exported `Dialogue`, `LessonRunner.tsx` ordered TTS. Defaults preserve released hotel English support and guest/staff audio IDs.
- Versioned cross-lesson scene resolution/fact-answer binding: `lib/busuu/scene-context.ts`. Registry installs its exact-version resolver and validates every reference; readiness explicitly imports the registry for fresh server/browser startup. Scene facts bind an existing Japanese turn excerpt. Keep this dependency graph free of registry-to-readiness imports.
- Standalone prior-context access: `LessonLaunch.tsx` accessible scene review before Start/resume, outside counted screens. Delayed `sceneContext` questions exclude source support/hints/player/replay throughout the question; `sceneReuse` retains earlier same-lesson supported dialogue behavior.
- Opted-in listening end retry: `runner.ts` conditional state `retry`, immutable first `outcomes`, `getCurrentOutcome`, and conditional result `retry` report. Existing response events replay through unchanged server/client transport. `content-readiness.ts` restricts `end_once` to unique transcript-free audio truth/choice occurrences. Completion follows one retry pass independent of correctness; base progress/counts exclude retries. Activity-boundary or token retries need a separately validated contract extension.
- Focused components/context/retry and actual pack alignment: `lib/busuu-scene-context.test.mjs`, `busuu-retry.test.mjs`, `busuu-chapter-three.test.mjs`. Independent reviewed responses: `busuu-chapter-three-responses.mjs`.
- Registered API/client/evaluator saves, retry offline/resume/right/wrong outcomes, typed suffixes, multi-activity boundaries, physical tokens and ownership: `content/busuu/chapter-three-validation/database.mjs` (isolated PostgreSQL only). `provenance.mjs` verifies deterministic assembly and all 16 prior registered versions. `ui.mjs` generates brief real-component changed UI inspection; it does not claim authenticated/TTS playback.
- Chapter 3 offline authoring: `scripts/assemble-busuu-chapter-three.mjs` and `scripts/busuu-chapter-three-occurrences.json`. Retained raw evidence and prior pack bytes remain unchanged.

## Multiple selection and activity-boundary retry routing

- `types.ts` configured `multi_choice` answer/renderer, `runner.ts` conditional `selectedOptionIds` and `toggle_option`/`selection_check`, `attempt.ts` exact action-shape validation, `LessonScreen.tsx` native pressed buttons/editable selection and explicit Check. Grading is an exact set with no partial credit; source response count is `requiredCount`, not click count or base-surface count.
- `runner.ts` configured `after_activity_once`, active retry `returnIndex`, completed conditional `retryOutcomes`, immutable `outcomes`, unique `visited` and separate retry result. `content-readiness.ts` permits validated gap/chunk token tasks only in the explicit boundary extension. Existing `end_once` remains listening-only. `LessonRunner.tsx` reports boundary progress without adding counted tasks; `LessonScreen.tsx` uses current retry outcome for ordering feedback.
- Supported `sceneReuse`: `LessonRunner.tsx` resolves the bound dialogue and plays every turn through the existing `CourseAudioAdapter.playDialogue`, gated on sequence completion. Replay scene is distinct from current-screen corrected-sentence replay. Delayed `sceneContext` still excludes all player/replay surfaces.
- Focused new regressions: `lib/busuu-chapter-four-mechanics.test.mjs` (editable/malformed exact-set events, repeated physical gap retry/removal, multiple/final activity boundaries, old end behavior, component replay/color handlers), `busuu-chapter-four.test.mjs` and independent `busuu-chapter-four-responses.mjs` (all 114 actual occurrences).
- Actual six-pack saved path and new-action/state/offline/reload/restart/account-isolation regression: `content/busuu/chapter-four-validation/database.mjs` uses isolated PostgreSQL and the real client/API/evaluator. It also checks all 23 prior versions; unchanged typed/transport/TTS baselines are reused from prior chapters. Deterministic pack assembly/fingerprints: sibling `provenance.mjs`; brief actual-component local UI: sibling `ui.mjs`.
- Offline chapter 4 authoring: `scripts/assemble-busuu-chapter-four.mjs`, `scripts/busuu-chapter-four-occurrences.json`. Preserve raw structural projections and released pack bytes. English support for reading-column tables is authored explicitly.

## Summary-only structure and lexical gloss routing

- `lib/busuu/structural-contract.ts` validates the opt-in app-owned `summary_authored` contract. `content-registry.ts` keeps observed alignment strict and validates nullable source fields, retained total, canonical authored activities/tasks and physical app counts. `readiness.ts` preserves raw observed row counts and conditionally adds `authoredScreenRows`; `LessonLaunch.tsx` labels the authored sequence accurately. No raw `b2-structure.json` rewrite or event/state/schema change. Versioned pack fingerprints include the new contract only for opting-in packs.
- `types.ts` dialogue `glosses`, `scene-context.ts` term binding/readiness and `LessonScreen.tsx` explicit vocabulary list keep limited English lexical help separate from the dialogue translation layer. All-turn TTS and scene replay are unchanged.
- Focused contract/gloss regressions: `lib/busuu-summary-contract.test.mjs`. Chapter content, transcript-free token-bank, final-boundary retry and equivalent-answer regressions: `busuu-chapter-five.test.mjs`; independent responses: `busuu-chapter-five-responses.mjs`.
- Six actual registered saved paths and summary-contract/account/old-version checks: `content/busuu/chapter-five-validation/database.mjs` (isolated PostgreSQL only). `provenance.mjs` checks deterministic assembly and 29 prior versions; `ui.mjs` renders changed real components for brief browser inspection. Existing transport/typed/scene audio baseline is reused.
- Offline chapter authoring: `scripts/assemble-busuu-chapter-five.mjs` and `scripts/busuu-chapter-five-occurrences.json`. Raw evidence remains intact. The summary contract now also checks every retained activity ID/ordinal/source-ID list/known count when retained task arrays are empty. Chapter 6 proves the 11+8 saved path without recovering individual source rows.

## Occurrence support and retained summary partitions

- `types.ts` optional `audio.beforeAnswer`; `LessonRunner.tsx` control and actual playback handler enforce documented no-source-replay occurrences while preserving corrected feedback and released defaults. `content-readiness.ts` rejects required-but-disabled playback. Hidden Japanese support and legitimate Japanese response options/readings are different layers.
- `sourceContract.feedbackTranscript: 'omitted'` binds cue-only truth feedback to recorded transcript omission; complete source replay is excluded. `transcriptAccess: 'scene_recap'` validates a complete earlier visible dialogue; `LessonRunner.tsx` exported `SceneRecap` supplies closed optional Japanese support, separate from ordered all-turn TTS.
- English-only cultural tables use `allowsEnglishOnlyTeaching` in readiness and visible support. Observed tails `production_choice` and exact alias `production_choice_v1` join `community_production` in the optional-writing projection; raw rows remain unchanged. No generic suffix normalization is permitted.
- Focused regressions: `busuu-summary-contract.test.mjs`, `busuu-occurrence-support.test.mjs`, `busuu-chapter-six.test.mjs` and independent `busuu-chapter-six-*-responses.mjs`. `chapter-six-validation/database.mjs` exercises all seven real registered saves plus summary offline/activity-boundary/restart/malformed-registration and unique map paths in isolated PostgreSQL. `provenance.mjs` verifies all 35 released fingerprints and deterministic seven-pack assembly; `ui.mjs` supplies a brief real-component browser inspection.
- Central offline assembly: `scripts/assemble-busuu-chapter-six.mjs`, with separate taste/emphasis/rail assemblers and local occurrence maps. No external reference directory is a runtime dependency.

## Parallel source-reading permission and content-only save verification

- Pre-answer Japanese `support.before` blocks must omit `secondary` when retained `parallel_kana_available` is false. The shared `Support` renderer displays supplied secondary text directly; metadata alone does not hide it. Preserve explicit lexical table/kanji teaching readings and choice-option readings.
- Chapter 7 focused coverage: `lib/busuu-chapter-seven.test.mjs`, independent `busuu-chapter-seven-*-responses.mjs`; deterministic assembly and 42 prior fingerprints: `content/busuu/chapter-seven-validation/provenance.mjs`. `saved-path.mjs` verifies all six actual registered client/API/evaluator save/reload paths and both final-boundary retry outcomes with disposable memory storage, reusing existing database/RLS baselines because no contract changed. `ui.mjs` supplies brief actual-component inspection.
- Offline authoring: `scripts/assemble-busuu-chapter-seven.mjs` and the creation/recommendation/wondering assemblers and occurrence maps. Runtime dependencies never include the external research directory.

## Exact optional renderer alias routing

- The shared optional-tail predicate in content-registry.ts recognizes only the existing community_production / production_choice names and the separately evidenced production_choice_v1 alias. Keep raw identities; do not normalize arbitrary suffixes or introduce lesson-ID exceptions.
- Alias/alignment/optional exclusion, exact-set selection and retry continuation regressions: apps/web/lib/busuu-chapter-nine.test.mjs. Registered saved paths and unique accounting: apps/web/content/busuu/chapter-nine-validation/saved-path.mjs. Established database/transport baselines remain the source of unchanged RLS/ownership coverage.


## Structured-media and single-speaker routing

- C10 offline assembly: `scripts/busuu-chapter-ten-authoring.mjs` deliberately resolves string/object media kinds, explicit scene control prose and exact occurrence support. `busuu-chapter-ten-occurrences.json` retains assigned target/prior/feedback indexing; all raw exports remain read-only.
- Nullable cue-only feedback: `lib/busuu/feedback-evidence.ts`; opt-in type in `types.ts`, readiness in `content-readiness.ts`, exact retained quote/reference binding in `content-registry.ts`. Focused null/false/true, forgery, decorated-script/reading and strict audio-only regressions: `lib/busuu-feedback-evidence.test.mjs`.
- One observed speaker: `dialogue.kind: single_speaker`, `sourceContract.recordedSpeakerCount: 1`; `scene-context.ts` validates, registry aligns retained count, `LessonRunner.tsx` captions and `LessonScreen.tsx` labels it. `lib/busuu-single-speaker.test.mjs` verifies strict legacy defaults, ordered actual-handler TTS/staff voice and accessibility labels.
- Final-chapter answers and source/count/support/retry regressions: `lib/busuu-chapter-ten.test.mjs` and separate literal `busuu-chapter-ten-*-responses.mjs`. All ten real registered save/reload paths, paired and individual two-target boundary outcomes, optional-event exclusion and unique map accounting: `content/busuu/chapter-ten-validation/saved-path.mjs`, using disposable storage and established database baselines. `provenance.mjs` preserves all 65 prior versions, raw originals and 73-entry B2 accounting. The consolidated B2 handoff is `planning/2026-10-03-busuu-integration/B2-Complete-Consolidated-Handoff.md`.

## Text-only content versions (B2 learner-text polish, 8 October 2026)

- Pattern for a learner-text sweep that must keep saved attempts valid: build the NEXT version of every changed pack from an immutable baseline, never edit a registered file. `apps/web/content/busuu/b2-polish/registered-fingerprints.mjs` records (and verifies) bytes and `coursePack(...).hash` of every registered version; `pack-text-transform.mjs` derives each record's newest baseline version, applies mechanical rules (Australian spelling, curly apostrophes, praise string, prompt wording, reading spacing) plus hand edits from `pack-text-rewrites.mjs`, bumps the minor version, and writes the next `.vN.json`. `--check` proves deterministic regeneration; `pack-text-changes.md/.json` list every old to new string.
- `content-registry.ts` registers polished versions after all earlier ones (second loop), so `getContentPack(id)` returns the new version and `getContentPack(id, '1.0.0')` still returns the old one. Saved attempts, the playback-compat fixture test and production tests must resolve the EXACT recorded version; tests that asserted a pack was `1.0.0` now accept the released or text-polished version.
- Invariance proof: `pack-text-checks.mjs` `checkInvariance` diffs every leaf against the predecessor and fails on anything but whitelisted learner-text paths (Japanese support text, tokens, option IDs/order, answers, audio, source contracts, evidence, counts and retry policy cannot change). TTS-only readings (`audio.reading`, dialogue turn `reading`) are deliberately not edited. Wording guard (engine terms, Australian spelling, run-together readings) runs on every current pack in `lib/busuu-pack-text-polish.test.mjs`. `pack-text-saved-path.mjs` completes a sample (current and previous versions) through the real registered API/client/evaluator with the disposable memory adapter; chapter 7-10 `saved-path.mjs` scripts also pass unchanged against the polished versions.
- Scan convention (owner decision 2026-10-08): `consistency-scan.mjs` now treats Australian English as the standard and run-together readings as the reading convention. `consistency-scan.before.json` is the pre-polish output of the earlier scan rules.
