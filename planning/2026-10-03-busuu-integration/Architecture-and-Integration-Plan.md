# Busuu Reference Integration Implementation Plan

> **For future implementation:** use `superpowers:executing-plans` task by task after the owner authorizes implementation. This assignment delivers inspection and planning only; it does not authorize executing this plan.

**Goal:** add a navbar-accessible Japanese course experience closely matching the documented Busuu desktop flow, preserving course order, learning targets, activity sequences, support timing, response behaviour and feedback, with small colour changes and optional speaking/pronunciation and free writing.

**Architecture:** add an isolated `/busuu` course module alongside the existing scene library, Study and Chat. Import evidence into a versioned course model; keep executable lesson content separate from structural research. A shared activity runner consumes occurrence-specific interaction, support, feedback and media configurations rather than converting every lesson to flashcards.

**Tech stack inspected:** Next.js 16.2.10, React 19.2.3, TypeScript, Tailwind 4, Zod 4, Supabase clients, Howler and browser audio; existing Node test runner. Versions are declarations in the attached project, not recommendations to upgrade.

**Spec:** the owner's request and the eight primary files in `C:/Users/alans/Documents/Codex/2026-10-03/read-c-users-alans-documents-codex/outputs/`. Start with the master, gaps and validation report. Detailed authorities: Unified-Course-Inventory, Unified-B2-Lesson-Records, Curriculum-Concept-Catalog, Busuu-UI-Interaction-Catalog and Source-Manifest. Companion deliverables: [readiness audit](B2-Chapter-1-Content-and-Asset-Readiness.json) and [next handoff](Next-Implementation-Handoff.md).

Saved 3 October 2026, Australia/Sydney. All paths below are relative to `C:/Users/alans/Documents/Japanese Saas/` unless explicitly absolute.

## Global constraints

- Preserve the documented A1 → A2 → B1 → B2 hierarchy and within-level chapter/card order. A1–B1 map objectives are often paraphrases, not exact Busuu titles.
- Speaking/pronunciation and free writing remain optional; constrained answer selection, matching and ordering remain core. A fluency card can contain new instruction before its optional production endpoint.
- Preserve app code, app data and reference files for this assignment. Only the three analysis files in this separate planning folder are deliverables. No dependency installation, database changes, live Busuu capture or content generation was performed.
- Keep source observations (O), map/summary information (M), interpretations (I), proposed choices (P), and unknowns (U) distinguishable. O here means the saved research reports an observation, not that this inspection replayed Busuu.
- Null means unknown unless explicitly marked inapplicable. Missing prompts, answers, explanations, transcripts and assets must remain missing; authored replacements must never be called identical to Busuu.
- Historical redesign/microtopic proposals in Evidence/ are superseded by the current owner goal. Source IDs in Source-Manifest and sample IDs in the blueprint are different namespaces: blueprint sample S06 is the humble lesson, while manifest S06 is a B1 result image.

## Review focus

1. Hidden transcripts/readings must stay hidden on transcript-free listening tasks, including accessible text, tooltips and recap links.
2. A late save or media response must not affect another signed-in user, another attempt or the next screen.
3. Repeated identical kana tiles must retain separate token identities and source order; matching pairs and response slots are not base-screen counts.
4. Missing audio/video/answer keys must block executable readiness and must not grant completion through mock audio or a placeholder.
5. Optional production and the lesson-5 checkpoint dependency must not silently inflate chapter completion or remove documented checkpoint questions.

Tests pinning these conditions belong to Tasks 2, 3, 4 and 5 below.

## Inspection evidence and limits

Inspected the actual `apps/web`, `apps/worker` and `supabase/migrations` files, navigation and lesson routes, scene/Study components, type definitions, study actions/caches, TTS routes and worker, public assets and all 14 existing `*.test.mjs` files. No applicable AGENTS.md was found in the workspace/ancestor locations searched.

The workspace root is not a Git checkout. `git/.git` is a repository whose indexed paths assume `apps/` and `supabase/` live under the `git/` directory; those files actually live next to it. Its status therefore reports deleted indexed files. Recent metadata commits are `37a963d Better`, `bb52bce better loading`, and `7bbb75b Delete start.png`. This inspection made no Git configuration, index or layout changes. Before implementation, establish the intended working-tree root; do not interpret these apparent deletions as an instruction to restore/overwrite the attached files.

Reference inspection covered the master overview/shared flow and B2 chapter 1, complete gaps and validation reports, structured inventory/records/catalogs/manifest, and packaged chapter-1 structural evidence. All 59 packaged input sources match the manifest SHA-256 values. The six primary outputs with manifest digests are checked again in the readiness audit. The validation report's 259 checks concern consolidation integrity; they do not certify exact content, Japanese correctness or live behaviour.

