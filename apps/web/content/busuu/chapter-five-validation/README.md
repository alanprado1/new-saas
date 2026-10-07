# Chapter 5 validation

5 October 2026, Australia/Sydney. All **six entries** have reviewed **1.0.0** packs and real registered account-owned save/completion paths. No live account progress was seeded.

| Entry | Required app screens | Structural evidence |
| --- | ---: | --- |
| B2.C05.L01 | 21 (11+10) | 21 retained individual rows |
| B2.C05.L02 | 20 (14+6) | 20 retained individual rows |
| B2.C05.L03 | 21 (13+8) | 21 retained individual rows |
| B2.C05.L04 | 16 (10+6) | 16 retained individual rows |
| B2.C05.L05 | 19 (10+9) | 19 retained individual rows |
| B2.C05.CP | 20 (app-authored single activity) | Retained count/modality summary; zero individual source rows |

The five lessons preserve **97 documented screen identities**, internal activity partitions, original source screen/activity/exercise identities, known physical response counts, support flags, target indexing and dependencies. They have no documented production endpoint; none was added. All Japanese content, readings, translations, banks and answer mappings are reviewed authoring/adaptation from the retained targets, with internal provenance distinguishing this from observations. Original media/animations use shared replaceable placeholders/static kanji and existing Japanese TTS. Speaking/pronunciation/recording/speech grading are excluded.

## Observed versus authored checkpoint

The local unified B2.C05.CP summary, master reference and packaged `Evidence/S12-Busuu-Japanese-Reconnaissance-Blueprint.md` S10 row were inspected first. They confirm **20 tasks** mixing hospitality, kanji, honorific/pragmatic application, typed gaps, ordering and listening. They retain no individual sequence, source task/activity IDs, task counts, banks or support timing. The research 100% result provides neither an answer key nor owner progress. No capture was made.

The checkpoint is a **complete reviewed app assessment**, following the handoff’s proposed coverage. Its 20 canonical app tasks and one-activity partition live in the versioned pack’s `structuralContract`; none was inserted into raw evidence. The raw lesson still has **zero screens and zero activities**. Every unavailable source identity and source response count is null; authored physical response counts live separately in contract tasks. Readiness reports 0 observed and 20 authored rows. The contract is reusable and fails closed against observed records, invented source identities, mismatched totals/partitions and incorrect app counts. The current version applies to empty retained partitions; a summary with known partial activity counts requires a separately validated extension.

No general alignment relaxation, migration, event or state-shape change was made. All **29 prior registered content versions** retain exact bytes and persistence fingerprints. Only new opt-in pack bytes include the authored structural contract. Old API save/resume events and exact initial/result state shapes were tested.

## Content and presentation review

Independent read-only review covered all **117 app occurrences**, assembly, structural contract/readiness/registry, Japanese-only scene presentation and full-scene playback handler. Two material findings were fixed and pinned through the actual evaluator: L01’s unconstrained 三階 reading accepts both さんがい and さんかい; L04’s question accepts the reviewed equivalent order ご質問はほかに、ございますか。. Other occurrence-specific discourse orders are explicit; no global permutations or kana normalization were introduced.

Review covered 家族 versus 家庭; own-family versus other-family honorifics; lexicalized お/ご forms; 様; ございます as very polite existence versus でございます as copula; respectful eating/drinking, seeing and sleeping/resting; the distinct requests 召し上がってください / ご覧ください / お休みください; floor/counter readings; kanji compounds and shape aids; cautious inn/judo statements; distractors and supplied endings. All 117 independently specified primary response paths complete with 100% first-attempt accuracy.

L01 A02.S08 alone retries once after all **21 base screens**, at the final activity boundary. Fresh playback is required; both right and wrong retry passes finish. First outcomes/accuracy and unique base counts remain unchanged, with separate retry mastery. L04’s authored eight-turn hotel scene uses guest/staff audio IDs, appropriate Japanese speaker labels, full readings/ordered TTS and null English turns. Its single lexical gloss is `チェックアウト → checkout`; it supplies no English transcript. Room third floor, breakfast 7–9, dining room first floor and checkout 10 are coherent. All five A02.S02–S06 replay links bind the complete earlier scene. Transcript-free ordering in L03/L04/L05 and CP hides scripts/translations/answer order while exposing all legitimate response tokens.

## Results and reproduction

Run from `apps/web` using the installed Node runtime:

```powershell
node scripts/assemble-busuu-chapter-five.mjs
node content/busuu/chapter-five-validation/provenance.mjs
node content/busuu/chapter-five-validation/database.mjs
$courseTests = @(Get-ChildItem -LiteralPath lib -Filter '*.test.mjs' | ForEach-Object { $_.FullName })
node --test @courseTests
npm run lint
npm run build
node content/busuu/chapter-five-validation/ui.mjs --serve
```

- **172 web tests passed**; [tests.log](tests.log). Focused structural/gloss tests were observed failing before implementation; alternative-reading/order regression failed on the original generated pack and passed after correction.
- **423 isolated PostgreSQL/API/client assertions passed**; [database.json](database.json). Every actual registered entry saves/resumes completed results; typed CP offline draft, partial hidden ordering, activity continuation, final-boundary retry/offline feedback, both retry outcomes, restart, old content versions, account isolation and six unique map entries are covered. L01 saves 92% first accuracy with separately successful retry; CP saves 95% while completion/map accounting remain complete. These are test outcomes only.
- Deterministic assembly of all six packs, evidence hashes, all **29 prior pack bytes/save fingerprints**, and unchanged raw runtime structure/inventory/source index passed; [provenance.json](provenance.json), [prior-fingerprints.json](prior-fingerprints.json).
- Lint **0 errors / 12 existing warnings**; [lint.log](lint.log). No new lint warning. Build and TypeScript passed; [build.log](build.log). Existing Node module/deprecation notices remain.
- Brief actual shared-component browser inspection at local port 4181 passed: Japanese-only scene with glossary, both transcript-free response banks and reviewed authored-checkpoint launch. [ui.html](ui.html) is reproducible static UI evidence, not an authenticated interactive or live acoustic walkthrough. Established TTS/transport behavior is reused; no new live TTS claim.

Source/response/cultural review cannot recover missing original media, exact source quotations or exhaustive source accepted answers. Those limitations are stated in each pack. No new source capture, live database change, dependency installation or deployment occurred. The reusable skill/map was updated only for demonstrated summary contracts, glossary binding and response-bank/answer-equivalence checks.
