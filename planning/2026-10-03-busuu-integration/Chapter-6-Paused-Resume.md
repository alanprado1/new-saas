# Chapter 6 historical pause checkpoint — resumed and completed

**Superseded:** work resumed at the owner’s request and chapter 6 is complete. All fixes and validation listed below have finished. Use [Chapter-6-Complete-and-Chapter-7-Handoff.md](Chapter-6-Complete-and-Chapter-7-Handoff.md) and the [final validation record](../../apps/web/content/busuu/chapter-six-validation/README.md) for current status. This document retains the earlier pause state for history; it is not a pending-work list.

Paused at the owner’s explicit request on 5 October 2026, Australia/Sydney: “Pause before usage ends.” Do not restart reconnaissance or regenerate unrelated baselines. Chapter 6 is assembled and centrally registered but NOT complete or finally validated. No live database changes, deployment or chapter 7 implementation occurred.

## Completed work

- Read installed Japanese skill, latest runtime README and Chapter-5-Complete-and-Chapter-6-Handoff.md. The handoff remains the binding specification.
- Seven reviewed 1.0.0 pack files `apps/web/content/busuu/b2-c06-*.v1.json`; 118 core tasks plus separate L02 optional writing. Summary L01 has 19 authored tasks preserving retained 11+8 with zero recovered rows. Other records retain 100 source rows including optional S08.
- Three independent authoring groups created `scripts/assemble-busuu-chapter-six-{taste,emphasis,rail}.mjs`, scoped occurrence JSON metadata and independent `lib/busuu-chapter-six-{taste,emphasis,rail}-responses.mjs`. Central assembler/response fixture added. Group readiness, deterministic reproduction and all independent correct-answer evaluator paths passed.
- Central registry imports all seven new packs. All 35 prior packs remain untouched. Snapshot captured BEFORE registration at `content/busuu/chapter-six-validation/prior-fingerprints.json` including bytes, saved fingerprints and three raw runtime evidence hashes. Do not overwrite it.
- `structural-contract.ts` narrowly allows retained summary activities with empty screen arrays, preserving known activity IDs/ordinals/source-ID lists/counts and null unknown task identities/counts. Focused positive/malformed/readiness tests passed.
- Shared occurrence supports added: English-only table teaching under explicit false Japanese / true English support; `sourceContract.feedbackTranscript: 'omitted'` validates documented cue-only feedback; `transcriptAccess: 'scene_recap'` requires exact earlier complete visible scene and provides closed `SceneRecap` in LessonRunner. Old pack bytes/state/event shapes unchanged.
- Optional completion projection/alignment extended from community_production to retained tail production_choice; L02 now aligns. Test rejects non-tail/malformed production partitions.
- Whole-chapter tests added at `lib/busuu-chapter-six.test.mjs`; focused shared tests at `lib/busuu-occurrence-support.test.mjs`; existing summary-contract test extended.
- New isolated save harness `content/busuu/chapter-six-validation/database.mjs` and provenance harness `provenance.mjs` written, NOT RUN yet. Harness uses existing PGlite and real client/API/server evaluator without a live connection. It covers all seven saves, summary offline/partial/reload/activity resume/restart/malformed registration, both retry outcomes, optional event exclusion, map uniqueness and ownership. Existing unrelated baselines are reused.
- Full independent reviewer examined every task, optional endpoint, source contract/counts/partitions/concept metadata, Japanese/scenes and new shared changes. No critical findings. Findings below are still pending.

## Pending concrete fixes (write/retain focused regressions then fix)

