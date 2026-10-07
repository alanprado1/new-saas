# Whole chapter 7 validation

5 October 2026, Australia/Sydney. **All six B2.C07.L01–L05 and B2.C07.CP entries are reviewed 1.0.0 production packs with account-owned saved progress.** They retain **114 individually documented required screens, 186 physical responses and no optional production endpoint**. All 42 prior registered content versions and saved-attempt fingerprints are unchanged; the registry now has 48 versions.

| Entry | Required partition | Graded screens | Physical responses |
| --- | ---: | ---: | ---: |
| L01 | 18: 10+8 | 14 | 29 |
| L02 | 18: 9+9 | 13 | 25 |
| L03 | 20: 10+10 | 14 | 31 |
| L04 | 20: 10+10 | 14 | 23 |
| L05 | 18: 10+8 | 14 | 27 |
| CP | 20: one activity | 20 | 51 |

Source/canonical screen/activity identities, source exercise numbers, renderer identities/variants, response counts, support/feedback timing and analytical target/dependency indexing remain aligned. All rows are observed structural evidence; no summary-authored extension is used. L03 A01.S05 and L05 A01.S03 retain their actual true/false variants rather than the handoff shorthand choices. L04 has the source mixed kanji recognition choices/gaps and three-pair compound matching. Raw structural/evidence files remain unchanged.

## Review and outcomes

Japanese wording, readings, translations, banks and contextual scenes are reviewed app authoring/adaptation, identified internally separately from retained observed structure. Review covered creation/readiness versus ability, plain-past modifiers and nominalization; double-particle contrast; recommendations/favorites, confidence/encouragement; 雪・景・流・公・園 and compound readings/transitivity; wondering connections, advice and familiar indirect requests. Daruma/scenic/soba copy avoids invented history or universal scene facts.

Independent review checked every pack and fixture. Two findings were reproduced before correction: 12 occurrences displayed unavailable pre-answer parallel source readings, and two route tasks rejected an equivalent means-first order. The corrected occurrence configurations preserve explicit lexical table/kanji/response-option readings while withholding unavailable source layers. Equivalent route order is accepted only in L02 A01.S09 and CP A01.S18. No shared behavior or old content changed.

Typed answers stay occurrence-specific: L01 dictionary form できる/dekiru before supplied の; L03 encouragement ぜひ/是非/zehi; CP trial request 行ってみて/いってみて/ittemite before supplied ください; CP nominalizer の/no after supplied 友達ができる. Primary records establish different targets/script categories; missing literal CP copy is reviewed authoring, not a recovered quotation. Tests exercise all accepted forms and reject cross-occurrence answers or supplied suffixes. Existing NFKC/trim, drafts/Check and IME mechanics are reused.

Only L05 A02.S07 retries once after all 18 base screens with the same option bank/order and fresh playback. Both right and wrong retry outcomes save completion while first-attempt accuracy remains 13/14 (93%) and unique visited screens remain 18. No other retry is configured. CP retains the current explicit `passPolicy: { kind: 'none' }`; reporting remains unset at 75%, 80% and 100% rather than inferring a source boundary. Required completion remains independent of raw accuracy and pass policy.

## Final validation

- [tests.log](tests.log): **195/195 web tests passed**, including nine focused chapter 7 tests for registry/readiness, every source row/count/partition, independently specified answers, both retry outcomes, hidden support/visible banks, unavailable reading layers, typed equivalents and route orders.
- [saved-path.json](saved-path.json): **787 assertions passed** through the real registered client controller, API route, server replay and evaluator with a disposable memory RPC/storage adapter. All six entries save and reload completion; both L05 retry outcomes save and reload; activity boundaries resume. One first error per entry yields L01 93%, L02 92%, L03/L04/L05 93%, CP 95%, while duplicated attempts/rows still yield **six unique completed map entries and 100% chapter completion**. These are disposable test accounts, never owner progress.
- [provenance.json](provenance.json): all six assemblers deterministically regenerate identical bytes. All **42 prior pack bytes and persistence fingerprints**, plus raw structure/inventory/source-index digests, match [prior-fingerprints.json](prior-fingerprints.json). Every runtime evidence reference retains its source hash.
- [lint.log](lint.log): **0 errors / 12 existing warnings**. [build.log](build.log): production build and TypeScript passed. Existing harmless Node deprecation/module warnings remain.
- [ui.html](ui.html): brief browser inspection of actual shared components with chapter 7 creation/readiness teaching, destination listening, typed input, static kanji, retry option readings and hidden ordering bank. Tables/input/banks fit the inspected desktop layout; the hidden listening exchange and complete ordering source remain absent while options/chunks are visible. This static inspection does not claim a new authenticated or acoustic TTS walkthrough. The temporary tab/server were closed.

This is a content/configuration increment. No new persistence, grading event, account-ownership or database contract was introduced. Established database/ownership/outbox/TTS/IME/token baselines are reused; no redundant isolated database harness was run. Saved-path storage is an explicitly disposable adapter and does not independently re-prove PostgreSQL RLS. No live database changes, deployment, new capture, speaking/pronunciation, recording or speech grading occurred.

The existing project skill/reference map records the demonstrated distinction between parallel source readings and lexical/answer-option reading layers, plus content-only saved-path routing. All 30 local links across the updated skill/status/validation/handoff documents resolve; chapter 8 remains unregistered.

## Reproduction

From `apps/web` with the existing Node runtime/dependencies:

```powershell
node scripts/assemble-busuu-chapter-seven.mjs
node content/busuu/chapter-seven-validation/provenance.mjs
node content/busuu/chapter-seven-validation/saved-path.mjs
$courseTests = @(Get-ChildItem -LiteralPath lib -Filter '*.test.mjs' | ForEach-Object { $_.FullName })
node --test @courseTests
npm run lint
npm run build
node content/busuu/chapter-seven-validation/ui.mjs
```

The prior snapshot is immutable; do not recapture it after changes. Regeneration writes only its own temporary directory. Production runtime has no external research-directory dependency.

Material limits: source-identical wording/assets/acoustic alignment, exhaustive alternate expressions and source grading/unlock boundaries remain unavailable. Reviewed production copy and current TTS/static visuals satisfy the documented playable scope. The [whole-chapter 8 handoff](../../../../../planning/2026-10-03-busuu-integration/Chapter-7-Complete-and-Chapter-8-Handoff.md) routes the next eight entries. **Chapter 8 is not implemented.**
