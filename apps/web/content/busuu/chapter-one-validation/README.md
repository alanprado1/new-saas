# Chapter 1 completion validation

4 October 2026, Australia/Sydney. All chapter 1 core entries are playable through the existing account-owned save path. No live database writes, new capture, general research or hosted deployment were performed.

| Entry | Pack version | Core screens / graded | Separate optional surface |
|---|---|---|---|
| L01 | Retained 1.0.0 | 6 / 5 | None |
| L02 | Retained production 1.1.0 | 9 / 7 | None |
| L03 | Retained production 1.1.0 | 10 / 6 | None |
| L04 | New 1.0.0 | 10 / 6 | None |
| L05 | New 1.0.0, schema 1.1 | 7 / 6 | A01.S08, optional writing only |
| CP | New 1.0.0 | 14 / 14 | None |

The chapter has 56 required screens. Source evidence remains 57 surfaces: L05's original eight encountered source numbers **1,2,4,5,6,7,8,9** are unchanged. All 31 new required screens have complete production prompts, Japanese/reading/translation, feedback, scripts and answer mappings; there are no avoidable previews. Internal provenance identifies authored/adapted literal content and retained source structure/targets separately. Per-occurrence target, prior-concept and feedback-category metadata is retained in the offline authoring input.

## Shared contracts and compatibility decision

`ordering` renders `ordered_tokens`, validates complete unique-token permutations, uses existing token/remove events and saved `slots`, returns removed tokens to original bank order and grades only final placement. The original ordered-slot event behavior is unchanged. Repeated kana/tokens have distinct IDs and equivalent-text accepted alternatives; IDs cannot be reused. Teaching remains ungraded. L05's culture table displays the required teaching and requires successful TTS playback start before Continue, using the established non-dialogue audio gate. The core teaches おちょこ, 升（ます）and 徳利（とっくり）before checkpoint reuse; it does not add a new full-clip listening gate.

Schema 1.1 explicitly lists required screen IDs plus separate optional surfaces. Alignment compares the complete partition to unchanged source rows/counts/activity/exercise identities. Only required screens enter readiness, traversal, outcomes, saved completion and map progress. Optional writing is accessible separately from core results, emits no attempt events and has no completion dependency. The owner update excludes all speaking/pronunciation choices and controls; the course UI was checked for microphone/recording/speech-assessment actions. Listening/TTS remains available. Original source Speak/Write descriptions remain historical evidence.

All five prior registered pack fingerprints are unchanged (L01 and both L02/L03 versions). Existing schema 1.0 event/result shapes, exact-version lookup and fingerprint-bound resume remain unchanged. The new ordering behavior is additive under new packs; no old screen uses it. No database schema, ownership or transport changes were made.

Checkpoint accuracy, core completion and pass reporting are distinct. CP currently configures **no pass threshold**. Source launch said over 80%, but exactly-80 behavior, failure/remediation, randomization and causal unlock rules remain unverified. Configurable threshold reporting uses raw correct/graded accuracy and never gates core completion. No research scores/rewards seed learner progress.

## Content review

Reviewed complete examples against their target forms, readings, translations and bank/answer mappings. L04 teaches conversational non-exhaustive noun lists with とか, neutral/more formal や, context-dependent destination に omission, 特に and 例えば. It does not introduce action listing. The discourse stems **例え + ば** and **特 + に** preserve supplied boundaries. Models expose their English support in the reachable before layer; unrecorded visibility and table/model TTS are documented app choices, with original flags unchanged.

L05 reuses list meaning/register, teaches sake vessels before reconstruction, distinguishes activity-location/instrument **で** from destination **に**, then assembles a travel intention with dictionary **行く + つもりです**. Cultural definitions describe uses without treating them as rules for every setting. Two copies of each と/か and とか can be placed interchangeably in their corresponding slots while retaining distinct physical identities.

