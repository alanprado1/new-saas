# B2 chapter 1 lesson 1 capture and readiness delta

Captured 3 October 2026, 12:12–12:25 UTC (Australia/Sydney local date 3 October). Scope: **Introducing yourself in a humble way**, one activity, six canonical base screens, immediate navigation/launch, feedback, settled result and return context. Authenticated desktop access succeeded. No other lesson or checkpoint was launched. This task stops at evidence and handoff.

The output includes [six-screen evidence](B2-C01-L01-Evidence.json) and [38 state images with hashes, dimensions and bindings](Desktop-State-Evidence/manifest.json). **O** means directly observed; **I** means interpretation; **P** means proposed app behaviour; **U** means unknown. Previous observations are retained separately through the baseline provenance; new facts do not silently overwrite the original audit.

## Capture conditions and limits

- **O:** Chrome's viewport override was fixed at 1280 × 720 CSS pixels throughout. Reported device-pixel ratio was 1.0000000074505806, approximately 1; visual viewport scale was 1. Visual viewport width was approximately 1264.889 CSS pixels with the scrollbar, height 720. The temporary override was reset after capture.
- **U:** Browser zoom percentage and Windows display scaling were not independently measured. These remain null. A viewport scale of 1 does not certify both settings.
- **O:** The browser screenshot API returned native JPEG. Images were kept in that format; no conversion is represented as lossless. Most exports are 1265 × 712 pixels, while selector-modal and streak captures are 1280 × 720. The cause and exact image-to-CSS calibration are unresolved. DOM geometry, rather than counting image pixels, supplies the measurements.
- **O:** Measurements comprise 24 labelled element/style records, plus the first speaker video's bounding rectangle and media durations. They use read-only rendered DOM geometry/styles. Font-family values describe the declared stack; actual font loading and rendering are unverified.
- **U:** No event-clock/frame recording measured submit-to-feedback, Continue-to-next, animation duration or easing. Trigger order is observed; milliseconds remain null. A tool roundtrip or interval between screenshots is not product latency.
- **O:** This was a **restart** of an already-completed lesson. Answers/rewards changed the research account's stars and daily challenge counters. Its 100% lesson score, 83% chapter progress and 90% B2 progress are research state, not the owner's app progress.

Some DOM snapshots retained old feedback or offscreen Continue controls during transitions. Screenshot visibility was used to distinguish teaching shown to the learner from retained DOM nodes. Misleading early capture filenames are explicitly corrected in the manifest: `NAV-return-after-L01-first-visible` is a daily-challenges summary; `NAV-B2-C01-return-settled` includes the grammar-review overlay. The final unobstructed timeline image is the authoritative return view.

## Six-screen findings

| Canonical screen | Observed interaction and support | Readiness change | Remaining gap |
|---|---|---|---|
| `B2.C01.L01.A01.S01` | Speaker **video**, primary kana wording, secondary kanji and English visible before Continue. Entry autoplay, Play/Pause, Seek and Settings. Speed submenu offers 0.75× and Normal, Normal checked. Continue advances ungraded. | Modality and correct-path controls verified. The old semantic `audio_model_v1` family must support video. | Standalone full model/readings/translation and usable video/audio absent; top icons and buffering/error behaviour unknown. |
| `B2.C01.L01.A01.S02` | Still photograph with **audio**, Japanese source visible before answer, including わたくし. True/False buttons; True yields green feedback immediately and both become disabled. Formal-introduction teaching appears in feedback; source/player persist. | One response slot, two labels, observed truth and disabled state verified. | Complete structured prompt/model/teaching copy and media absent; False response/retry unknown. No separate model translation was observed. |
| `B2.C01.L01.A01.S03` | Three introduction/register pairs, two Japanese layers per left tile. Tap endpoint then counterpart. Correct right tile moves into its matching row; pairs turn green. Final pair opens pronoun-reading/professional-setting feedback. No source-media control encountered. | Pair count, mapping, initial/final right order and final-pair trigger verified. | Complete Japanese tile copy, source item IDs, wrong-pair/reselection rules and optional audio requirement unresolved. |
| `B2.C01.L01.A01.S04` | Speaker **video**, one stem gap, fixed ました suffix; bank まいり / 来た. Tap まいり grades immediately. Completed Japanese/English, replay icon and humble-form/past teaching appear after response. Source player remains. | Stem/suffix boundary, bank forms, successful placement and support timing verified. | Full scaffold/feedback text and video/feedback audio absent. Replay icon was clicked, but acoustic output/quality was not verified. |
| `B2.C01.L01.A01.S05` | Still map/portrait image with **audio**. Three whole-sentence options with parallel script. Option 2, using まいりました / 参りました, grades on tap. English translation and form-change explanation appear in feedback. | Correct choice, form contrasts and immediate trigger verified. | Full structured prompt/options/feedback and image/audio absent; post-answer editing, wrong choice and shuffle policy unknown. |
| `B2.C01.L01.A01.S06` | Still map/portrait image with **audio**. Two gaps, four tokens ordered 来ました / まいりました / 申します / 言います. First tap fills gap 1 without grading. Tapping inserted token removes it and restores its bank position. Filling 申します then まいりました grades on final placement; translation/teaching follow. | Bank, observed ordered mapping, partial removal and final-placement trigger verified. | Full scaffold/feedback text and image/audio absent; other placement orders, wrong slots and accepted variants unknown. |

