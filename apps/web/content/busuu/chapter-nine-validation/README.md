# Chapter 9 validation

6 October 2026, Australia/Sydney. All nine B2.C09.L01–L08 and B2.C09.CP entries are registered, reviewed and playable with the existing account-owned save/reload path. Version 1.0.0; 65 registered versions overall. Owner progress was not seeded.

| Entry | Required partition | Optional | Physical responses | Count provenance |
| --- | ---: | ---: | ---: | --- |
| L01 | 9+8 | — | 18 | Retained lesson structure |
| L02 | 9+10 | — | 28 | Retained lesson structure |
| L03 | 10+10 | — | 27 | Retained lesson structure |
| L04 | 10+7 | — | 26 | Retained lesson structure |
| L05 | 8+8 | — | 16 | Retained lesson structure |
| L06 | 10+9 | — | 27 | Retained lesson structure |
| L07 | 7 | A01.S08 | 12 | Retained lesson structure |
| L08 | 12+8 | — | 19 | Retained lesson structure |
| CP | 20, one app-authored activity | — | 40 | Independently specified app-authored assessment |
| Total | 155 required | One private writing endpoint | 173 retained + 40 app-authored = 213 | No observed checkpoint physical total is claimed |

The eight lessons retain all 136 documented rows, including the optional endpoint, source exercise numbers, actual suffixed renderer identities, activity/source-screen identities, response counts and analytical dependencies. Raw runtime evidence remains unchanged. CP retains zero source screens and zero source activities; unknown screen/activity/exercise/renderer identities and source response counts remain null. Its `summary_authored` contract separately declares 20 tasks, a one-activity partition and the app physical vector `[1,1,1,4,1,1,1,2,3,2,1,1,5,5,3,1,1,3,2,1]`, totaling 40. Readiness reports zero observed rows and twenty authored tasks. Explicit `passPolicy: { kind: 'none' }` remains separate from completion/accuracy; no thresholds, unlocks or CP retries are inferred.

The shared production predicate adds only exact `production_choice_v1`; undocumented suffixes and non-tail production fail closed. L07 writing is local, private, ungraded and emits no attempt events. No renderer, grading event, transport, database schema or saved-state shape was introduced. Old-attempt compatibility: all 56 prior JSON bytes and saved-attempt fingerprints remain exact; old optional aliases retain their existing behavior. The new alias only projects an evidenced content partition using the established schema 1.1 contract.

Only three `after_activity_once` targets are configured:

| Target | Base position / boundary | Source retry counter | Continuation |
| --- | ---: | ---: | --- |
| L01 A02.S08 | Lesson 17 / after 17 | 9, separate from base 8 | Results after either retry outcome |
| L02 A01.S05 | Lesson 5 / after 9 | 10, separate from base 5 | Resume A02.S01 after either outcome |
| L06 A02.S09 | Lesson 19 / after 19 | 10, separate from base 9 | Results after either retry outcome |

Fresh listening, unchanged option order, separate retry outcomes, immutable first outcomes/accuracy and unique base counts are covered for correct and wrong retries. Successful source retry observations are distinguished from the app's verified either-outcome completion policy.

## Review and focused checks

Independent whole-chapter content and contract reviews checked Japanese/readings/translations, humble staff/customer direction, borrowing/lending/custody, ます stems, conventional お電話／ご案内, payment/change arithmetic, decision agency, static kanji, typed affixes, distractors and equivalent answers. Three answer-set regressions were observed failing and fixed: L01 welcome/request adverb order, L02 fronted luggage object and L07 equivalent food/drink noun order. Unique token identities prevent physical token reuse. Learner feedback excludes internal provenance; source typo corrections and script acceptance decisions remain in internal pack provenance.

L02 A01.S08 is one exact-set task with exactly three selections from six. Selection editing/Check, wrong sets and order independence are covered. L06 A02.S05 follows S50's explicit text-only/no-player commentary rather than its broad structured audio label. The daily-special context is coherently established in the same lesson, with no invented cross-lesson binding. Transcript-free tasks withhold complete source/translation/answer order from pre-answer markup while legitimate response banks remain visible. Cue-only feedback preserves short evidence-backed explanations without complete corrected-source replay. Source support readings and lexical/kanji/response readings remain separate.

## Results and reproduction

Run from `apps/web` with the existing Node runtime:

```powershell
node --test lib/busuu-chapter-nine.test.mjs
node content/busuu/chapter-nine-validation/provenance.mjs
node content/busuu/chapter-nine-validation/saved-path.mjs
$taskCourseTests = @(Get-ChildItem -LiteralPath lib -Filter '*.test.mjs' | ForEach-Object { $_.FullName })
node --test @taskCourseTests
npm run lint
npm run build
node content/busuu/chapter-nine-validation/ui.mjs
```

- **217/217 web tests passed**, including twelve chapter 9 tests. [Full output](tests.log).
- **1,244 real registered API/client/evaluator saved-path assertions passed**: all nine completion/reload paths, both outcomes of all three retries, L02 continuation, optional event rejection with unchanged saved state, and nine unique completed map entries /100% chapter completion despite imperfect first accuracy. [Saved-path record](saved-path.json).
- Deterministic nine-pack regeneration, all 56 previous file bytes/fingerprints, raw structure/inventory/source index and strict source alignment passed. [Preservation record](provenance.json), [baseline](prior-fingerprints.json).
- Production build and TypeScript passed. [Build output](build.log).
- Lint: zero errors, twelve existing warnings. Four new unused authoring/test bindings were removed and lint was rechecked; no behavior, generated pack, or runtime build changed. [Lint output](lint.log).
- Brief browser inspection of actual shared components covered the reservation dialogue, exact selection, static kanji, contextual payment table, text-only typed retrieval, private optional writing and CP ordering. Default viewport/content width both 1265px, with no horizontal overflow. [Inspection artifact](ui.html). This is static real-component evidence, not authenticated/live TTS or original-media playback evidence.

Disposable memory RPC storage substitutes only the established database adapter while using the real registered client/API/server evaluator. This proves the new content's saved paths, not fresh PostgreSQL/RLS coverage. Established isolated PostgreSQL, account isolation, transport, typed/IME and TTS baselines are reused because those contracts did not change. No live database changes, deployment, new source capture, microphone, recording or speech grading occurred.

Whole next batch: [Chapter 10 handoff](../../../../../planning/2026-10-03-busuu-integration/Chapter-9-Complete-and-Chapter-10-Handoff.md). No chapter 10 implementation is included.