CP reuses L01 humble self 申します/参りました and L02 respectful other どちら/いらっしゃいました, then L04 discourse/listing, L05 vessels/particles/intention and L03 interest/culture/nature/history/tradition. Similar-form distractors 趣味/意味/興味 and 文明/文化 have distinct readings and meanings. Its two lexical slots follow the actual authored source sentence order; reversal is incorrect. History/translation polarity and nature-category listening agree with L03. Every constructed sentence was independently reconstructed from reviewed responses and checked against TTS/feedback Japanese. All transcript-free occurrences omit Japanese script/translation from pre-answer markup and supply them after answering.

## Focused verification

| Check | Evidence |
|---|---|
| Full web regression | **122 passed, 0 failed/skipped**, [tests.log](tests.log). Initial run had one stale CP-unavailable expectation; its evidence-only fixture was retained and playable-launch coverage expanded to all six entries. Only tests changed after that failure; final full regression passed. |
| Production build and TypeScript | **Passed**, [build.log](build.log). No further production code changed after this check. |
| Lint | **0 errors / 12 pre-existing warnings**, [lint.log](lint.log). |
| Actual registered save paths | **241 isolated PostgreSQL/API/client assertions passed**, [database.mjs](database.mjs). Actual course API route, registry, evaluator, save controller and existing migration functions; only authenticated provider/database adapter is replaced with isolated PostgreSQL. |
| Deterministic assembly and fingerprints | All three new packs reproduce byte-for-byte; original structure/inventory and five pack inputs remain unchanged by assembly; five released fingerprints match baseline, [provenance.json](provenance.json), [provenance.mjs](provenance.mjs). |
| New UI inspection | Brief browser inspection of static actual shared-component snapshots at a narrow 478px viewport: partial sentence positions, removable-chunk names, used-bank slots, optional-writing controls/hint/textarea fit without horizontal overflow. [ui.mjs](ui.mjs) / [ui.html](ui.html). Interaction behavior is tested separately; this is not an authenticated browser/TTS end-to-end claim. |

Focused tests cover unique/repeated tokens, removal/reinsertion, complete/wrong final response, malformed permutations, audio guards, support timing, all registered correct/wrong paths, optional partition tampering, optional writing open/edit/close, no speaking mode, raw pass-threshold boundaries and six unique core completions reaching 100% map completion without a production record. Existing L01–L03 runner/API/audio/save/ownership regressions remain in the full suite.

The isolated integration uses reviewed real responses for L04/L05/CP. It saves and reopens partial slots/chunks, removed placements, feedback and results; retries retained failed saves; rejects optional-surface events; creates distinct restart attempts while retaining predecessors; checks idempotency and foreign-account isolation. CP intentionally finishes with a reversed interest/culture answer, yielding **93% accuracy and saved completion**, independently of the no-threshold pass policy. The three new unique completions give 50% of the six-entry chapter; duplicate rows do not inflate progress. Released L01/L02/L03 exact versions also start/resume through the isolated database without altered state.

Unchanged live authentication/TTS/transaction baselines are the previous [production validation](../production-validation/README.md), [expansion validation](../expansion-validation/README.md) and [L01 persistence validation](../persistence-validation/README.md); broader unchanged harnesses were not repeated.

## Reproduce and material limits

From `apps/web`, assemble with `node scripts/assemble-busuu-chapter-one.mjs [output-directory]`. Run `node --test lib/busuu-chapter-one.test.mjs`, `node content/busuu/chapter-one-validation/database.mjs`, and `node content/busuu/chapter-one-validation/provenance.mjs`. Required final commands are all `lib/*.test.mjs`, `npm run lint` and `npm run build`.

No core content/interaction/save blocker remains. Original imagery/video remains deferred. Optional free-writing drafts are local to the open view, ungraded, unsaved and not sent to a community. Speaking/pronunciation is excluded. No new live TTS/authenticated workflow or remote writes were performed; the existing verified transport/audio remains reused. The hosted app has not been deployed in this task. General source grading/unlock boundaries remain unknown and explicitly configured app policy.

Next assignment: the complete [B2 chapter 2 handoff](../../../../../planning/2026-10-03-busuu-integration/Chapter-1-Complete-and-Chapter-2-Handoff.md), including transcript-free T/F, checked typed answers, kanji teaching, anchored ordering and L06's core/optional metadata discrepancy.
