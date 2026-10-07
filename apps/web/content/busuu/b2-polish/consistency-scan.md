# B2 learner-visible consistency scan

> Status 8 October 2026: this report describes the pre-polish versions. The owner-approved text pass (see `pack-text-changes.md`, `pack-text-validation.json` and the top of `../README.md`) cleared the internal-language, animation-note, spelling, reading, prompt, praise and table-translation findings. `consistency-scan.mjs` now treats Australian English and run-together readings as the standard; the pre-polish JSON is kept as `consistency-scan.before.json` and `consistency-scan.json` is the post-polish scan.

Read-only scan of the CURRENT version of all 73 canonical B2 records (1,187 screens, 14,400 learner-visible strings; the two preserved older versions B2.C01.L02@1.0.0 and B2.C01.L03@1.0.0 were also scanned and flagged `current:false`). Nothing was modified.

- Run: `node apps/web/content/busuu/b2-polish/consistency-scan.mjs` (any cwd). Writes `consistency-scan.json` beside it (all findings with recordId, contentVersion, screenId, field path, excerpt, check id, severity, plus distributions and layout lists).
- Scanned per screen: prompt, praise, statement, hint, support before/after (Japanese, reading, translation, explanation), dialogue turns/context/labels/glosses, options and readings, bank tokens, pairs, scaffold, fixed prefix, typed label/before/after, table caption/columns/cells, kanji model, optional writing prompt/hint. Hidden transcript-free scripts, `audio.text`/`feedbackText` and provenance/sourceContract/evidence are not scanned (only `audio.reading` for reading validity, labelled TTS-only).
- Shared component strings (not in packs) are listed as manual observations in the JSON (`sharedComponentObservations`) and below.

## Totals (current versions)

| Check | High | Medium | Low | Total |
| --- | ---: | ---: | ---: | ---: |
| 1 Placeholder / leaked internal language | 7 | 65 | 2 | 74 |
| 2 Japanese width / punctuation | 0 | 1 | 0 | 1 |
| 3 English copy (spelling, punctuation, case, whitespace, quotes) | 0 | 0 | 112 | 112 |
| 4 Readings | 0 | 17 | 0 | 17 |
| 5 Answer options (duplicates, correct = distractor) | 0 | 0 | 26 | 26 |
| 6 Length / overflow risk (candidates, not errors) | 0 | 0 | 39 | 39 |
| 7 Instruction templates | see table below (no per-item findings) | | | |
| 8 Other inconsistencies | 0 | 59 | 87 | 146 |
| **All** | **7** | **142** | **266** | **415** |

Clean results worth knowing (checks ran and found nothing): half-width ASCII punctuation, half-width katakana, full-width Latin letters/digits and mixed 。/. endings in Japanese text (0); double spaces, edge whitespace outside deliberate scaffold separators (0); duplicate or punctuation-only-different options, a correct option identical to a distractor, accepted-ID mismatches and twin-token acceptance gaps (0); reading fields containing ASCII (0); placeholders TODO/TBD/lorem/xxx/undefined/null/NaN (0). The only bracket hit is the intentional metavariable "[topic]" in B2.C01.L03.A01.S02 (low).

## Top findings worth fixing

Per-pack means a text change, so a NEW content version of that record is required. Shared means one component/CSS change.