All 14 packaged screenshots were inspected in a contact sheet; S19 navigation was also inspected at full resolution. Eleven show results, three show limited timeline regions. They corroborate white desktop/result surfaces, timeline circles/connector/selection and hierarchy, not chapter-1 exercise geometry or reusable media. Their saved dimensions are 1210×686; browser zoom/device scaling were not established. No running app UI, live database rows or remote Storage objects were inspected. Runtime visual appearance, deployed schema completeness, cloud asset contents and provider availability remain unverified.

**Baseline verification:** all 47 tests across the 14 existing web test files passed with the bundled Node runtime on 3 October 2026. Command from `apps/web`: `$tests = @(Get-ChildItem -LiteralPath lib -Filter '*.test.mjs' | ForEach-Object { $_.FullName }); node --test @tests`. Node emitted module-type warnings; no failures/skips. No build/lint was run: this assignment changes no app code, and a build could rewrite generated files. Worker `test` is a placeholder that intentionally fails; it is not a test suite.

## Reuse, extend and missing capabilities

| Area | Existing evidence | Integration decision (P) |
|---|---|---|
| Navigation | `apps/web/app/page.tsx` has inline home/library navbar with language selection, Chat `/voicechat`, Study `/study`, generation/settings/account controls. Root layout has providers, not a shared navbar. Scene route has its own Library exit; Study has its own header. | Add a `Busuu` link to `/busuu`; create a course-specific header with return to Library. Keep initial change local to the home navbar rather than refactoring every existing header. Japanese course ignores a stored English-learning direction for its content. |
| Auth | `proxy.ts` protects private pages/APIs; `utils/supabase/{server,client,middleware}.ts` and `lib/supabase.ts` provide current clients/session handling. | Reuse route protection and server client; authenticate every progress action. Course routes inherit protection without making them public. |
| Content | `lib/lesson.ts` loads UUID lessons/lesson_lines. `ScenePlayer.StructuredContent` contains title, background tag, vocabulary and grammar points; generate route adds 4–28 dialogue lines. Levels are Beginner/Intermediate/Advanced. | Introduce CEFR course IDs independently. Do not insert course records into generated-lesson UUID tables or equate JLPT/scene levels with A1–B2. |
| Lesson display | `components/ScenePlayer.tsx` is a roughly 3,100-line scene/transcript/vocabulary player with Howler playback states, furigana/segmentation, cast voices and realtime background/voice updates. It has no answer-bank quiz engine. | Reuse small reading/audio utilities and lifecycle patterns. Build a focused runner, not a conditional course mode inside ScenePlayer. The hotel video is a video surface, not the existing sprite scene with a different background. |
| Study | `StudyCard.tsx` reveals vocabulary/examples and accepts Again/Hard/Good/Easy ratings; Study uses N5–N1-style decks and daily due cards. | Keep self-rated SRS separate. Do not treat Good as a correct Busuu answer, or use Study scheduling as course progression. Later an explicit bridge can add learned course words to Study with distinct IDs/provenance. |
| Progress | `app/actions/study.ts` reads vocabulary and `user_card_progress`, computes SM-2 and verifies upsert; `StudyCacheProvider` isolates users/days/directions and broadcasts changes. `lib/study.ts` additionally contains a jlpt_items/user_reviews path. Scene COMPLETED is playback-local, not assessed mastery. | Reuse ownership, failed-save handling and cache-invalidation patterns; new course-attempt/event/progress tables. Do not reuse SRS rows, generated lesson status, or source research scores as learner course progress. |
| Media/TTS | `/api/tts` authenticates, returns base64, supports VoiceVox/Edge and Kokoro branching with reading transforms. Worker generates line audio in bucket `audio`, with retries/recovery/provider-specific logic; Japanese default VoiceVox, English default Google in worker code. README's Groq/Kokoro description is partly stale. | Reuse Japanese TTS utilities only for approved text, with explicit synthesized origin. Fixed lesson assets should be prepared/versioned before playback, not generated by the story API. Source voices/video/captions cannot be recovered by TTS. |
| Audio/cache | `word-audio-session.ts` deduplicates/prioritizes/aborts clips. Its route-retention rule only retains `/` and matching `/lesson/:id`; `/busuu` would clear it. `WordAudioCacheBoundary` runs globally. Study audio trims silence and closes listeners. | Use a separate course media session/cache, keyed by asset revision/provider/voice/reading. Do not broaden scene-cache path semantics casually. Clean up on screen/route/account change. Keep authored clip speed/normalisation configurable; automatic trimming is not source timing evidence. |
| Styling | Existing app is dark/anime/glass with global dark backgrounds and theme gradients. `useTheme` writes a root gradient; root PWA theme colour is dark. Source shell is white, focused and roomy. | Route-scoped white course canvas and dedicated neutral/feedback tokens. Use existing accent preference only as a small accent change, not the whole dark layout. Palette values remain P until reviewed; geometry should be measured before a close-match claim. |
| Assets | Public files: ramen-shop background, two JPEG character sprites, test.mp3, framework SVGs, Kuromoji JS/dictionary. No course seeds, hotel video, B2 answer keys or chapter thumbnails found. | Keep unrelated assets available to their existing feature. None is a verified replacement for chapter-1 source assets. Kuromoji can assist segmentation, not certify readings or fill answer banks. |
| Tests | 47 passing tests cover study persistence/failure/account switch, cache races, local dates, TTS annotations, segmentation, voices and audio cleanup. No course navigation/lesson/checkpoint/visual tests found; jsdom is installed locally but not declared in package.json. | Extend Node+existing loader conventions for pure logic/component checks. Declare any newly needed test dependency in a later implementation task. Add genuine browser/visual checks for interactions that jsdom cannot establish. |