Source activity ID remains `activity_112be83f-55ce-4500-9315-e726c94f909d`; base ordinals/exercise numbers remain 1–6. The first, second and finish routes corroborate the activity identity; intermediate exercise numbers also retain their package provenance. Feedback, confetti, replay, result and account prompts contribute **zero additional base screens**.

The JSON preserves short instructions where retained, concise content notes and individual forms. Full sentence wording is visually retained in the images. It is **not yet a reviewed, standalone executable text corpus**. Positional choice/token/pair IDs in this evidence are local analyst IDs, not recovered Busuu internal IDs. One successful configuration does not establish all accepted alternatives.

## Navigation and return facts resolved by this capture

**O — immediate navigation:** “Complete Japanese” sits above a full-width level button within a centred course column. The selector is a centred white modal over a dark backdrop. It displays Beginner A1 (31 chapters), Elementary A2 (22), Intermediate B1 (18) and Upper Intermediate B2 (10). Opening it and selecting the already-current B2 returns to the B2 timeline. Other level destinations were not exercised.

**O — chapter order:** “Chapter 1: Myself” contains L01 Introducing yourself in a humble way, L02 Asking a question respectfully, L03 Talking about your interests, L04 Listing things, L05 **Developing fluency**, then Checkpoint. The L05 objective concerns とか/lists; a “— lists” title suffix is an analyst description, not visible source copy. L05 stays before the checkpoint even though this account shows L05 at 0% and the checkpoint at 100%. This observation does not recover prerequisite/unlock rules or progress formulas.

**O — completed launch:** clicking L01 opens an anchored blue/teal popover under the circular card, with “Mixed”, “1 min”, “Review skills” and “Restart lesson”. Restart lesson was followed. The one-minute label is an estimate, not a measured session duration. Review skills was not opened. A source-identical first-start, unavailable, locked or partial-resume launch was not encountered.

**O — result/return:** the settled result shows the learner-name heading, +5 stars, 100% score and +1 vocabulary item with a replay icon. Continue then traversed daily challenges (5/20 stars, 1/3 lessons, 1/2 over-80% lessons), a six-day streak summary, and the B2 timeline. An optional Grammar Review drawer offered Practise now / Not now; Not now returned to unobstructed C1. Timeline return was scrolled to the chapter; the course heading/selector were above the viewport. These account-dependent prompts are not guaranteed universal post-lesson steps.

No audio/video DOM elements remained on the result or returned timeline. This is structural media cleanup evidence, **not an independent acoustic silence test**. The main media sampled durations were S01 5.572233 s (video), S02 5.903667 s (audio), S04 9.943267 s (video), S05 1.750167 s (audio), S06 5.590167 s (audio). Duration metadata is not a reusable clip.

An incidental leaderboard promotion appeared during timeline capture and was dismissed with Not now. It is annotated in the manifest and excluded from lesson structure.

## Measured desktop anchors

These are **O measurements**, in CSS pixels at the recorded state, not final app tokens. Vertical positions change with scroll and feedback drawers.