1. **Engine/build language in explanations (check 1, 65 medium + 7 high, 32 lessons).** Learner-facing explanation text says "This app accepts あまい and 甘い, with NFKC width normalization" (B2.C02.CP.A01.S11), "This app authors one gap; the source response count remains unknown" (B2.C02.CP.A01.S20), "The retained occurrence has one response slot" (B2.C02.L01.A01.S07), "This authored example/character/request" (B2.C04.L01.A02.S04, B2.C04.L05.A02.S02, B2.C05.L01.A01.S03, B2.C08.L04.A02.S06), "This occurrence accepts 行け and いけ" (B2.C04.CP.A01.S02, B2.C04.L03.A02.S06, and 11 more), "explicit romaji … accepted" (B2.C06.CP.S03/S16/S19, B2.C07.CP.S13/S15, B2.C08.L01.A01.S08), "without a full (source/listening) transcript" and "feedback gives/retains…" (B2.C06.L02, B2.C06.L03, B2.C07.CP, B2.C07.L05, B2.C08.L05), "the source and translation appear only after answering" (B2.C02.L02.A02.S08), "Listen and complete the source focus and object marker" (prompt, B2.C07.L02.A01.S08). PER-PACK. Term counts in JSON (`findings[].terms`).
2. **"Replaces source animation" notes (33 screens).** Kanji shape notes and kanji support blocks tell the learner a static note "replaces (source) animation / animation is deferred": B2.C05.L02 (S01, S03, S10), B2.C06.L05, B2.C07.L04, B2.C08.L04 (5 screens), B2.C09.L03, B2.C09.L08, B2.C10.L05. PER-PACK (and the hard-coded caption "Static shape study · animation replacement" is SHARED, see below).
3. **Reading spacing convention differs by chapter (check 8).** Word-spaced readings ("おなまえは なんと おっしゃいますか。") are used by 0% of chapters C01-C04 (run-together) but 92-100% of C05-C09 and 62% of C10. B2.C10.L06, L07, L08 are 100% run-together (14, 14, 16 readings) while their neighbours are spaced; 7 lessons mix both styles in one lesson (B2.C06.L03, C09.CP, C09.L03, C09.L05, C09.L08, C10.L01, C10.L03). PER-PACK (text); a decision on the target convention is needed first.
4. **Post-answer view shows the same support block twice (39 screens, medium).** `getVisibleSupport` returns before + after in feedback; where a pack lists the same Japanese (or translation) block in both, the learner sees it twice. Examples: B2.C01.CP.A01.S14, B2.C01.L03.A01.S04, B2.C02.L03.A01.S08, B2.C03.L01.A01.S04, B2.C09.CP.A01.S03, and 13 screens in C10. SHARED fix (de-duplicate identical kind+text blocks in the feedback phase); no pack change needed.
5. **Chapter-1 lesson 1 uses a different reading convention (B2.C01.L01, all 17 check-4 findings).** The "secondary" line holds an alternate kanji script variant, not a kana reading (A01.S01, S03, S05; reading identical to the kana/kanji surface in S03/S05; reading missing under kanji text in S02, S04, S06). Also straight apostrophes (I'm, You're) in S04-S06 (279 other strings use curly apostrophes) and varied praise ("Awesome!", "You got it", "Amazing work!", "You're improving", "Great job!") where all other 922 screens say "Well done!". PER-PACK.
6. **Kanji support blocks repeat the kanji model's examples (40 screens, 8 lessons: B2.C04.L04, C05.L02, C06.L05, C07.L04, C08.L04, C09.L03, C09.L08, C10.L05).** The Japanese sentences and a joined translation appear once in support blocks and again in the model's example list. SHARED (suppress support Japanese/translation on the `kanji` renderer when the model is present) or per-pack removal.
7. **British spellings in otherwise American copy (39 hits).** American dominates (color, favorite 26, honor, behavior, normalization, romanized) but British appears in favourite x14 (B2.C07.CP.S12/S14, C08.L02.A02.S03, C08.L07.A01.S01/S07, C10.L01.A02.S06, C10.L03.A01.S03/S04), practise/practising x9 (B2.C04.CP.A01.S14, C04.L01.A01.S03, C04.L03.A01.S02/S10/S11, C10.CP.A01.S11, C10.L01.A02.S04), recognise/recognising x8, colour/-coloured x5 (B2.C09.L08.A02.S06), civilisation (B2.C01.CP.A01.S12), cancelled (B2.C04.L02.A02.S02), travelling (B2.C07.L02.A01.S03). Note the shared launch screen also uses "Ready to practise". Choose one dialect. PER-PACK (plus one shared string).
8. **Japanese-only and glued prompts (8 screens).** Prompts that are only a Japanese question with no English instruction: B2.C02.CP.A01.S04/S18, B2.C02.L05.A01.S10, B2.C02.L06.A01.S03, B2.C03.L04.A02.S02 (medium). Japanese sentence directly followed by English with no space or quoting: B2.C03.CP.A01.S15, B2.C03.L04.A02.S05, B2.C10.L08.A02.S07; other prompts quote Japanese with “ ” (C01, C05) or 「 」 (B2.C09.L06.A02.S06, B2.C09.L07.A01.S05). Two prompts start in lowercase: B2.C06.L04.A02.S05/S09. PER-PACK.
9. **"Listen" in the prompt but audio is optional/not offered (4, medium).** B2.C02.L07.A02.S01, B2.C06.L06.A02.S07, B2.C09.CP.A01.S06, B2.C10.L01.A01.S03 ("Read and listen. Is the statement true or false?" with `audio.required:false`). Verify what the learner actually gets; if no audio control shows, the wording is wrong. PER-PACK.
10. **Newline in a Japanese support block collapses (B2.C06.L01.A02.S08, support.after).** The block contains a hard line break and reading line break; `.japanese`/`.secondary` have no `white-space` rule so the lines run together. SHARED CSS (`white-space: pre-line`) or per-pack split into blocks.
11. **Dialogue without context falls back to "Hotel scene" (B2.C01.L03.A01.S09, both current and preserved v1).** SHARED fallback text; PER-PACK add `dialogue.context`.
12. **Table "translation" blocks are unpunctuated word lists built from cells (11, low):** B2.C05.L01.A01.S10 and A02.S07, B2.C05.L02.A02.S01, B2.C05.L03.A01.S02/S09, B2.C06.L03.A02.S04, B2.C06.L04.A01.S02 and A02.S01, B2.C06.L05.A01.S05, B2.C07.L03.A02.S07, B2.C07.L04.A02.S04. PER-PACK (or SHARED: do not render translation blocks on `table` when cells already carry English).
13. **Reading-vs-surface mismatches (B2.C01.L01 only, 4):** secondary uses 申します/参りました/致します/俺 while the line above uses ともうします/まいりました/いたします/おれ (script variants, see item 5). PER-PACK.
14. **Repeated long explanations (28 groups, low).** The same 130-240 character explanation appears on 3-6 screens within a lesson: B2.C04.L01 (6), B2.C06.L01 (6), B2.C09.L06 (6), B2.C03.L02 (5), B2.C03.L04 (5), B2.C02.L04, B2.C02.L05, B2.C03.CP, B2.C03.L01. PER-PACK (trim) or SHARED (collapse repeats after first view).
15. **True/false and option-position bias (low).** Correct answers: 48 true vs 23 false of 71 truth screens (68% true). Three-option choice screens: correct is option 1 in 88, option 2 in 88, option 3 in only 31 (15%); options render in authored order (no shuffle). PER-PACK rebalancing, or SHARED deterministic option ordering (needs an old-attempt compatibility decision, so not recommended as a polish item).
16. **Chapter-level end-punctuation drift in `kanji.readingNote` (low).** 68 notes end with no stop, 35 end with ".". Prompts ending in a closing quote (15) or Japanese 。 (7) are the other minor outliers. PER-PACK.
17. **Layout-risk candidates (check 6, 39, none are errors).** 36 table cells longer than 40 characters and 3 Japanese chips longer than 22. Worst: B2.C01.L05.A01.S03 (81-char cell), B2.C09.L06.A02.S03 (79), B2.C06.L04.A01.S04 (74), B2.C01.L04.A01.S03 (3 cells, 61-67, combined Japanese reading " / " English in one cell), B2.C02.L04.A01.S07; longest Japanese chips: B2.C01.CP.A01.S02 "田中と申します。オーストラリアからいらっしゃいました。" (27). No English token over 28 characters and no prompt over 160. The CSS already uses `table-layout: fixed`, `overflow-wrap:anywhere` and a horizontally scrollable wrapper, so these are 375px readability candidates. Full list: `layoutRiskWorst30` in the JSON.
18. **Duplicate chips in banks (26, low, expected).** Intentionally repeated kana/kanji (か, は, ご, 点…); the twin-token acceptance sets were verified correct (0 high findings). Informational only.
19. **Instruction wording drift** (table below): gaps use Complete/Choose/Insert/Reconstruct/Build/Place/Supply/Fill for the same action; "Listen." vs "Listen and" vs "Listen carefully and" vs "Listen to"; typed uses Type (37) vs Write (4) and only 6 of 45 add "then select Check"; truth uses "Read and listen. Is the statement true or false?" (52) plus two one-off variants ("True or false?", "Listen and read. Is the English statement true or false?").
20. **Table reading columns** use the full-width slash for alternates ("はっかい／はちかい", B2.C05.L01.A01.S10, B2.C06.L04.A02.S01) while explanations use " / " ASCII; cosmetic. Stray space inside a kanji table cell: "性格 が悪い" (B2.C02.L04.A01.S07, medium).