The checked-in migrations are incremental, not a complete initial Japanese database schema. `user_card_progress` creation is documented in a study action comment; baseline lessons/lesson_lines/vocabulary tables are assumed. Inspect actual schema read-only before designing the implementation migration. No database schema or Storage claim here is based on live access.

## Architecture alternatives and chosen direction

**Recommended (P): a separate course module with shared utilities.** It preserves the existing flows while giving ordered activities, source-aware support, answer validation and assessment their own model. Small navbar integration and a route-scoped visual shell are the principal existing-UI changes.

**Alternative: extend ScenePlayer.** This shares existing playback UI quickly but its dialogue-centric data and global transcript/vocabulary controls would leak support and create a large branch-heavy player. Not recommended for close mechanics fidelity.

**Alternative: rebuild the entire app around the course.** It could unify navigation/styles but would discard useful current flows and widen the first milestone. Not recommended for this bounded integration.

## Proposed file boundaries and interfaces

These paths and APIs are proposed changes, not files/functions that already exist.

| File(s) | Responsibility |
|---|---|
| Modify `apps/web/app/page.tsx` | Add navbar entry with active/focus states, accessible link and `/busuu` destination. |
| Create `apps/web/app/busuu/layout.tsx`, `busuu.module.css`, `page.tsx` | Course shell, white full-viewport background, local tokens and redirect/default selector. No global theme mutation. |
| Create `apps/web/app/busuu/[level]/page.tsx` | Validate A1/A2/B1/B2, render ordered timeline and restore course selection. |
| Create `apps/web/app/busuu/[level]/lesson/[recordId]/page.tsx` | Validate record belongs to level, show launch/unavailable state or mount runner when ready. Checkpoints use the same route but assessment launch/result configuration. |
| Create `apps/web/components/busuu/{CourseHeader,LevelSelector,ChapterTimeline,LessonLaunch,LessonShell,LessonRunner,FeedbackPanel,LessonResult,JapaneseText,MediaPlayer}.tsx` | Presentation and interaction boundaries; JapaneseText renders explicitly provided layers; MediaPlayer owns playback cleanup. |
| Create `apps/web/components/busuu/renderers/{Model,ExplanationTable,Choice,ClozeChoice,PairMatching,Ordering,SceneVideo}.tsx` | Nine milestone families using variants: Choice handles MC/TF, Ordering sentence/kana. No monolithic per-lesson switch. |
| Create `apps/web/lib/busuu/{types,schema,inventory,readiness,runner,grading,support,assessment,media,progress-cache}.ts` | Versioned contracts, evidence import, readiness guard, pure transitions/answer evaluation, support visibility, assessment policy, assets and separate user cache. |
| Create `apps/web/content/busuu/{inventory,source-index,ui-families,concept-index}.json`, `b2/chapter-01.structure.json`, `b2/chapter-01.content.json` | Minimal reviewed runtime projections of reference data; structural import separate from absent executable content. Include input SHA-256/JSON locators; avoid shipping the 6.7 MB research bundle/raw history to clients. |
| Create `apps/web/scripts/import-busuu-reference.mjs` | Explicit local-source import/validation; runtime uses repository data, not an absolute Documents path. Does not mutate reference. |
| Create `apps/web/app/actions/busuu.ts` | Authenticated start/save/finish/load progress with idempotent event IDs and version checks. |
| Future Supabase migration under `supabase/migrations/` | New course persistence only, created with the supported migration workflow after schema inspection. No filename or live SQL executed in this plan. |
| Create `apps/web/lib/busuu/*.test.mjs`; later browser specs `apps/web/tests/busuu/` | Structural, state/answer/support, assessment/persistence and desktop verification. |

