# L02–L03 production validation

4 October 2026, Australia/Sydney. Scope stops at L02/L03. These are owner-authorized, reviewed production packs, not the earlier complete test fixtures.

| Lesson | Current pack | Screens / graded | Launch and completion |
|---|---|---|---|
| B2.C01.L02 | 1.1.0, b2-c01-l02.v2.json | 9 / 7 | Playable with account-owned saved progress |
| B2.C01.L03 | 1.1.0, b2-c01-l03.v2.json | 10 / 6 | Playable with account-owned saved progress |
| B2.C01.L01 | Retained 1.0.0 | 6 / 5 | Existing playable/save path and fingerprint unchanged |

The central registry selects the new packs by default and resolves old versions exactly. Previous L02/L03 1.0.0 previews retain their fingerprints and cannot start saved attempts. New packs retain every sourceContract, canonical occurrence and evidence reference from their previews; missing source wording remains a source-only unknown, not a runtime readiness gap. New pack hashes and deterministic reproduction are recorded in [provenance.json](provenance.json).

## Content and linguistic review

All literal production copy is identified as app-authored in internal provenance, based on retained targets and purpose paraphrases. L02 teaches respectful どちら／いらっしゃる versus humble self 参る, matching the actor to the predicate. Stem gaps combine exactly with supplied ました endings. Formal sentence-choice distractors distinguish respectful, humble and casual register; hotel listening supplies a formal welcome context. L03 reinforces に興味がある, 歴史／伝統／文化／自然, desire and relative clauses, then a polite information request in an ordered hotel dialogue. Similar-sound alternatives are disambiguated by required audio. Readings, translations and corrected sentences were reviewed alongside banks and scaffolds.

The final L03 request reconstructs **日本の文化に興味があります。おすすめの博物館を教えてください。**, exactly matching the guest-2 dialogue turn and its audio. The staff’s respectful question and guest’s humble arrival reuse L02 consistently. Japanese hotel dialogue remains hidden while English support is visible; ordered TTS uses the existing full-playback gate. Transcript-free listening has no script/translation in pre-answer markup and supplies both after answering.

Independent review found one issue: the nature-model translation had been placed in after-answer support, which ungraded models cannot reach. A failing rendered-markup test reproduced it; authoring now puts English in visible model support. The unchanged source translation flag remains null and provenance identifies this as an app choice. The reviewer rechecked the correction and reported no remaining material blocker. Shared lesson-launch text also now uses neutral readiness wording instead of claiming all packs were reviewed against screenshots.

## Focused verification

| Check | Result / evidence |
|---|---|
| All web tests, including new production path and affected regressions | **112 passed**, 0 failed/skipped: [tests.log](tests.log) |
| Production build and TypeScript | **Passed**: [build.log](build.log) |
| Lint | **0 errors / 12 existing warnings**: [lint.log](lint.log) |
| Content audit / offline reproduction | Both new packs reproduce byte-for-byte; retained files unchanged by assembly; no unresolved runtime fields or synthetic fixture content: [provenance.json](provenance.json) |
| Independent content/implementation review | Japanese, readings, actor/register, distractors, dialogue reuse and compatibility reviewed; reported translation issue fixed and rechecked |

The five production tests use the **actual registered packs**, hand-reviewed responses, readiness, rendering, runner, server start/save/evaluator, client save controller and map-progress functions. They cover correct completion (7/7 and 6/6), wrong distractor feedback, mandatory audio guards, partial matching/token persistence, removal/reinsertion, feedback/result reopening, failed-save recovery, restart retaining its predecessor, per-lesson progress (two unique completions → 33% chapter completion), hidden listening support, exact dialogue reuse and all three retained fingerprints. Route/launch regressions confirm L01–L03 expose saved practice without a missing-content preview or source-copy claim.

Only the remote database transport is replaced in the new integration test. It does **not** claim fresh PostgreSQL, live authentication, TTS synthesis or browser end-to-end evidence. Existing ownership/transaction/idempotency and UI/audio baselines remain [61 expansion PostgreSQL assertions and browser/adapter checks](../expansion-validation/README.md) plus [42 L01 PostgreSQL assertions and authenticated saves](../persistence-validation/README.md). No database/schema/event/ownership behavior changed, so those broader harnesses and unchanged browser walkthroughs were not repeated. Lint was rerun once after removing a newly reported unused authoring constant; that cleanup changed no runtime pack bytes.

## Reproduce and limits

From apps/web: `node --test lib/*.test.mjs`, `npm run lint`, `npm run build`, and `node content/busuu/production-validation/provenance.mjs`. The audit generates into a task-specific temporary directory and compares actual production files. Authoring is reproducible with `node scripts/assemble-busuu-l02-l03-production.mjs [output-directory]` and does not need the external reference corpus.

No material content or grading blocker remains for L02/L03. Original images/video remain deferred and optional speaking/free writing are outside scope. Hosted deployment has not been performed; the new production build must be deployed to make these changes available on the hosted app. No new live database write or Busuu capture was performed.

The current reusable implementation/content policy is at the top of [the implementation README](../README.md). Continue only with the bounded [L04, L05 seven core screens and 14-task checkpoint handoff](../../../../../planning/2026-10-03-busuu-integration/L02-L03-Implementation-and-Next-Handoff.md).