| Element | Measured values |
|---|---|
| Course column | 620 wide; heading at x 322.444. Heading 32 px / 41.6 line-height / weight 800. |
| Level button | 620 × 51.556; 12 padding; 16 radius; white; grey border rgb(218,225,234). |
| Selector modal | 450 × 665.778 at x 415, y 27.111; 16 radius; white; backdrop rgba(0,0,0,0.6). |
| Chapter panel/card | Panel width 620, padding 24, radius 24. Inner card width 568.444, height 122; card vertical padding 16. |
| Chapter / card typography | Chapter heading 24 / 31.2 / 800; card title 16 / 24 / 700. |
| Lesson column / S01 video | Column 512; S01 video 512 × 288. Instruction 18 / 27 / 700. |
| Model text hierarchy | Primary Japanese 18 / 27 / 700; secondary kanji and English 14 / 21 / 400. |
| Option/tile treatments | S02 truth button 248 × 54.75; S03 tile 248 × 136.333; S04 token 87.201 × 61.556; S05 sentence option 512 × 88.75. Radius 8; padding 12 × 16. |
| Correct gap | Fill rgb(136,247,200); border rgb(17,238,146); radius 8. |
| Continue / close / progress | S01 Continue 200 × 48, radius 26, blue rgb(17,110,238), white 16 / 24 / 700; x 1024.889, y 656. Close 40 × 40 at x 1210.889, y 12. Progress track 500 × 12, radius 16, grey rgb(218,225,234). |
| Feedback drawer | Fixed at bottom; S06 settled height 217.194; white, shadow rgb(214,222,230) 0 0 10 −2. Explanation 16 / 24 / 400. |
| Result heading | 32 / 41.6 / 800, 300-wide heading in 470-wide result group. |

Declared stack: Nista, Helvetica Neue, Helvetica, Arial, sans-serif. Primary text rgb(30,45,64); some headings black. Exact gradient stops, progress fill colour, font binaries, responsive rules, animation timing and image-pixel calibration remain **U**. The complete 24 metric records include rectangles, margins, borders and ancestor spacing; do not substitute screenshot-derived guesses for null fields.

## Content and asset readiness

| Item | Before | After | App availability |
|---|---|---|---|
| Six-screen order and one activity | Package structural observation | Corroborated by live correct path | Available for structural import |
| Occurrence controls, support timing and correct triggers | Catalog family application partly interpreted | Directly observed for this lesson | Available as requirements; not a complete executable spec |
| Answer evidence | Counts/targets partly available, mappings absent | T/F truth, three pairs, stem bank, choice contrast, two-gap bank/mapping observed | Partial configuration; full sentence items/raw IDs/alternatives absent |
| Prompts/models/scaffolds/explanations/translations | Mostly missing complete text | Screenshots plus concise notes/forms | Complete reviewed runtime fields still missing |
| Desktop state evidence | No C1 occurrence images | 38 JPEG state images and measured anchors | Reference evidence only |
| Source main media and portraits | Modality unresolved; files absent | Video vs image/audio verified; player duration/control evidence | **Zero usable audio, video or portrait files acquired** |
| Feedback audio/result imagery/fonts | Missing | Controls/visuals observed | Reusable files and reuse/editorial status still missing |
| Existing app assets/TTS | Unrelated ramen background/two sprites and TTS capability | Prior audit remains applicable; no new source match | No verified L01 clip or portrait; remote storage not inspected |
| Wrong/retry/score/unlock policies | Unknown | Deliberately left unprobed | Unknown; retain nullable fields |

No media was downloaded and no substitute content, audio or imagery was authored. To enable a faithful lesson, obtain reviewed complete text/readings/feedback plus usable source or explicitly app-authored media, with origin, checksum, alignment and editorial/reuse status. TTS can later be an identified app replacement; it cannot be labelled identical to the observed speaker/audio. Screenshots must not be cut up and silently promoted to lesson asset files.

**Readiness remains:** navigation **ready**; scored source-faithful L01 execution **not ready**. The original readiness JSON remains unchanged. This folder supplies an additive evidence delta; implementers should preserve both old reported provenance and the new live findings.

## Next bounded task: implement Task 1 / M1a

**Deliver exactly:** a navbar entry, all-level ordered course navigation, a versioned structural import, readiness reports and unavailable-content entry views. Do not implement or unlock a scored lesson runner in this increment. No further live lesson capture belongs to M1a.