No changes to `ScenePlayer`, `StudyCard`, story generation, worker, or existing study data are necessary for the first navigation/structure increment. Media utility extraction should occur only when the runner needs it and with regression tests; avoid unrelated cleanup.

### Data contracts (P)

- `EvidenceRef = {sourceId, packagedPath, jsonPointerOrHeading, classification: O|M|I|P|U, sourceHash}`. Preserve raw renderer/source exercise/activity IDs and canonical IDs together.
- `ContentField<T> = {value: T|null, availability: available|partial|missing|unknown|inapplicable, origin: source_observation|map_paraphrase|app_authored|test_fixture|unknown, evidence: EvidenceRef[]}`. A learning target is not an executable sentence or answer key.
- `CourseInventory = {version, courseId, levels: CourseLevel[]}`; level contains ordered chapters; chapter contains cards and assessments with `afterCardOrder`. Entry contains exact `sourceLabel` when known, separate `mappedObjective`, entry type, evidence depth and readiness. Never sort lexically or by capture chronology.
- `LessonSpec = {recordId, contentVersion, sourceRefs, activities: ActivitySpec[], curriculumRefs, launch, result, assessmentPolicyId|null, readiness}`. Activity contains ordinal, source activity ID, base screen count, and ordered `ScreenSpec[]`. Source gaps are not invented screens.
- `ScreenSpec = {screenId, baseOrdinal, sourceExerciseNumber, rendererId, rawRenderer, purpose, prompt, models, explanation, responseSlots, answerSpec, feedback, supportPolicy, mediaRefs, submission, variant}`. Response count carries documented/unavailable/inapplicable state. `answerSpec` is a discriminated choice, truth, ordered_slots, pairs or ordered_tokens specification with stable token/option IDs and accepted alternatives evidenced separately.
- `SupportPolicy` contains independent `beforeAnswer`, `afterAnswer`, `feedback`, `recap` Japanese/English/kana/kanji/hint availability. Preserve raw nullable support and separately attributed narrative supplements. No universal transcript or reading toggle.
- `SubmissionPolicy = immediate_choice|last_placement|last_correct_pair|explicit_check|continue_ungraded|unknown`, with evidence and configuration origin. The catalog's detailed C9/C10 triggers are I when applied to C1; capture/validate before marking a C1 occurrence observed-identical.
- `MediaAsset = {assetId, revision, kind, location|null, availability, origin, checksum|null, JapaneseText, readings, speakers, segments, captions, supportTiming, editorialStatus}`. Speaker model family may be video/illustration plus audio; `audio_model_v1` does not prove audio-only.
- `RunnerState = {attemptId, recordId, version, activityOrdinal, screenId, phase: launch|presenting|answering|feedback|saving|result|exited, response, evaluation, completedBaseIds, retryQueue, mediaState}`. Feedback/retries/results/recovery are events, not extra base IDs.
- `AttemptEvent = {eventId, attemptId, sequence, screenId|null, kind, response|null, correctness|null, supportUsed, countedAsBase:false, contentVersion}`. Responses never contain a client-authoritative score. Production participation is separately declined/unsubmitted/submitted/unknown.

Pure boundaries: `getLevelInventory(level: CourseLevelId): CourseLevel`; `getLessonReadiness(spec: LessonSpec): ReadinessReport`; `reduceRunner(state: RunnerState, event: RunnerEvent, spec: LessonSpec): RunnerState`; `evaluateResponse(spec: ScreenSpec, response: Response): Evaluation`; `getVisibleSupport(spec: ScreenSpec, phase: RunnerState['phase']): VisibleSupport`; `summarizeAttempt(events: AttemptEvent[], spec: LessonSpec, policy: AssessmentPolicy): AttemptSummary`.

Persistence boundaries: `startCourseAttempt(recordId, contentVersion, mode: start|restart): Promise<AttemptSnapshot>`; `saveCourseEvent(event: AttemptEvent): Promise<PersistedEventAck>`; `finishCourseAttempt(attemptId): Promise<AttemptSummary>`; `getCourseProgress(): Promise<CourseProgressSnapshot>`. Server derives user ID; rejects another user's attempt, stale content version, invalid sequence and duplicate conflicting event; recomputes evaluation from approved content. Duplicate identical event returns the same acknowledgement. UI retains response/feedback on a failed save, offers retry, and does not show saved completion until acknowledged.

### Persistence and policy (P, source uncertainties retained)

