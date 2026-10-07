# B2 chapter 2 validation

4 October 2026, Australia/Sydney. All eight reviewed **1.0.0** packs are registered and playable with saved core progress.

| Entry | Required screens | Graded screens | Source partition |
| --- | ---: | ---: | --- |
| B2.C02.L01 | 10 | 7 | A01 10 |
| B2.C02.L02 | 21 | 15 | A01 12 + A02 9 |
| B2.C02.L03 | 10 | 8 | A01 10 |
| B2.C02.L04 | 10 | 7 | A01 10 |
| B2.C02.L05 | 10 | 7 | A01 10 |
| B2.C02.L06 | 8 | 8 | A01 8 required + optional S09/exercise 10 |
| B2.C02.L07 | 21 | 15 | A01 13 + A02 8 |
| B2.C02.CP | 20 | 20 | A01 20 |
| Total | **110** | **87** | **111 retained surfaces** |

## Fresh checks

- **133 web tests passed**, including 11 focused chapter 2 tests and all affected chapter 1, renderer, audio, evaluator, API, save, ownership and existing Study/SRS regressions. [Full output](web-tests.log).
- **789 isolated PostgreSQL/API/client assertions passed** on every actual registered chapter 2 pack. Partial and cleared typed drafts save before grading/playback, offline outboxes recover, explicit Check locks feedback, malformed/forged events do not write revisions, internal activity boundaries resume, optional writing emits no attempt events, restart retains predecessors, account isolation holds, released chapter 1 attempts resume with unchanged state shapes. CP deliberately finishes with one wrong typed answer: saved **completion / 95% accuracy**, map chapter **100%**. This uses the existing migrations in an in-memory PGlite database; no live database write or migration.
- **Production build and TypeScript passed.** [Build output](build.log).
- **Lint: 0 errors / 12 existing warnings.** The initial lint pass caught one unused variable in the new test; it was removed and lint rerun. [Final output](lint.log).
- Deterministic offline assembly verified all eight new packs and **all eight chapter 1 version fingerprints**, including old previews and released L04/L05/CP. Raw inventory/structure and prior pack bytes remain unchanged. [Fingerprint report](provenance.json).
- Brief local browser inspection of actual static components confirmed the new kanji teaching, typed field/Check, fixed prefix/removable chunks, and audio-only truth judgment. [Inspection artifact](ui.html). Component handler regression exercises composition start/change/end, native composing Enter and keyCode 229, committed Check/Enter, saved draft value and feedback lock. Static inspection does not constitute a new live authenticated/TTS walkthrough; existing TTS/ownership baseline is reused.

Reproduce from `apps/web`: collect `lib/*.test.mjs` and run `node --test`; `node content/busuu/chapter-two-validation/database.mjs`; `node content/busuu/chapter-two-validation/provenance.mjs`; `npm run lint`; `npm run build`. `node scripts/assemble-busuu-chapter-two.mjs [output-directory]` regenerates the new packs offline. `node content/busuu/chapter-two-validation/ui.mjs [--serve]` creates the optional inspection page.

## Content and contract review

Every screen was reviewed for Japanese, readings, translation, target/context, answer mappings, distractor ambiguity, support timing and cross-lesson reuse; an independent review covered all 110 core screens. The fixed-prefix contrast accepts both 妹はじつは and じつは妹は with explicit token permutations. Models show English before Continue; unsupported listening has no transcript/translation in pre-answer DOM, accessibility or tooltip text. Supported truth retains visible Japanese requirements. Known response counts, source activity IDs, canonical sequences and source exercise numbers are retained and alignment-checked. L01 S07 retains **one** whole-word kana response, CP S13 has **six** movable chunks, and CP S20's source count remains **null** despite an authored one-gap implementation.

Typed acceptance is per occurrence: L06 S07 `やさしい` / `優しい`; L07 A02 S08 and CP S01 `こわ` only before supplied endings; CP S11 `あまい` / `甘い`. NFKC + outer trim only; no romanization, kana folding, internal-space removal or broad suffix normalization. Typed drafts are bounded to 100 UTF-16 code units and exclude controls, invisible format characters and unpaired surrogates. Old states do not gain `typedDraft` on non-typed screens; old event/result shapes and saved fingerprint bindings stay unchanged.

L06's retained raw `optionalProduction: null` is preserved. Shared runtime metadata derives its 8+1 partition only from the evidenced tail `community_production` row, and validates the entire source partition/identity. The optional writing view is private, ungraded, emits no course events and does not persist its draft after leaving the view. Checked typed core responses, by contrast, do persist drafts and results.

Complete static kanji teaching covers 参, 実, 然, 特, 例; then 優, 怖, 寒, 暑, 悪. Shape notes are visual study aids, with word-specific readings, meaning and contextual examples; they do not claim an observed stroke sequence or historical etymology. Name readings are qualified examples. Train-service statements avoid universal stopping/fare claims; social-awareness content is contextual, without categorical cultural assertions. Adjective classes, selected がり nouns, nominalization, irregular いい→よくて, negative potential, repeated tokens and 暑/熱 are reviewed consistently.

## Material limitations and explicit app choices

Original images, videos and kanji animations remain deferred; neutral replaceable slots and full teaching/TTS are supplied. Exact original sentence wording, exhaustive accepted forms, acoustic quality, source randomization/rewards and unlock behavior remain unknown. Content is internally identified as authored/adapted production rather than verbatim observation.

The source retained a start-anchor requirement but no literal prefix or supplied-versus-instruction distinction. The app explicitly supplies authored `兄は、` outside six movable chunks; this is recorded in provenance. CP explicitly has **no pass threshold**; core completion and raw accuracy are saved separately, and configurable pass reporting never gates completion. No speaking/pronunciation/recording/speech assessment actions are exposed. No new capture, general research, hosted deployment or live learner-data operation occurred.

The whole-chapter next task is [B2 chapter 3](../../../../../planning/2026-10-03-busuu-integration/Chapter-2-Complete-and-Chapter-3-Handoff.md): 99 retained / 98 required surfaces, with new Japanese-only service dialogue, delayed cross-lesson scene context and configurable lesson-local remediation requirements.