## Per-renderer instruction templates (CURRENT, prompt field)

Verb = first imperative/question word after any "Listen ..." prefix. "Distinct" counts templates after Japanese runs are replaced by ‹JA› (most gaps/ordering prompts are lesson-specific by design).

| Renderer (group) | Screens | Distinct templates | Lead verbs | "Listen/Read" prefix forms | Notable cues |
| --- | ---: | ---: | --- | --- | --- |
| gaps | 307 | 279 | complete 186, choose 40, insert 23, reconstruct 11, build 5, supply 3, fill 2, place 2 | none 231, Listen and 37, Listen. 35, Listen carefully and 3 | "supplied" mentioned in 22 |
| gaps (transcript-free) | 131 | 129 | complete 64, choose 20, insert 17, reconstruct 12, build 5, place 4, supply 3 | Listen and 83, none 48 | "supplied" in 4 |
| choice | 114 | 101 | choose 49, which 23, what 3, how 2, select 1 | none 95, Listen. 15, Listen to 3 | 9 begin with Japanese text |
| choice (transcript-free) | 96 | 84 | which 35, what 24, choose 10, who 5, how 4 | Listen. 78, Listen to 8, none 8, Listen and 2 | |
| ordering | 56 | 47 | build 48, arrange 5 | none 52, Listen. 3 | |
| ordering (transcript-free) | 52 | 50 | build 49, reconstruct 2, arrange 1 | Listen and 47, none 4 | |
| truth (supported) | 54 | 3 | "Read and listen. Is the statement true or false?" 52 | Read and listen 52 | variants: "True or false?", "Listen and read. Is the English statement true or false?" |
| truth (audio only) | 17 | 1 | "Listen. Is the statement true or false?" 17 | Listen. 17 | |
| typed | 45 | 38 | type 37, write 4, complete 2, supply 1, recall 1 | none 30, Listen. 10, Listen and 5 | "then select Check" 6; hiragana 13; romaji 3 |
| pairs | 49 | 49 | match 48, complete 1 | none 49 | |
| multi_choice | 6 | 6 | select 5 | none 6 | "then select Check" 1 (shared caption already says it) |
| kanji | 55 | 2 | study 50 ("Study ‹JA›: shape, readings and words in context.") learn 5 | none | |
| table | 85 | 84 | compare 23, study 20, read 13, learn 7 | none 81, Listen and 4 | |
| model | 108 | 102 | learn 29, read 8, notice 5, study 3 | none 65, Listen and read 40 | one "Look, something new!" (B2.C01.L01) |
| dialogue | 12 | 12 | listen 9 | Listen to 9, Read and listen 3 | |

