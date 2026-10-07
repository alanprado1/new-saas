# Whole Chapter 8 validation

6 October 2026, Australia/Sydney. Implementation and final checks ran 5 October; documentation was finalized after the requested pause. **All eight B2.C08.L01–L07 and B2.C08.CP entries are reviewed 1.0.0 production packs with account-owned saved progress.** They preserve **132 individually documented surfaces: 131 required tasks, one separate optional writing endpoint and 234 physical required responses**. All 48 prior registered versions retain their exact bytes and saved-attempt fingerprints; the registry now contains 56 versions.

| Entry | Required partition | Graded screens | Physical required responses |
| --- | ---: | ---: | ---: |
| L01 | 20: 10+10 | 16 | 32 |
| L02 | 17: 9+8 | 13 | 27 |
| L03 | 19: 10+9 | 14 | 32 |
| L04 | 19: 10+9 | 13 | 22 |
| L05 | 18: 8+10 | 13 | 29 |
| L06 | 8 + separate optional S09 | 8 | 15 |
| L07 | 10: one activity | 9 | 19 |
| CP | 20: one activity | 20 | 58 |
| **Total** | **131 required + one optional** | **106** | **234** |

Source/canonical screen and activity identities, source exercise numbers, renderer identities/variants, physical response counts, support timing and analytical dependencies remain aligned. The optional L06 endpoint is canonical A01.S09 and source exercise 10. No summary contract or source-row replacement is needed. Raw structural projections and original evidence are unchanged.

## Review and corrections

Japanese wording, readings, translations, banks and contextual scenes are reviewed app authoring/adaptation, internally distinguished from observed structure. Review covered はず as a reason-based expectation rather than an absolute guarantee; plain verb/い-adjective, な-adjective + な and noun + の connections; strong negative expectation with はずがない／ありません; potential versus ongoing forms and creation できる; hunger/thirst register, 渇く versus 乾く, 減る and refill versus quantity; body-kanji compounds/finger readings; food pairing, scent, freshness and respectful invitations; wondering, desire and volitional forms. Every repeated physical token has a unique ID, with local same-text equivalence where appropriate and no token reuse.

Actual source variants override shorthand descriptions: L03 A02.S03 is a choice; L04’s first recognition task is a gap and A02.S02 is a two-character variant; L05 A02.S02 is truth. Complete static kanji models replace animations without invented stroke-order claims. All five models include required visible Japanese/English teaching support alongside their word-specific readings and examples.

Independent whole-chapter review checked every required row and complete scene, actual packs/assemblers, answer fixtures and occurrence contracts. Four checkpoint grammatical alternatives were reproduced and accepted locally: time/object placement at S06, leading どうぞ at S11, topic after the causal clause at S13, and reversed independent reasons at S16. A focused evaluator regression tests these literal alternative responses. Scoped re-review confirmed all four fixes. No unresolved actionable review finding remains.

Typed acceptance stays occurrence-specific. L01 S08 checks うまれの/umareno with supplied はずです; CP S09 checks うまれ/umare with supplied のはずです. These are reviewed app scaffolds where complete literal wording was not retained. L06 S07 and CP S07 accept 食べたい/たべたい/tabetai before supplied かな. Tests reject cross-occurrence forms, undesignated script categories and supplied endings. Existing NFKC/outer-trim, IME and draft/Check behavior is reused.

L07’s complete seven-turn peer shopping scene starts with an undecided Mother’s Day gift, compares a light scarf that matches various clothes, proposes visiting a newly opened shop near the station, and recommends wine with a mild floral scent. English is visible before the scene; Japanese turns/readings remain internal for TTS. S03/S04/S06–S10 bind full-scene replay to that exact same-lesson scene. S05 has no inherited scene replay. Japanese-supported judgments, hidden response banks and limited feedback retain their own occurrence settings. No cross-lesson replay or inferred recap contents are added. Tests exercise the actual full-scene playback handler and inspect pre-answer DOM/accessibility support.

Only L01 A02.S07 retries once, after all twenty base screens. Base source exercise 7 and retained retry-trace exercise 11 are separate. Both right and wrong retry outcomes require fresh playback, preserve the option order and first outcomes, and permit completion with unique base count twenty and first accuracy 15/16 (94%). CP keeps explicit `passPolicy: { kind: 'none' }`; raw accuracy and completion never infer a threshold or unlock policy.

## Final validation and limits

- [tests.log](tests.log): **205/205 web tests passed**, including ten focused Chapter 8 tests for all rows/partitions/physical counts/variants, independently specified answers, both retry outcomes, hidden support and visible response banks, L06 optional event exclusion, occurrence-specific typed acceptance, complete English scene/full replay, pass-policy separation and grammatical alternatives.
- [saved-path.json](saved-path.json): **938 assertions passed** through the actual registered client controller, API route, server replay and evaluator with disposable memory RPC/storage. Every entry saves and reloads completion; both L01 retry outcomes save and reload; activity boundaries resume. One first error per entry yields accuracy below 100% while duplicated attempts/rows still produce **eight unique completed map entries and 100% chapter completion**. The optional endpoint is rejected by the real evaluator without adding saved events or changing required state; its component keeps writing in local state only. These are disposable test accounts, never owner progress.
- [provenance.json](provenance.json): deterministic regeneration reproduces all eight pack files exactly. All **48 prior bytes and persistence fingerprints** and three raw runtime projections match [prior-fingerprints.json](prior-fingerprints.json). Every runtime evidence reference retains its source hash. Production does not depend on the external research directory.
- [lint.log](lint.log): **0 errors / 12 existing warnings**. [build.log](build.log): production build and TypeScript passed. Existing harmless Node module/deprecation warnings remain.
- [ui.html](ui.html): actual shared-component inspection included certainty connections, checked input, static body kanji, pairing/taste, English-only gift dialogue and hidden ordering banks. At the inspected **365 px** viewport, document width was 365 px, the table/parent measured about 301 px and inputs 192 px, with no horizontal overflow. The temporary tab/server were closed. This was a brief static component inspection, not a new authenticated/acoustic TTS walkthrough.

No new rendering, grading-event, persistence or database contract was introduced. Established isolated PostgreSQL/ownership/outbox/transport/IME/TTS baselines are reused; the disposable adapter does not independently re-prove PostgreSQL RLS. No live database changes, deployment, new capture, speaking/pronunciation, recording or speech grading occurred. Optional writing is ungraded, private and outside core completion/events. Source-identical wording/assets, exhaustive alternate expressions, acoustic alignment and source grading/unlock boundaries remain unavailable; reviewed production copy and current TTS/static visuals satisfy the requested scope.

## Reproduction

From `apps/web`, using existing dependencies:

```powershell
node scripts/assemble-busuu-chapter-eight.mjs
node content/busuu/chapter-eight-validation/provenance.mjs
node content/busuu/chapter-eight-validation/saved-path.mjs
$courseTests = @(Get-ChildItem -LiteralPath lib -Filter '*.test.mjs' | ForEach-Object { $_.FullName })
node --test @courseTests
npm run lint
npm run build
node content/busuu/chapter-eight-validation/ui.mjs
```

Preserve the prior snapshot; do not recapture it after changes. Regeneration compares files in its own temporary directory. The [whole-chapter 9 handoff](../../../../../planning/2026-10-03-busuu-integration/Chapter-8-Complete-and-Chapter-9-Handoff.md) routes the next nine entries. **Chapter 9 remains unimplemented.**