1. Resolve the intended Git working-tree root before editing. The attached app lives beside `git/.git`, whose indexed app paths currently appear deleted. Do not restore, move or duplicate the app as an incidental repair. Confirm the repository arrangement, then establish appropriate isolated implementation work if required by the repository instructions.
2. Modify `apps/web/app/page.tsx` to add an accessible **Busuu** navbar link to `/busuu`, with keyboard focus and active treatment. This label/route is **P**, authorised by the user's desired navbar access; it is not a Busuu source route. Retain current scene, Study, Chat and account flows.
3. Create `apps/web/app/busuu/{layout.tsx,page.tsx,busuu.module.css}`, `apps/web/app/busuu/[level]/page.tsx` and `apps/web/app/busuu/[level]/lesson/[recordId]/page.tsx`. Implement only `CourseHeader`, `LevelSelector`, `ChapterTimeline` and `LessonLaunch`/unavailable view under `apps/web/components/busuu/`. Use route-local colours/tokens and a Library return. Do not refactor unrelated headers.
4. Create `apps/web/lib/busuu/{types,schema,inventory,readiness}.ts`, `apps/web/scripts/import-busuu-reference.mjs` and minimal reviewed content projections under `apps/web/content/busuu/`: inventory, source-index and B2 chapter-01 structure. Runtime data must be local/versioned, not depend on this machine's Documents path. Import original source digests/pointers and canonical record/activity/screen IDs. Keep unavailable executable content separate from target notes and screenshot evidence.
5. Preserve **81 chapters, 623 teaching/review cards, 78 checkpoints, 3 certificate entries = 704 entries**; level totals A1 249, A2 208, B1 174, B2 73. Preserve array/course order and certificate positions. Do not invent a B2 certificate. Preserve the target partitions L01 6, L02 9, L03 10, L04 10, CP 14. Keep L05 Developing fluency between L04 and CP, visibly unavailable, with the CP dependency note. Never seed research-account percentages into owner progress.
6. Return `getLevelInventory(level)` and `getLessonReadiness(record)`. An unavailable entry shows its known source label/target and **“Content not yet available”**, exact missing-field categories, and a return to the selected level/chapter/card. Use appropriate unavailable launch semantics; do not show a working Restart lesson or redirect to generated scenes. Treat an availability badge as app content status, distinct from a source Premium/locked gate.
7. Validate source counts/order/digests, canonical IDs/nullable facts, level/record mismatch and readiness guards. Add meaningful `inventory.test.mjs` and `readiness.test.mjs`; exercise all four selector routes, back/return context, zero initial progress, L05 position and unavailable views. Run existing relevant tests once after the change. Inspect the navigation at 1280 × 720 CSS pixels against the settled selector/timeline evidence. Full content readiness must remain false when required copy or media is absent.

**Resolved source details usable in M1a (O):** four selector labels/chapter counts; selector modal presentation; B2 C1 heading and exact six-entry order; L05 exact label; measured column/card/type/selector anchors; completed-card restart popover labels; B2 return context and account-dependent overlays.

**Still proposed implementation decisions (P):** `/busuu` routes and initial default level, local state persistence, exact return/scroll restoration, Library/course header integration, owner progress presentation, unavailable badges/views, smaller colour changes, substitute neutral thumbnails where reusable portraits are absent. Use the measured layout as a target but identify neutral assets and colour changes as app choices. Do not claim source-identical unavailable screens because no such source state was encountered.

**Still unresolved source facts (U):** navigating A1/A2/B1 live destinations, first-start/locked/partial-resume states, Review skills destination, exact source score/progress/unlock formula, the top icons and universal post-result path. These do not block an honest M1a course map. Further L02, L03/video, L04, CP/L05-dependency captures and any wrong-response probe must each be separate bounded evidence tasks.

M1a acceptance is an inspectable complete course map with trustworthy availability. It must not claim playable or identical Busuu lesson content. Stop when the navbar, map, structural contracts and unavailable views satisfy those checks; then hand back the implementation and its validation evidence.

## Preservation and verification

The capture added only this evidence folder. SHA-256 comparison of the pre-capture baseline verified **202 original app/data/reference/planning files unchanged**, with zero changed or missing paths. Original planning outputs and source package were preserved. No app tests were run for this browser-only evidence task; prior test results are not represented as fresh implementation validation. Final validation checks the six canonical IDs/order, one activity, manifest hashes/dimensions, all image paths, explicit missing media/text fields and unchanged input hashes.