Use static/versioned course content plus `course_attempts` (user, record, version, mode, lifecycle/cursor), `course_attempt_events` (attempt, unique event ID, sequence, screen, response/support/evaluation), and `course_entry_progress` (user+record+version, completed activities, assessment summary and optional participation). RLS ties every read/write to the authenticated owner's attempt; progress finalisation should be atomic and server-evaluated. Store exact score numerator/denominator and policy version. Keep finished attempts immutable; restart creates a new attempt.

Provisional personal-app policies: equal weighting of first graded base-screen responses, rounded display percentage, checkpoint pass at raw accuracy strictly greater than 80%, no end replay for this chapter-1 checkpoint, and no automatic locking inferred from prerequisite concepts. These are P, not a recovered Busuu formula. Do not compare the rounded display score to threshold. Store a separate source evidence field for 86% research score; never initialise the owner's progress from it. Lessons can reach 100% completion with accuracy recorded separately. No lesson retry rule is asserted where C1 observations do not establish one.

Partial-progress persistence/resume is an app choice: retain an acknowledged screen cursor and offer resume/restart; do not claim identical Busuu recovery. Lesson-5 reload observations do not establish a universal rule. Optional production is disabled by default for this personal app; when later implemented, declining the endpoint is recorded separately. Chapter totals report core completed and production declined rather than granting a speaking/writing proficiency claim. Later actual capture may replace provisional policies through a new version without rewriting source evidence.

## First milestone: all-level navigation + B2 chapter 1 L1–4 and checkpoint

All-level navigation must contain **81 chapters, 623 teaching/review cards, 78 checkpoints and 3 visible certificate entries = 704 entries**, with level totals A1 249, A2 208, B1 174, B2 73. Unknown lesson content remains visibly unavailable. Do not add a B2 certificate merely for symmetry; A2 certificate internals behind Premium are unknown. Free/premium restrictions are source context, not payment mechanics needed in a personal app.

| Entry | Targets and exact structural scope | Order/fidelity criteria |
|---|---|---|
| B2.C01.L01 — Introducing yourself in a humble way | 1 activity × 6 surfaces; 申す, 参る, 私 reading/register, polite-past reuse | Model with kana/kanji/English → Japanese-supported T/F → three-register matching (3 pairs) → humble-coming stem gap (1, suffix supplied; form explanation in feedback) → reformulation choice → combined name/origin gaps (2). Do not move inference feedback into pre-task instruction. |
| B2.C01.L02 — Asking a question respectfully | 1 × 9; どちら, いらっしゃる, humble-self/respectful-other discrimination | Model → interrogative gap (1) → actor/register table with audio → matching (2 pairs) → verb gap (1, pre-answer hint) → reformulation → interrogative/verb gaps (2) → transcript-free social-setting inference → humble-self gap (1). |
| B2.C01.L03 — Talking about your interests | 1 × 10; culture/history/nature interests; に興味がある, desires/relative-clause/request reuse | Interest model → similar-sound lexical gap → history model (kana/kanji/English/audio in S18 narrative) → supported T/F → two lexical gaps → nature/desire model → context gap → transcript-free interest choice → longer hotel guest/staff video with English dialogue visible → two-gap scene reuse. |
| B2.C01.L04 — Listing things | 1 × 10; とか/や and optional particle omission, 特に/例えば | Casual-list model (parallel script) → とか gap → register/omission table → supported formality T/F → travel-list chunk order → emphasis model → emphasis gap/cultural feedback → example-marker model → transcript-free listening → two adverb-stem gaps. Do not extend this lesson to action lists. |
| B2.C01.CP — Checkpoint | 1 × 14; consolidates L1–5, including fluency cultural content | Preserve all 14 listed tasks in the JSON order. CP S05/S07/S13 hide Japanese transcript before response; CP S14 has Japanese support. S09 has 4 kana placements (two とか), S11 5 chunks, S12 two order-sensitive words with corrected red-slot miss feedback. Immediate feedback persists; no end-of-sequence replay observed. Result score 86% is a research attempt, not a runtime answer key. |

**Total: 35 teaching surfaces + 14 checkpoint tasks = 49 base surfaces, five activities.** Nine renderer families: model, explanation table, MC, T/F, selectable cloze, pair matching, sentence ordering, character ordering and scene video. Launch/feedback/result/exit are additional states, not counted surfaces.

