# Final B2 chapter validation

6 October 2026, Australia/Sydney. All ten B2.C10.L01–L09 and B2.C10.CP entries are reviewed, registered and playable through existing account-owned saved attempts. New packs are 1.0.0. All 65 previous versions retain their exact bytes and persistence fingerprints; 75 versions cover 73 canonical B2 entries. Raw runtime projections and assigned retained reference files are unchanged.

| Entry | Required partition | Retained rows | App-authored rows | Required physical responses |
| --- | --- | ---: | ---: | ---: |
| L01 | 12+6 | 0 | 18 | 23, app-authored |
| L02 | 11+9 | 20 | 0 | 34 |
| L03 | 10+8 | 18 | 0 | 30 |
| L04 | seven required; separate optional S08 | 8 | 0 | 15 |
| L05 | 10+10 | 20 | 0 | 22 |
| L06 | 12+7 | 19 | 0 | 25 |
| L07 | 9+10 | 19 | 0 | 26 |
| L08 | 11+9 | 20 | 0 | 23 |
| L09 | thirteen | 13 | 0 | 17 |
| CP | twenty | 20 | 0 | 40 |
| Total | 174 required + one optional | 157 | 18 | 232 retained +23 authored =255 |

L01's retained summary was inspected first. Its exact sequence, renderer/support/audio choices and physical vector `[0,1,1,0,2,1,0,3,1,1,3,1,0,2,1,2,3,1]` are reviewed app structure, preserving the retained empty 12+6 activity partition. Raw task arrays stay empty; unknown screen/activity/exercise/renderer identities and source response counts stay null. Readiness remains zero observed rows/eighteen authored tasks. Formation covers ru/u verbs, う→わ, する/来る, agency and contextual forcing/permission. CP instead keeps all twenty observed rows and forty responses with explicit `passPolicy: { kind: 'none' }` and no inferred threshold, unlock or retry.

Only L03 A02.S05 returns once after eighteen base tasks. Only L06 A01.S01 then A01.S05 return once after twelve tasks, followed by A02.S01. Source retry counters 9/13/14 remain separate from base counters 5/1/5 and their exact activity UUIDs. Correct and wrong retries permit completion with fresh listening, separate outcomes, immutable first accuracy and unique base counts. Eight L06 saved scenarios cover all four paired outcome combinations and each target missed individually with either retry outcome. L04 writing stays private, local, ungraded and emits no attempt events. Its canonical endpoint S08 is retained source exercise **9**, not the handoff paragraph's source8 shorthand; raw source8 is absent.

Shared screens, grading, typed input, persistence/outboxes and TTS are reused. Structured media objects are inspected by kind. Explicit scene/control prose supports TTS for observed scene-video surfaces with empty media lists. The first restaurant scene preserves one staff speaker and Japanese captions; the second uses a reviewed two-role exchange with unknown original speaker count and without inherited captions/English. The two scenes and related tasks form a coherent arrival, order, meal, payment, returned-bags/change and farewell visit. No undocumented scene replay binding is added. Complete static models for 遊/疲/吸/別/直 replace animation, including the blank/loading source variant.

Two narrow shared additions have focused regressions: exact retained-prose omission evidence can resolve null feedback flags without changing raw evidence or relaxing audio-only truth; documented one-speaker scenes opt in without inventing another speaker. Omitted feedback excludes complete scripts/readings even in decorated, whitespace-varied, explanation or secondary blocks. Audio captions and accessible scene labels name the single configured role. Legacy conversations and explicit false omission flags retain their behavior. No event, persistence, ownership, database or old-attempt shape changed.

Independent linguistic and contract review covered all 174 required tasks, optional guidance and literal response expectations. Three answer findings were reproduced failing and fixed: fronted causative causee order, reversed complete apology clauses, and valid Hepburn `yū` alongside `ゆう`/`yuu` in the two explicitly romaji-enabled reading tasks. The feedback guard and single-speaker accessibility label also have failing-to-passing regressions. Global typed normalization remains NFKC plus outer trim only.

## Reproduction and results

Run from `apps/web` with the existing Node runtime:

```powershell
node --test lib/busuu-chapter-ten.test.mjs lib/busuu-feedback-evidence.test.mjs lib/busuu-single-speaker.test.mjs
node content/busuu/chapter-ten-validation/provenance.mjs <retained-reference-root>
node content/busuu/chapter-ten-validation/saved-path.mjs
$taskCourseTests = @(Get-ChildItem -LiteralPath lib -Filter '*.test.mjs' | ForEach-Object { $_.FullName })
node --test @taskCourseTests
npm run lint
npm run build
node content/busuu/chapter-ten-validation/ui.mjs
```

- **233/233 web tests passed**; production build/TypeScript passed; lint **zero errors/twelve existing warnings**. Final evidence: [tests.log](tests.log), [build.log](build.log) and [lint.log](lint.log). The first browser inspection exposed a two-role accessible label on the new one-speaker scene; its correction has a regression and the shared checks were rerun. A conditional hook in the static inspection adapter was then corrected; lint alone was rechecked because production/test content was unchanged.
- **1,998** real registered client/API/evaluator saved-path assertions passed: ten completion/reload paths, both outcomes of all three named targets, ordered paired and individual L06 continuation, optional-event exclusion, ten unique completed map entries and 100% chapter completion independently of imperfect first accuracy. [Saved paths](saved-path.json).
- Deterministic ten-pack assembly, all 65 prior fingerprints/bytes, raw projections and retained original digests passed. All 73 canonical B2 entries have playable packs. [Provenance/accounting](provenance.json), [immutable baseline](prior-fingerprints.json).
- Brief actual-component browser inspection at its 380px viewport showed content width 365px and no horizontal overflow. Hidden listening contains no full script; feedback contains only the cue; the staff-only scene has its configured caption and Japanese turns; untranslated departure and optional writing retain their support limits. [Inspection artifact](ui.html). The inspection adapter sets a selected screen on the complete real pack; it does not change runtime content or progress.

The disposable memory adapter exercises the real registered API/client/evaluator. It is not fresh PostgreSQL/RLS evidence and does not seed owner progress. Established isolated PostgreSQL/ownership/transport/IME/TTS baselines are reused because those contracts are unchanged. No new source capture, live database change, deployment, speaking, recording or speech grading occurred. Original media, acoustic/synchronization parity and unrecovered literal source wording remain deferred; complete reviewed app content supplies playable equivalents.

[Consolidated B2 completion handoff](../../../../../planning/2026-10-03-busuu-integration/B2-Complete-Consolidated-Handoff.md).
