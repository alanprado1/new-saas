# Chapter 6 validation

5 October 2026, Australia/Sydney. All seven reviewed 1.0.0 packs are centrally registered and playable through the existing account-owned course runner.

| Entry | Required / activity partition | Optional | Graded tasks | Physical required responses | Evidence |
|---|---:|---:|---:|---:|---|
| B2.C06.L01 | 19 / 11+8 | 0 | 8 | 11 app-authored | Summary total/activities observed; zero individual source rows |
| B2.C06.L02 | 7 core in retained eight-row activity | 1 | 7 | 13 | Eight observed rows including optional endpoint |
| B2.C06.L03 | 18 / 10+8 | 0 | 13 | 21 | Observed rows |
| B2.C06.L04 | 19 / 10+9 | 0 | 14 | 25 | Observed rows |
| B2.C06.L05 | 20 / 10+10 | 0 | 14 | 28 | Observed rows |
| B2.C06.L06 | 15 / 8+7 | 0 | 12 | 22 | Observed rows |
| B2.C06.CP | 20 / 20 | 0 | 20 | 45 | Observed rows |

**119 retained surfaces = 118 required tasks + one optional endpoint.** There are **100 observed rows (99 required + one optional)** and **19 authored L01 tasks**. The 165 physical required app responses include 11 authored L01 responses; those unknown source response counts remain null. Teaching tasks count toward required completion but are ungraded. Matching counts physical pairs, character reconstruction counts characters, and ordering counts movable chunks.

## Evidence and content review

Installed skill, current runtime README and assigned handoff were read; authoring used only assigned chapter 6 local Unified/Master/S34/S37 records and L01’s retained S11 summary in S12. No individual L01 tasks were found. Its complete reviewed vocabulary/linking/negative/appearance/past/potential/culture/listening sequence is app-owned. Known 11+8 activity identities/ordinals/counts are preserved; raw screens remain empty. The validation extension rejects erased/changed activities, invalid ordinals/counts, invented task identities, nonempty source arrays and incorrect app physical-response declarations. Zero observed rows and 19 authored tasks are reported separately.

All documented rows preserve canonical/source screen and activity identities, exercise numbers, renderer metadata, physical response counts and states, recorded support, target/prior concept indexing and dependencies. Source activity IDs are never replaced with objective URLs. Observed evidence wins over the handoff’s shorthand: L05 A01.S09 is three matching pairs; CP S07 is a one-slot token gap. No raw evidence was rewritten.

Three authoring groups independently specified displayed response fixtures. A fresh independent reviewer inspected all core tasks and optional writing against retained source structure/metadata, then reviewed Japanese, readings, translations, distractors, accepted alternatives, register and scene facts. Corrections preserve taste semantics; adjective くて/negative/past/そう stems; やすい/にくい and adverbial く; passive noun modifiers; quantity/duration/frequency も; contextual counters/sound changes; 客/観/光/遠/杯 readings; and respectful rail requests. 三杯 uses さんばい and 遠足 uses えんそく in reviewed app copy, correcting retained research cues without changing raw evidence. Legitimate equivalents are configured per occurrence rather than globally folding kana/romaji or accepting arbitrary permutations.

The independent review found source-replay timing, missing option readings, a legitimate frequency order and an ambiguous food prompt. Focused regressions reproduced the defects before corrections. Documented no-source-replay occurrences now use `audio.beforeAnswer:false`, `required:false`, with both control and stale-handler guards. Corrected feedback stays available. Hidden transcripts are absent from pre-answer support/DOM/accessibility; legitimate response banks and option readings remain available. Cue-only feedback does not gain full transcript/corrected-source replay. An English-only cultural table and an optional closed full-scene Japanese recap use narrow configured shared capabilities.

L06’s authored scenes have explicit null English turns, complete Japanese/readings, coherent transport/exit facts and seven correct bound full-scene references. Tests invoke the actual component playback handlers for tourist, rail, unsupported purpose choice and final unsupported ordering, verifying complete ordered scene playback and audio-ready gating. Original source casting/audio/media fidelity is not claimed.

## Results

- [tests.log](tests.log): **186/186 web tests pass**. This includes real pack readiness/alignment, all independent response fixtures, retained-summary malformed contracts, registration, optional event exclusion, both retry outcomes, hidden banks/feedback, response readings and actual scene/source-replay handlers. An initial full run exposed changed missing-audio diagnostic wording in the legacy preview test; the old diagnostic was restored while the new disabled-playback check stays separate. The final full run is green.
- [database.json](database.json): **366 isolated PostgreSQL/API/client assertions pass**. Every actual registered pack saves core completion and reloads through real API/client/evaluator code. Summary L01 covers partial-token offline/reload/remove/reinsert, second-activity resume, clean restart and malformed registration. L03 wrong retry and L04 correct retry both save completion; evaluator coverage also tests both outcomes for each. Optional writing cannot enter the attempt event stream. Ownership and idempotent replay are checked.
- Saved tests intentionally include one first error per entry: L01 88%, L02 86%, L03 92%, L04 93%, L05 93%, L06 92%, CP 95%. All complete. Duplicated attempt rows still yield seven unique chapter entries and **100% chapter completion**, independently of accuracy. These are disposable test accounts, never owner progress.
- [provenance.json](provenance.json): deterministic seven-pack regeneration passes; all **35 previous content versions** retain their exact bytes/save fingerprints in [prior-fingerprints.json](prior-fingerprints.json). Raw structure, inventory and source-index hashes are unchanged. Assemblers read retained local metadata; no external research directory is a runtime dependency.
- [lint.log](lint.log): **0 errors / 12 existing warnings**, with no new assembler warnings. [build.log](build.log): production build and TypeScript pass.
- [ui.html](ui.html): brief actual shared-component browser inspection of English-only culture, closed/open Japanese scene recap, kana options, visible ordering bank and private food writing. The recap opens to the correct full Japanese tourist scene; the food draft uses a neutral label. This is static component inspection, not a new authenticated or acoustic walkthrough.
- The existing skill/reference map now documents demonstrated reusable contracts. Installed YAML parsing validates unchanged skill metadata; all 31 local links across the six updated skill/status/handoff documents resolve.

Existing typed/IME/repeated-token/transport/TTS/old-state ownership baselines are reused. No new database schema, grading event or legacy state/result shape is introduced. Old pack defaults remain unchanged. No live database writes, deployment, new capture, speaking/pronunciation, recording or speech grading occurred.

## Reproduction

From `apps/web`, with existing Node and installed dependencies:

```powershell
node scripts/assemble-busuu-chapter-six.mjs
node content/busuu/chapter-six-validation/provenance.mjs
node content/busuu/chapter-six-validation/database.mjs
$courseTests = @(Get-ChildItem -LiteralPath lib -Filter '*.test.mjs' | ForEach-Object { $_.FullName })
node --test @courseTests
npm run lint
npm run build
node content/busuu/chapter-six-validation/ui.mjs
```

Do not rerun the prior snapshot capture: it is immutable baseline evidence. Temporary regeneration writes only its own verified temporary directory; PGlite is isolated and uses existing migration files, never a hosted database.

Material limitations: source-identical wording, assets, acoustic alignment, exhaustive accepted forms and source scoring/unlock thresholds remain unavailable. Reviewed authored copy supplies the learning content. No checkpoint boundary or broad remediation policy is inferred. The next authorized implementation batch is the [whole-chapter 7 handoff](../../../../../planning/2026-10-03-busuu-integration/Chapter-6-Complete-and-Chapter-7-Handoff.md); chapter 7 has not been implemented.