**Lesson-5 dependency:** the timeline must retain L05 between L04 and CP; the CP is after card 5, not moved immediately after card 4. L05 has eight documented surfaces, including a sake-vessel cultural/audio table, then optional Speak/Write. CP S09 explicitly supplies vessel context in its prompt, but the checkpoint broadly consolidates L1–5. Keep the requested implementation scope at L1–4+CP; mark L05 unavailable until separately implemented. The CP can be a preview/standalone assessment once its content is ready, with a visible prerequisite note; it must not assert that the app has taught all chapter content. Do not delete or rewrite CP tasks to hide this gap. Completing a fully taught chapter requires a later L05 core-teaching increment (production can remain declined). No undocumented bridge lesson is inserted in this milestone.

## Content and asset readiness

The accompanying JSON audits **every one of the 49 milestone screens**, with another eight L05 screens explicitly marked dependency-only. Each screen lists retained purpose/targets, slot/response facts, raw support, narrative supplements, answer/feedback configuration, required media, missing exact fields, provenance and readiness. The JSON also inventories each of the 704 navigation entries and their unresolved thumbnail/label availability.

**Available (O/M/I):** all course positions; recorded B2 navigation labels; 49 ordered screen rows/partitions; targets and selected forms; documented pair/gap/token counts where known; support visibility for specific occurrences; feedback functions/categories; one hotel scene's roles and English-support timing; CP's local no-replay outcome, misses/correction and result observations. These are structural requirements, not full lessons.

**Missing for executable fidelity:** complete Japanese/English prompts, model/example sentences, explanations/table rows, exact scaffolds/option banks/distractors, correct answers/accepted alternatives, feedback copy and full readings/translations, source clips/illustrations/portraits/thumbnails, hotel video, dialogue/caption files and synchronisation. Some detailed slot counts and submit/removal/wrong-match mechanics are unknown. Even a T/F task lacks its full statement/truth evidence. There is no ready-to-run source content pack for any of the five target entries.

**Existing project availability:** the known public JPEGs/test MP3 are present but unrelated/unverified for these screens. Generated scene content and audio may exist in cloud tables/Storage, but no local exported corpus or canonical course links were found. Cloud contents were not enumerated; mark them `uninspected_remote`, not absent. A coincidentally matching vocabulary word does not provide a source-identical sentence, actor/register context or distractor bank. TTS is a capability, not already available audio.

**Release guard:** navigation/structure can be delivered immediately in a later authorised task. A complete playable close-content milestone requires supplied/captured usable content, approved media or an explicitly accepted adaptation. Original authoring remains possible only as a separately labelled future choice. Do not substitute generated story content, use arbitrary test.mp3, or display a missing-media task as assessed.

## Specific remaining desktop evidence

| Capture | Exact evidence needed | What it resolves |
|---|---|---|
| Level selector and B2 C1 timeline | Full viewport at fixed zoom/device scale; selector open/closed, chapter heading, selected/available/completed L1–5, CP, launch/restart panel; card portraits and course percentage | Column width, heading hierarchy, circles/connector/selection, launch location and states; earlier screenshots only show C3/C10 regions. |
| L1 S01 and S03–S06 | Model layers; 3-pair states before/after one match/last match; wrong pair if safely observable; one/two-gap selection, correct/incorrect feedback and Continue | Model modality, matched-column movement, trigger timing, disabled states, supplied suffix and feedback placement. |
| L2 S03/S05/S08 | Audio table, hint before response, listening without transcript then corrected source/English/replay | Narrative support vs nullable row reconciliation; hint contents/penalty; audio support reveal timing. |
| L3 S03/S06/S09/S10 | Reading layers; full hotel player controls, dialogue/captions before/after playback, recap if present; next task source access | Missing model media details, video geometry, caption timing, two-speaker script and cross-screen dependency. |
| L4 S03/S05/S07/S09 | Table rows, token bank/count, incomplete/final placement, removal/reordering, cultural/formality feedback and hidden listening support | Unknown chunk count and selection affordances; whether catalog triggers apply to C1. |
| CP S01/S09/S11/S12/S13 | Correct/incorrect and partially filled states; repeated identical kana tile identity/consumption; exact corrected words/order; praise/correction/translation/replay | Grading/configuration, per-slot error treatment and feedback timing. |
| Launch/result/exit | Completed and new-card launch, settled result not intermediate animation, stars/learned items, Continue, quit confirmation; reload/return if scoped | Close match for shell/result, preserved selection and actual resume. Exactly-80% and repeat/shuffle are separate later probes, not implied by a 14-task CP capture. |

For each capture record viewport CSS dimensions, zoom, device pixel ratio, font family/weight/size/line height, measured column/panel/control dimensions, spacing, borders/radii, colours, sticky footer behaviour, scroll and time-stamped transition/feedback observations. Record keyboard/focus/disabled behaviour and one screen-change audio cancellation. Small palette changes need explicit token values; all unmeasured values remain P. Do not infer source autoplay, back controls, keyboard shortcuts, progress weights or transitions from a static image. No wider Review/Community/subscription cloning is needed for this Learn milestone.

