# Chapter 3 implementation and validation

4 October 2026, Australia/Sydney. All seven reviewed **1.0.0** chapter 3 packs are registered, playable and validated through the actual account-owned API/client/evaluator save path against isolated PostgreSQL. **98 required screens; 99 retained surfaces:** L01 8, L02 9, L03 15 (9+6), L04 18 (10+8), L05 7 + separate optional A01.S08/exercise 9, L06 21 (12+9), CP 20.

Canonical order, source activity IDs, exercise numbers, response counts, raw support flags, occurrence concepts and evidence remain intact. L05 raw optional metadata remains null and its source numbers remain 1,2,3,4,6,7,8,9; the existing tail-community runtime projection supports its schema 1.1 core/optional partition. Optional private writing is ungraded and unsaved, emits no course events and never blocks completion. Speaking/pronunciation/recording controls remain excluded.

## Shared behavior and compatibility decision

- Dialogue uses occurrence-configured context, labels and translation visibility. Guest/staff IDs retain audio voice compatibility. Omitted visibility keeps all released English support; the new five-turn dessert dialogue uses Japanese/readings/TTS with explicit null English and no English transcript.
- CP S04 binds `o1 / 抹茶味` to L03 **1.0.0**, A02.S03, fact `selected-flavor`, turn `guest-1`. The registry validates the exact scene, source excerpt and answer binding. Fresh browser/evaluator startup resolves the exact source independently. Accessible scene review before Start/resume supports standalone access; it adds no task and enforces no inferred unlock. The quiz question has no source transcript, hint, player or replay, including feedback replay.
- L02 opts in A01.S08 alone through `end_once`. A wrong first response returns after all nine base screens and requires fresh playback. Retry correctness lives separately; first outcomes/accuracy remain immutable. Finishing one retry pass permits completion even if still wrong. CP and other lessons have no inferred remediation. Canonical progress counts exclude the retry.
- Existing validated response events save retry traversal through the unchanged outbox/server replay. New state `retry` exists only during actual retry traversal; the result report exists only on opted-in packs. All old states/results/events retain their shapes and **all 16 prior registered versions retain exact file bytes and persistence fingerprints**. No schema migration or live data operation was needed.

## Content review

All 98 Japanese screens, readings, translations, banks, distractors, expected responses and cumulative reuse received author review plus independent review. Expected response data is authored independently of runtime answer-key enumeration. Corrections preserve teaching timing: negative-window meaning first appears in feedback; trial desire is introduced in the recorded choice feedback; past trial is reinforced at L05 S01. Review also corrected supplied-text wording, a punctuation token counted as kana, and museum movement context. Both partner-first and time-anchor-first relationship orders are explicitly accepted.

The four-response polite-trial reconstruction uses authored `でみます` after supplied `飲ん`, preserving four actual kana responses without punctuation. Kana auxiliary `みる` stays distinct from lexical `見る`; i/na and negative windows, 通う/通る and 続ける/続く particles, word-specific street voicing, experience/exam/match and entrance-exam abbreviation remain consistent. Cultural/place-name examples are qualified. Repeated physical kana/kanji tokens have distinct IDs with reviewed equivalent-text mappings.

## Focused evidence

- [tests.log](tests.log): **148 web tests passed**, including new pack alignment/support/counts, hidden pre-answer DOM, actual repeated-token behavior, dialogue defaults/translation exclusion, exact scene resolution/answer binding, fresh client startup and standalone review, retry queue/resume/gates/feedback/first accuracy and unchanged old shapes.
- [database.log](database.log): **1,069 isolated PostgreSQL/API/client assertions passed** on every real pack, saved completion, map accounting, multi-activity resume, typed suffix partial/cleared/offline drafts, removed/repeated physical tokens, malformed/forged events, restart, ownership and old-version compatibility. L02 wrong-first/right-retry and wrong-first/wrong-retry results both save at **86% first accuracy** with separate retry reports; all-correct first attempts skip remediation. CP saves at 95% despite one deliberately wrong typed response. Seven completed entries yield 100% chapter completion independently of accuracy.
- [provenance.json](provenance.json) / [provenance.log](provenance.log): deterministic regeneration of all seven packs; **98+1** partition; exact hashes for **16 prior versions**, and raw runtime evidence unchanged. Baseline in [prior-fingerprints.json](prior-fingerprints.json).
- [build.log](build.log): production build and TypeScript passed. [lint.log](lint.log): 0 errors; its one new inspection-helper unused-variable warning was removed and [lint-helper-recheck.log](lint-helper-recheck.log) is clean. The remaining **12 warnings** are the existing app baseline.
- [ui.html](ui.html), generated by [ui.mjs](ui.mjs): brief local browser inspection of the real Japanese-only dialogue, expandable prelaunch scene review, delayed question without player, retry progress/banner and correct retry feedback. Layout and accessible support were inspected; screenshots were optional and are not a per-screen deliverable.

Reproduce from `apps/web`:

```powershell
node content/busuu/chapter-three-validation/database.mjs
node content/busuu/chapter-three-validation/provenance.mjs
$webTests = @(Get-ChildItem -LiteralPath lib -Filter '*.test.mjs' | ForEach-Object { $_.FullName })
node --test @webTests
npm run lint
npm run build
node content/busuu/chapter-three-validation/ui.mjs --serve
```

Required combined checks were completed once after content fixes; only the affected inspection-helper lint check was repeated to verify its warning correction. Unchanged chapter 1–2 persistence/TTS/layout baselines were reused. No new source capture, general research, live database writes or hosted deployment occurred.

## Material limits and next handoff

Original photos/video/animations remain deferred with replaceable slots and complete static kanji teaching. Source-identical literal wording/acoustics and exhaustive accepted variants are not established; authorized reviewed production authoring fills those gaps. Existing TTS and account transport are reused; this increment's browser inspection was static real-component UI, not a new live authenticated playback/save walkthrough. Optional writing drafts remain in the open view only. CP explicitly has no pass threshold; completion/accuracy/pass reporting remain separate.

Next scope is **all six chapter 4 entries, 114 required screens**. See [whole-chapter handoff](../../../../../planning/2026-10-03-busuu-integration/Chapter-3-Complete-and-Chapter-4-Handoff.md), especially select-two grading and source activity-boundary retries, which need explicit extensions beyond the current listening-only end retry.
