# L02–L03 implementation validation

Validated 4 October 2026, Australia/Sydney. Scope stops at L02/L03. No new Busuu capture, general research, original media acquisition, deployment or live database writes were performed.

## What is available

| Lesson | Runtime status | Base sequence | Scored completion |
|---|---|---|---|
| B2.C01.L01 | Existing reviewed pack, unchanged | 6 screens | Existing server-graded saves/resume/restart remain available |
| B2.C01.L02 | Version 1.0.0 development preview | One activity, 9 screens | Blocked by missing required content |
| B2.C01.L03 | Version 1.0.0 development preview | One activity, 10 screens | Blocked by missing required content |

Open the existing course routes and select **Open development preview**. The previews preserve canonical IDs and source order. Exact instruction text remains unresolved; recorded purpose labels are explicitly identified as paraphrases. Response placeholders and missing-field disclosures are app-authored. Audio stays disabled when its actual Japanese script is unavailable. Preview skips are explicit, produce no accuracy score, and never create a saved attempt or map completion.

L02 retains respectful origin-question targets, its ungraded actor/register table, two-pair matching, the hint before the verb-gap response, two interrogative/verb slots, transcript-free social-setting inference and final humble/self retrieval. L03 retains interest/history/nature models, supported comprehension, lexical gaps, transcript-free interest inference, the guest/staff hotel dialogue and two-gap scene reuse. History-model English and parallel kana/kanji support are documented by S18 even though the unified flags were null; both are enforced, while the original raw flags remain in `recordedSupport`.

The dialogue renderer accepts ordered identified guest/staff Japanese turns and the documented English support. The shared audio adapter synthesizes each turn through existing Edge/VoiceVox options, respects speed and caching, waits for each turn to finish, and retires callbacks on stop, exit, screen/account change or failure. Edge uses the selected guest voice and Keita for staff; VoiceVox uses the saved voice for both identified roles. This replacement and its full-sequence Continue gate are app mechanics. Original video is a replaceable slot. No turn order or dialogue text was invented in the runtime pack.

Scene reuse resolves to an existing earlier dialogue in the same lesson, identifies its context in the UI and does not add an unobserved replay/support entry. Teaching models/table/dialogue are ungraded; complete L02/L03 structures would have seven/six scored practice screens respectively. Feedback, replay and results never add base rows.

## Remaining fields

[evidence-audit.json](evidence-audit.json) lists the retained textual search inventory, packaged images, input digests and **every explicit field-level gap**. [provenance.json](provenance.json) verifies deterministic pack regeneration, 76 source references and unchanged L01 bytes. The audit records input snapshots as searched before implementation notes were updated.

| Occurrence | Required missing content |
|---|---|
| L02 S01 | Exact respectful question model, translation, instruction and audio script |
| L02 S02/S05/S07/S09 | Exact Japanese scaffolds/gap boundaries, ordered banks, mappings, correction/translation/explanation and scripts; S05 also exact hint copy |
| L02 S03 | Exact actor/register explanation, caption, rows/examples/readings and audio script |
| L02 S04 | Both actor and predicate endpoints, their order/mappings, prompt and feedback |
| L02 S06/S08 | Complete visible options/order, accepted mapping, prompt and feedback; S08 also actual hidden listening script |
| L03 S01/S03/S06 | Exact interest/history/nature examples, permitted support and scripts; S03 also documented parallel reading and translation |
| L03 S02/S05/S07/S10 | Exact scaffolds, banks/order, mappings, feedback and scripts; S10's cumulative content remains bound to S09 |
| L03 S04 | Exact supported Japanese source, judgment statement, accepted truth and feedback/script |
| L03 S08 | Complete category options/mapping, prompt, hidden listening script and post-answer support |
| L03 S09 | Complete ordered Japanese guest/staff turns, actual English dialogue support and instruction |

There are 55 explicit L02 gap records and 58 L03 records; computed readiness also validates configuration and required support. Selected target forms and pedagogical paraphrases are retained information, not complete exercise copy. Hidden accepted variants, option identities/shuffling, source scoring and wrong-answer policies remain unknown. Original images/video are deferred separately and do not block a text-complete pack. Speaking/pronunciation and free writing are optional and not substitutes for core teaching.

## Verification evidence