Capture observations and usable asset acquisition are different work: an image/control in a screenshot is evidence, not a playable licensed asset. Existing research deliberately retained paraphrases rather than proprietary corpora/media; do not treat that historical capture policy as owner authorisation to invent missing content. The next evidence pass should return an explicit availability record for material it cannot retain.

## Implementation milestones and checkable tasks

### Task 1 — all-level course navigation and structural import (M1a)

**Files:** home navbar; proposed course routes/header/selector/timeline; `types/schema/inventory/readiness`; importer and minimal content projections; `inventory.test.mjs`, `readiness.test.mjs`.

**Consumes:** inventory/source manifest and target B2 rows. **Produces:** `getLevelInventory`, `getLessonReadiness`, full ordered navigation and unavailable entry views. No learner-data migration or scored lesson launch.

- [ ] Write import tests: exact level totals 249/208/174/73, 81 chapters/704 entries; all canonical IDs unique; CP after L05; no B2 certificate; unknown label stays separate from objective.
- [ ] Run new tests and confirm failure before adding module.
- [ ] Import with source digests/pointers; preserve 6/9/10/10/14 target partitions and nullable facts. Build `/busuu` navbar/selector/timeline routes. Keep launch blocked while readiness fails and return to chosen chapter/card.
- [ ] Test invalid levels/record mismatch, all four level selection routes, L05 staying in place, zero initial progress, and unavailable courses never redirecting to an unrelated generated scene.
- [ ] Verify new tests plus existing 47 tests, lint and build in the later implementation checkout. Desktop review against available navigation evidence; label unmeasured styling P.

**Deliverable:** inspectable complete course map and trustworthy structural model; not a claim of playable Busuu content.

### Task 2 — occurrence support and media contracts (M1b, content/evidence-dependent)

**Files:** `support/media/schema/readiness`; JapaneseText, MediaPlayer, course styles; reviewed chapter-01.content and asset manifest; support/media/readiness tests.

**Consumes:** structural model and new content/evidence provenance. **Produces:** `getVisibleSupport`, `MediaAsset` bindings, exact missing-field reports.

- [ ] Test L1 S01 visible kana/kanji/English; L2 S05 narrative hint before response; L2/L3/L4 S08/S08/S09 and CP S05/S07/S13 hide Japanese before answer; L3 S09 shows English dialogue; null remains unknown.
- [ ] Implement support resolution using explicit occurrence evidence supplements; do not turn every empty `media` array into no-audio evidence (L2 table and L3 history audio are documented in S18 prose).
- [ ] Register supplied assets/transcripts with revision/checksum/origin and screen links. Test late playback completion after route/screen change, loading/failure/retry and no placeholder-completion fallback.
- [ ] Populate content only from accepted material; validate complete prompt/model/scaffold/answers/feedback/media requirements for each renderer. Tests assert missing answer key or required audio/video prevents executable readiness.
- [ ] Compare model/table/video snapshots and timings to new evidence. Leave any unresolved source mechanics explicitly unknown or configured P.

**Deliverable:** source-aware support/media layer and reviewed content readiness. This task cannot manufacture the current missing corpus.

### Task 3 — shared activity runner and all nine milestone families (M1c)

**Files:** runner/grading; LessonLaunch/Shell/Runner/Feedback/Result and seven renderer files; runner/grading/component tests; future desktop browser checks.

**Consumes:** ready LessonSpec from Tasks 1–2. **Produces:** `reduceRunner`, `evaluateResponse`, renderer response events and unpersisted attempt summary.

- [ ] Test exact 6/9/10/10/14 base traversal; feedback/replay/Continue/result never inflate base counts; three/two pair matching; one/two-slot cloze; four distinct kana tokens and five CP sentence chunks.
- [ ] Implement explicit ungraded Continue and per-occurrence graded transitions. Capture-confirmed immediate/final-placement rules govern C1; provisional catalog-derived triggers carry P/I provenance. Answered controls stay disabled until next/retry state. Do not add explicit Check to selectable banks to simplify implementation.
- [ ] Test CP S12 wrong source order corrects the same two slots; S13 miss reveals only permitted feedback; no CP retry is queued; original response/feedback remain visible until Continue.
- [ ] Implement one runner across records/activities without hardcoded universal phase order. State transitions support later multi-activity lessons and local retry policies, while unused renderer families remain deferred.
- [ ] Test missing content cannot launch, double clicks cannot grade/advance twice, IME/focus/readings are usable, and audio from the old screen cannot finish/advance a new screen. Use authored fixtures only as labelled engine tests, never production source content.