1. **No-source-replay occurrences currently offer answer audio.** Exact nine rows: L04 A02.S05/S06/S08/S09; L06 A02.S06; CP A01.S01/S02/S04/S07. Raw media empty and rawMediaStructure.source_replay_available false. Add `audio.beforeAnswer?: boolean` with legacy default true. Set false on these newly authored occurrences, audio.required false; hide pre-answer source replay control AND guard actual/stale playback handler in LessonRunner. Keep corrected feedback replay. L04 A02.S05/S09 currently required true due to hidden-script proxy; remove their “Listen” instruction. Do not disable documented full-scene replay on L06 A01.S03/S04 or A02.S02/S03/S04/S05/S07. Pairs without audio already need no changes.
2. **Parallel response readings missing.** L04 A01.S03/A02.S02, CP S08/S09/S17: add explicit kana secondary fields; CP S09/S17 should use Japanese response options with kana readings (IDs/answers unchanged). Reviewer also flagged possible L03 A01.S09/S10; root regression currently expects secondary readings there, so inspect assigned metadata and supply them. Keep full hidden source transcript absent.
3. **Valid CP frequency order.** CP S01 add accepted order `['t0','t2','t3','t1','t4']`, representing 「一日にこの店に食べに五回も来ました。」. Existing `busuu-chapter-six.test.mjs` reproduces wrong grading with independent displayed chunks.
4. **Ambiguous L01 A02.S06 prompt.** State intended sour-and-very-salty umeboshi description; preceding model says recipes vary, so currently 甘い is also semantically possible. Change assembler then regenerate.
5. **Optional writing label.** Shared `OptionalProduction.tsx` currently says “Your Japanese travel intention”; change to neutral “Your Japanese draft.” Optional draft remains local, private, ungraded, no attempt events.
6. **Cue-only feedback replay omitted incompletely.** Root already deleted `content.l06[9].audio.feedbackText` for L06 A02.S02 in rail assembler/regenerated. CP S12 still has full `audio.feedbackText` while raw transcript_in_feedback false: remove it. Whole-chapter limited feedback regression caught this. Check other rows through that test; do not add full transcripts where omitted.

Latest command before pause:
`node --test lib/busuu-occurrence-support.test.mjs lib/busuu-chapter-six.test.mjs`
Result: 10 tests, 7 pass / 3 fail. Failures are expected pending fixes: CP S12 feedbackText; valid frequency order; stale no-source-replay handler. The secondary/readings assertion follows the order assertion and has not yet been reached. The audio-required:false contract test is also pending new field implementation. New red tests were run before implementation.

## Validation to finish after fixes

1. Regenerate only chapter 6 with `node scripts/assemble-busuu-chapter-six.mjs`.
2. Run focused failures once to confirm fixes. Add actual L06 component playback coverage for first/second scenes and final unsupported ordering, reusing the handler-test pattern in `busuu-chapter-four-mechanics.test.mjs` (do not repeat unrelated audio matrices). Already existing general handler baselines remain applicable.
3. Run new provenance and isolated database harnesses; fix genuine failures. The database harness intentionally makes one first response wrong in each pack, uses L03 wrong retry/L04 right retry, expects saved summary accuracy 88 and CP95 while chapter map100; verify these match actual final graded counts. Summary partial offline probe is L01 index7 甘くて then remove/reinsert. Ensure harness assertions reflect independent responses rather than generated accepted mappings.
4. Complete required full web test suite, lint and build ONCE after fixes; collect logs in chapter-six-validation. Do not repeat unchanged full validations. Any content status test expectations may need updates because seven packs are registered.
5. Briefly inspect changed real UI (English-only cultural teaching, optional full scene recap, disabled source replay, optional food label). Existing chapter-five `ui.mjs` shows real component static HTML approach; local browser optional. No acoustic/source media fidelity claim.
6. Update current runtime README top, chapter-six-validation README, demonstrated reusable skill/reference map discoveries only, and whole-chapter 7 handoff. Read chapter7 reference subset only to prepare handoff; do not implement chapter7. Accurately report 100 retained individual rows (99 required+1 optional) and 19 authored L01 tasks, not recovered tasks.

Skill instructions read: using-superpowers, brainstorming/writing-plans/TDD, dispatching-parallel-agents, requesting-code-review, executing-plans, Supabase. Direct implementation authorization supersedes approval gates; no user reconfirmation needed on resume. A compact implementation plan is saved beside this note. All child agents finished; no background implementation is running.

Git arrangement is unusual (`git/.git`); cwd itself is not a normal Git repository. Do not repair it or restore apparent deleted app paths. Preserve raw evidence and all 35 previous content versions. User explicitly prohibited live database changes/deployment.