| Check | Result | Evidence |
|---|---|---|
| All web tests | 106 passed, no failed/skipped | [tests.log](tests.log) |
| Lint | 0 errors, 12 existing warnings | [lint.log](lint.log) |
| Production build and TypeScript | Passed | [build.log](build.log) |
| Expansion persistence against isolated PostgreSQL | 61 assertions passed | [database.log](database.log), [database.mjs](database.mjs) |
| Original L01 PostgreSQL regression | 42 assertions passed | [l01-database-regression.log](l01-database-regression.log) |
| Deterministic regeneration and source digests | Passed; 76 pack references verified; L01 unchanged | [provenance.json](provenance.json), [provenance.mjs](provenance.mjs) |
| Browser preview sequence/layout inspection | Both sequences finished with no score; desktop/narrow inspected | [browser-layout.json](browser-layout.json), screenshots below |

Complete lesson testing uses **synthetic text/answers in test-only fixtures**. Those fixtures exercise actual server evaluation, transactional PostgreSQL functions and the client outbox/controller; they are never imported by runtime code. Tests include partial matching endpoints and token slots, failed saves and replay of retained requests, feedback/result refresh, per-lesson attempts/fingerprints, invalid foreign screen actions, content-version/hash rejection, restart isolation, duplicate-free chapter completion and runtime-preview write guards. Two completed fixture entries produce 33% chapter completion, independently of 100% fixture accuracy. Existing L01 database tests additionally verify wrong responses, database reopen, concurrent writes, client privileges/RLS and unchanged Study/SRS data.

Audio tests use controlled endpoint/player boundaries to verify real adapter ordering, TTS parameters, cancellation, failures and stale callbacks. **No live hotel-scene playback or source-faithful scored L02/L03 completion is claimed**, because its scripts and answers are absent. Existing source lessons and learner attempts are retained. The hosted build was not deployed.

Independent review identified missing guards for S03 support and scene-reference resolution; both were reproduced with failing tests and fixed. A separate dialogue test found a stale ended/error callback could affect the next turn; player-identity guards now prevent it. The reviewer rechecked the fixes and found no remaining important issue.

## Browser/layout record

The pre-existing localhost:3000 process failed to load its lesson page. A fresh production build on localhost:3001 loaded with the existing authenticated browser session; authentication code was unchanged. Both development sequences were traversed using explicit preview skips. Screen counts/results stayed 9/9 and 10/10, with no learner score/completion. Hidden listening screens had no Japanese support nodes or title attributes; synthetic renderer tests separately ensure stored hidden scripts/readings/translations cannot appear in markup before answering.

Returning to the chapter map preserved the existing L01 saved completion/80% accuracy and 17% chapter progress. L02/L03 had no completion badges after either preview. See [map state](course-map-after-previews.txt) and [map screenshot](course-map-after-previews.png).

At 1280 × 720 CSS pixels, runner width was 512px and document scroll width 1265px. At 375 × 812, table/dialogue runner width was 328px and scroll width 360px, accounting for the scrollbar; result width remained within 375px. There was no horizontal overflow. Content scrolls vertically, and navigation/preview controls remain accessible. Temporary viewport overrides were reset. Screenshot export scaling/full-page stitching is not used to infer CSS dimensions.

- [Desktop L02 table](l02-desktop-table.png)
- [Narrow L02 table](l02-narrow-table.png)
- [Narrow L02 pre-answer hint](l02-narrow-hint.png)
- [Narrow L02 preview result](l02-narrow-result.png)
- [Desktop L03 dialogue slot](l03-desktop-dialogue.png)
- [Narrow L03 dialogue slot](l03-narrow-dialogue.png)
- [Narrow L03 scene reuse](l03-narrow-scene-reuse.png)
- [Narrow L03 preview result](l03-narrow-result.png)

## Reproduce

From `apps/web`, run `node --test lib/*.test.mjs`, `npm run lint`, `npm run build`, `node content/busuu/expansion-validation/database.mjs` and `node content/busuu/persistence-validation/database.mjs`. Isolated SQL tests reuse the already-pinned validation PGlite runtime; neither connects to Supabase. To rebuild and audit packs, pass the retained outputs directory to `node scripts/assemble-busuu-l02-l03.mjs <reference-root>` and `node content/busuu/expansion-validation/provenance.mjs <reference-root>`. No original evidence file is changed.