**Deliverable:** L1–4+CP playable only when accepted content/assets and occurrence mechanics pass readiness and visual checks.

### Task 4 — authenticated course progress and assessment (M1d)

**Files:** actions/busuu, assessment/progress-cache, migration for the three proposed tables, persistence/assessment tests, isolated database checks.

**Consumes:** runner events/approved answer specs and current read-only schema inventory. **Produces:** the four persistence APIs defined above and timeline/result progress.

- [ ] Test unauthenticated/foreign-attempt rejection, duplicate event acknowledgement, conflicting duplicate rejection, failed saves retaining response, stale-version rejection and a switched account/late save never receiving another learner's progress.
- [ ] Create schema/policies in an isolated implementation environment using current Supabase docs; do not migrate existing SRS rows. Verify ownership/RLS and finalisation transaction, then generate a migration through the supported workflow.
- [ ] Implement progress actions/server evaluation, attempts distinct from base screens, user+version cache and invalidation on account change. Resume only acknowledged cursors; completed restart creates a new attempt.
- [ ] Test accuracy and completion separate; provisional >80 policy on raw 79.99/80/80.01 and rounded-display edge; CP misses complete without end replay; research 86% and source 100% progress are never seeded as learner scores.
- [ ] Test unavailable L05 persists as unavailable; CP has prerequisite note and does not claim full taught chapter; optional participation doesn't produce speaking/writing mastery. Production endpoints themselves remain outside M1 scope.

**Deliverable:** real learner attempts/progress and explicitly versioned assessment policy. Exact Busuu score/unlock formula remains U until captured.

### Task 5 — desktop fidelity and milestone acceptance (M1e)

**Files:** course styles/component refinements; browser specs/snapshots and separate evidence records. No broader app restyle.

- [ ] At evidence-matched desktop viewport/zoom, compare selector/timeline, launch, every family, incomplete/answered feedback, media, result and exit. Record all palette deviations separately from geometry/mechanics deviations.
- [ ] Verify all 49 target IDs in order, explicit support timing, no transcript leaks in visible/accessible UI, correct source dependencies, audio cleanup and result return to source chapter.
- [ ] Verify keyboard/focus, viewport clipping/scroll/footer, browser Back/reload, account changes/save failure and missing media/keys. Re-run existing regression tests once after final changes; broaden only for a discovered concern.
- [ ] Acceptance requires approved content/readiness for all target screens, complete evidence-linked mechanics for claimed matches, passing course and existing tests, lint/build, and a visual deviation report. If assets/content remain missing, release only the validated map/engine preview, named accordingly.

**Later M2:** implement L05's seven core teaching/practice surfaces plus optional endpoint, then remaining B2 chapters in documented order. Retain the four summary-only records and their 77 missing rows until captured; do not generate rows to fit counts. Add typed cloze, multi-select, kanji, inline segment and passage/segmented listening/recap variants only when a later chapter needs them.

**Later M3:** earlier-level internals/content and kana architecture, using the same ordered model and support/media system. All-level navigation is not all-level lesson completeness. Concept catalog mappings support search/review dependencies; two unresolved aliases remain unresolved and inferred prerequisite edges do not enforce locks.

## Decision ledger

| Source observations (O/M) | Unresolved facts (U) | Proposed implementation choice (P) |
|---|---|---|
| Timeline and five activity partitions/order documented | Earlier exact labels, C1 thumbnail/geometry/full content | Import all map entries; unavailable launch with honest labels |
| Supported and transcript-free tasks coexist; explanations can teach in feedback | Many row fields null despite richer narrative; full feedback text | Preserve raw fields, add attributed supplements; occurrence support policy |
| CP 14 tasks, two recorded misses, immediate correction, 86%, no final replay | Weighting/rounding, exactly 80%, repeated option/task order | First-response screen accuracy, strict raw >80 versioned provisional policy |
| CP accessible with fluency production unsubmitted | Universal locks and chapter aggregate policy | Keep course order; availability separate from locking; explicit core/production status |
| L05 introduces cultural content used by CP | Full vessel table/words/media, learner familiarity | Retain dependency note and CP content; no invented bridge/reordered tasks |
| Family mappings/catalog triggers exist | C1-specific removal/wrong-match/submit timings, top icons, resume | Capture before close-match claim; labelled provisional configuration only |
| White focused shell and limited results/navigation screenshots | Exact fonts/metrics/colour/timing | Scoped light layout, small accent changes; measure/review before visual acceptance |

Stop boundary: this file is a plan. The next handoff is evidence capture, not implementation. Existing app/reference bytes are verified unchanged in the companion audit.