Near-duplicate pairs (Jaccard ≥ 0.6 on word sets, 94 in the JSON `instructionTemplates.nearDuplicatePairs`): "Choose the spelling of ‹JA›." (6) vs "Choose the correct spelling of ‹JA›." (2) vs "Choose the kanji spelling of ‹JA›."; "Listen. Which topic is the speaker interested in?" vs "Listen. Which topic interests the speaker?"; "Type the hiragana reading of ‹JA›." vs "Type the hiragana reading of the stem in ‹JA›."; "Read and listen…" vs "Listen and read…" (truth).

## Shared vs per-pack

SHARED (components/CSS, no content version needed):
- Duplicate identical support blocks in the post-answer view (39 screens): de-duplicate in `getVisibleSupport` (feedback phase).
- Kanji screens render support blocks that repeat the model's examples (40): suppress or collapse on `renderer === 'kanji'`.
- Hard-coded learner strings with build language: "Static shape study · animation replacement" (LessonScreen kanji), "<context> · app TTS dialogue replacement" and the "Hotel scene" fallback (LessonScreen Dialogue), "Reuses the … from screen N" (LessonRunner), launch-page readiness list and "Source limitations and app choices" / "Documented lesson sequence" developer wording (LessonLaunch), "Ready to practise" (British).
- `white-space: pre-line` for `.japanese` / `.secondary` (1 current screen, future-proofing).
- Accessibility: embedded Japanese runs in English fields have no `lang="ja"` (887 after-explanations, 181 before-explanations, 274 prompts, 54 kanji shape notes, 97 kanji reading notes; plus 370 table cells containing Japanese, rendered in `<td>` with no lang); only Japanese-only blocks and `ItemText` set lang. A helper that wraps Japanese runs fixes all at once.
- Possible table presentation tweak for narrow phones (stack cells below ~480px) addresses most of the 36 long-cell candidates.

PER-PACK (new content version of the listed record required; groups):
- Engine/provenance wording in explanations and the "source focus" prompt: 32 lessons (item 1), animation-replacement notes (item 2).
- Reading spacing convention: C01-C04 vs C05-C10, C10.L06/L07/L08 deviants, 7 mixed lessons (item 3).
- B2.C01.L01 script-variant secondary lines, straight apostrophes and praise variety (item 5), and B2.C01.L03 missing dialogue context (item 11, and the preserved v1).
- British spellings (item 7), Japanese-only/glued/lowercase prompts (item 8), "Listen" wording with optional audio (item 9), table word-list translations (item 12), repeated long explanations (item 14), true/false and option-position balance (item 15), `kanji.readingNote` end punctuation (item 16), "性格 が悪い" cell (item 20).
- Instruction-template normalisation (item 19) would also be a text change; most templates are lesson-specific, so a pass should normalise the fixed families only (truth, typed, listening prefix, kanji, pairs).

Not scanned: chapter/lesson titles in `b2-structure.json`, and the optional-writing component chrome (fixed strings, reviewed as OK).
