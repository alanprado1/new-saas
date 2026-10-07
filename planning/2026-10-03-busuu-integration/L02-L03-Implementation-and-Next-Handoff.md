# L02–L03 production outcome and next bounded handoff

4 October 2026, Australia/Sydney. L02/L03 are reviewed, playable and persistent in version **1.1.0**, preserving their one-activity 9/10 screens. L01 and old 1.0.0 fingerprints remain unchanged. Use [current implementation notes](../../apps/web/content/busuu/README.md) and [focused validation](../../apps/web/content/busuu/production-validation/README.md) as the baseline. Earlier preview-only/wording-blocked handoffs are superseded.

## Next assignment and boundary

Implement **B2.C01.L04's 10 screens**, **B2.C01.L05's seven required core teaching/practice screens**, then **B2.C01.CP's 14 tasks** in the existing shared implementation. Stop after this bounded chapter increment. Speaking/pronunciation and free writing remain separate optional work; the community endpoint must not be required for core completion.

Exact retained wording, documented paraphrases and authoring from documented targets are authorized by the owner's updated policy. Complete missing models, questions, banks, answers, explanations, hints, translations/readings and dialogue as reviewed production content; identify authored/adapted origin internally. Source-exact wording and original media are not readiness blockers. Preserve recorded IDs/order/counts/register/support and review linguistic accuracy, ambiguity and lesson/checkpoint consistency. Reuse shared rendering/styles/TTS/evaluation/persistence. Do not copy lesson components or hardcode lesson IDs.

Read current README, registry/readiness, assigned `b2-structure.json` records and shared contracts first. The relevant retained subset is `Unified-B2-Lesson-Records.json`, S18/S25 and the corresponding master entries at `C:/Users/alans/Documents/Codex/2026-10-03/read-c-users-alans-documents-codex/outputs/`. Consult deeper evidence only for a specific uncertainty or genuinely new interaction. Do not repeat the full evidence search or launch a new capture phase.

## Recorded occurrences

| Entry | Ordered required sequence |
|---|---|
| L04: one activity, 10 screens | Parallel-script list model → one とか gap → や/とか explanation table with optional particle omission → supported formality T/F → sentence chunks → 特に model → adverb gap → 例えば model → transcript-free lexical choice → two discourse stem gaps |
| L05: seven core screens | Supported list-meaning T/F → formal/casual matching → sake-vessel cultural explanation/audio table → four kana slots containing repeated とか → list/location-particle gaps → full sentence chunk assembly from an English goal → two-gap casual-register construction |
| CP: one activity, 14 tasks | Two humble introduction/origin gaps → humble sentence choice → two respectful-question gaps → humble coming stem → transcript-free setting inference → two discourse stems → transcript-free example marker → two casual-list/register gaps → four repeated-list kana slots with vessel context → list/location-particle gaps → five-chunk intention sentence → two audio-supported interest/culture gaps → transcript-free interest category → supported history/tradition T/F |

L05's encountered source exercise numbers are **1,2,4,5,6,7,8,9**. The eighth encountered surface is optional Speak/Write intention; absent source number 3 does not establish a missing screen. Retain the eight-surface structural evidence and explicitly configure seven required screens plus the optional endpoint. Do not silently rewrite the structural record or turn optional production into a completion dependency.

Keep L05 before CP and preserve the checkpoint's **sake-vessel cultural dependency**. Do not infer source unlock rules, exact-80% pass behavior, remediation or randomization from research-account observations. Research scores/rewards never seed owner progress.

## Bounded shared work

Reuse models, tables, hints, choice/truth/matching and ordered slots. Add a shared **ordered sentence/chunk construction** capability where required; `AnswerSpec.ordered_tokens` exists but is not yet implemented by the content screen/runner readiness contract. Give repeated tokens/characters distinct IDs, permit removal/reinsertion before final submission, preserve supplied stem/suffix boundaries and grade only at the documented final response boundary. Test the shared capability once across its relevant variants rather than introducing per-lesson implementations.

Add an explicit, versioned **required-core/optional-surface completion contract** if necessary for L05. Compatibility must retain existing L01–L03 versions, fingerprints and event behavior. Models do not enter feedback: translations intended for an ungraded model must be in its visible support/configuration, not an unreachable after-answer layer. Unknown support facts remain distinct from documented app choices.

## Acceptance and efficient verification

- Separate reviewed packs, central registration, canonical alignment and complete scripts/answers/support; authored copy is production content after review. Incomplete content alone can remain a non-scoring preview.
- Correct/wrong evaluation, repeated-token removal/reinsertion, final feedback timing, hints/tables and hidden listening support; preserve scene/cultural context and Japanese/readings/translation agreement.
- New content must start/finish through the registered server evaluator and save controller; verify partial state, feedback/result resume/restart and unique per-lesson map completion. Keep L01–L03 compatibility checks.
- Reuse the current database/browser baseline for content-only changes. Because chunk grading or optional completion may change contracts, run the affected engine/client/API and database checks where those semantics change. Inspect genuinely new chunk/optional UI once; screenshots are optional. No unchanged full walkthrough or screenshot matrix.
- Complete required web regressions, lint and production build once at the end. Report playable scope, shared changes, focused evidence and material limits concisely; no hosted deployment or new source capture is included.
