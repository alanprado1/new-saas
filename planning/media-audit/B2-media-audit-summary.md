# Corrected B2 media audit

6 October 2026 (Australia/Sydney). B2 only. No media generated and no application code/content modified. This supersedes the initial audit. Legacy output aliases were refreshed to this corrected queue to prevent use of old entries.

## Results

- **1,194 completed B2 surfaces inspected**: 1,187 required runtime screens plus seven optional private writing endpoints; 73 records, 75 registered content versions. Every current B2 surface has a classification in the ledger below. All registered historical screen targets were checked.
- **3 confirmed missing illustrative images; 132 confirmed missing videos; 59 ambiguous media cases.** Combined queue 194; dedicated image/video queues contain only confirmed pending_generation items.
- **55 kanji/language screens classified separately**: 45 prior queue entries were removed (40 image slots and five source-animation restoration cases); ten other language screens were already outside the prior queue. These are not completed generated artwork. Their glyphs/readings/examples render through LessonScreen; any source animation remains a separate language-reference requirement. See language appendix.
- 18 runtime video slots contradict explicit retained illustrations; these now require review instead of entering the confirmed video queue. The other 41 review cases carry source/runtime media contradictions.
- No existing file confidently fulfills a B2 generated image/video requirement. Zero entries marked generated or integrated. 72 existing visual files rejected; categories {"development_asset":64,"unknown":3,"icon":3,"logo":2}. This counts actual files, separately from 45 structured language screens and neutral in-code placeholders.
- Shared artwork across distinct screens: zero confirmed. 3 historical-version media duplicates have multiple integration targets but only one generation record. Same-scene context does not by itself establish an identical reusable asset.

## Scope and evidence

All registry imports and every screen/optional endpoint were re-read, along with b2-structure.json rawMedia (strings and structured kinds), purpose/prose, live observations, dialogue/scene bindings and inventory hierarchy. LessonContentScreen.visual, LessonRunner's neutral SVG placeholder, LessonScreen's kanji/dialogue/text rendering, readiness, source-index and retained planning/capture documentation establish intent. Audio alone, generic rendered_player, unknown animation quality, outline objectives and UI icons do not prove illustrative media requirements. A1–B1 are deferred, not audited.

## Asset classification

Allowed classifications: lesson_generated_image, lesson_generated_video, kanji_or_language_asset, ui_asset, icon, logo, placeholder, development_asset, unknown. Only exact-screen-matched lesson_generated_image/video can fulfill a requirement. Current fulfillment count is zero. Neutral SVG slots are placeholder; structured kanji glyphs/models are kanji_or_language_asset. UI text and controls are ui_asset; book/flag indicators are icon. Existing backgrounds/sprites without an exact B2 match remain unknown. Screenshots/test captures are development_asset.

| Existing file | Classification | Fulfillment | Reason |
|---|---|---|---|
| apps/web/content/busuu/expansion-validation/course-map-after-previews.png | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/expansion-validation/l02-desktop-table.png | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/expansion-validation/l02-narrow-hint.png | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/expansion-validation/l02-narrow-result.png | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/expansion-validation/l02-narrow-table.png | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/expansion-validation/l03-desktop-dialogue.png | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/expansion-validation/l03-narrow-dialogue.png | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/expansion-validation/l03-narrow-result.png | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/expansion-validation/l03-narrow-scene-reuse.png | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/persistence-validation/desktop-saved-map.png | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/persistence-validation/narrow-confirmed-result.png | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/persistence-validation/narrow-partial-token.png | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/persistence-validation/narrow-resumed-matching.png | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/persistence-validation/narrow-saved-map.png | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/runner-validation/desktop-model.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/runner-validation/desktop-result.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/runner-validation/desktop-supplied-suffix.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/runner-validation/narrow-matching-feedback.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/runner-validation/narrow-matching.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/runner-validation/narrow-result.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/runner-validation/narrow-two-gap-feedback.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/runner-validation/narrow-two-gap.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/validation/desktop-selected.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/validation/desktop-selector.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/validation/desktop-timeline.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/content/busuu/validation/narrow-selected.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| apps/web/public/backgrounds/ramen_shop.jpg | unknown | Rejected | Existing background/sprite file; no exact B2 screen match or B2 asset URL. |
| apps/web/public/file.svg | icon | Rejected | Interface graphic, not lesson artwork. |
| apps/web/public/globe.svg | icon | Rejected | Interface graphic, not lesson artwork. |
| apps/web/public/next.svg | logo | Rejected | Interface graphic, not lesson artwork. |
| apps/web/public/sprites/Akira_surprised.jpg | unknown | Rejected | Existing background/sprite file; no exact B2 screen match or B2 asset URL. |
| apps/web/public/sprites/Waitress_thinking.jpg | unknown | Rejected | Existing background/sprite file; no exact B2 screen match or B2 asset URL. |
| apps/web/public/vercel.svg | logo | Rejected | Interface graphic, not lesson artwork. |
| apps/web/public/window.svg | icon | Rejected | Interface graphic, not lesson artwork. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S01--media-settings.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S01--model.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S01--speed-options.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S02--before-answer.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S02--correct-feedback.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S03--before-answer.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S03--correct-feedback.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S03--endpoint-selected.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S03--feedback-settled.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S03--one-pair-matched.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S03--two-pairs-matched.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S04--before-answer.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S04--correct-feedback.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S04--feedback-replay.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S05--before-answer.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S05--correct-feedback.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S06--before-answer.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S06--correct-feedback.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S06--feedback-settled.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S06--first-gap-removed.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S06--one-gap-filled-lower.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/B2.C01.L01.A01.S06--one-gap-filled.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/NAV-B2-C01-L01-restart-launch.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/NAV-B2-C01-L5-before-checkpoint-settled.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/NAV-B2-C01-lower-unobstructed.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/NAV-B2-C01-lower.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/NAV-B2-C01-return-settled.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/NAV-B2-C01-return-unobstructed.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/NAV-B2-C01-selector-closed.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/NAV-B2-C01-top-settled.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/NAV-level-selector-open-settled.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/NAV-level-selector-open.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/NAV-return-after-L01-first-visible.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/NAV-return-grammar-review-prompt.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/RESULT-L01-daily-challenges-settled.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/RESULT-L01-first-visible.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/RESULT-L01-settled.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |
| planning/2026-10-03-busuu-integration/evidence-next/B2-C01-L01/Desktop-State-Evidence/RESULT-L01-streak-settled.jpg | development_asset | Rejected | Captured UI/source/test screenshot, not intended installed screen media. |

## Generation readiness

**Image queue: safe for immediate original candidate generation.** Only 3 confirmed illustrative-image screens; no kanji/UI/screenshot substitutes. Prompts preserve scene descriptions and English context, with Japanese content retained in metadata for teaching context. No Japanese text, translations, subtitles, answer choices, teaching labels or app UI should be baked into media. Character/style details absent from source remain explicitly unspecified.

**Video queue: safe for immediate silent visual candidate generation, not automatic final acceptance.** Only 132 confirmed video requirements. Each includes duration/provenance, motion/action, camera specification status, start/end-state limits, dialogue and caption ownership. Two C01.L01 source durations are exact observed metadata (5.572233 s and 9.943267 s); others are estimates. Audio/dialogue is supplied separately by app TTS. Captions/transcript/support visibility remain in app UI, including hidden-before-answer conditions. No exact frame timing, lip synchronization or unspecified opening/closing poses are claimed; those need acceptance review. Ambiguous records are excluded from both dedicated queues and must be resolved before generation.

## Integration readiness

Exact local source files, recordId/contentVersion, screenId, JSON Pointer, source hashes and every historical target are retained. Deterministic destination: apps/web/public/media/busuu/b2/cXX/lXX/SCREEN-ID.webp or .mp4 (cp for checkpoints); public URL starts /media/busuu/. This local Busuu directory is proposed under the existing public-root convention.

**Locator validation passes; direct installation remains blocked by missing capability.** The current visual field is a type enum and there is no asset URL field. visualSrc is expressly proposed/absent. Future integration must add optional schema/renderer support and resolve saved-attempt fingerprint/version compatibility before applying asset references. Every record explicitly states these prerequisites. No app files were changed to make installation appear ready. Raw evidence must stay unchanged. Ambiguous type choices require review first.

## Second-pass validation

PASS: all 1,194 B2 surfaces accounted for; every explicit non-kanji image/video placeholder or retained illustrative/video contradiction has one canonical record. Null/empty URL checks found no existing Busuu asset URL property: the property is absent, not a replaceable null field. Generic metadata nulls are not assumed media requests. Runtime references and retained media prose were reconciled; conflicting types are quarantined. Real animation kinds are isolated as language-reference cases. 197 integration source targets resolve to exact current screen IDs/versions/pointers. IDs/filenames/destinations are unique; no A1–B1, kanji, UI, icon or screenshot entries occur in confirmed queues. All Japanese/subtitle/UI text is assigned to the app rather than generation prompts. Source pack hashes unchanged. All output subsets/aliases derive from the corrected canonical records.

## Ambiguous cases

- B2.C04.L01.A01.S01: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C04.L01.A01.S07: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C04.L02.A01.S01: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C04.L02.A01.S04: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C04.L02.A01.S08: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C04.L02.A02.S01: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C04.L02.A02.S05: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C04.L03.A01.S01: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C05.L01.A01.S01: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C05.L01.A01.S05: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C05.L01.A01.S08: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C05.L01.A02.S01: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C05.L01.A02.S03: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C05.L01.A02.S05: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C05.L03.A01.S07: Retained source explicitly specifies illustration while runtime visual=none. Confirm image/video classification before generating.
- B2.C05.L04.A01.S01: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C05.L05.A01.S01: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C05.L05.A01.S06: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C05.L05.A01.S08: Retained source explicitly specifies illustration while runtime visual=video. Confirm image/video classification before generating.
- B2.C06.L02.A01.S01: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L02.A01.S02: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L02.A01.S03: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L02.A01.S04: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L02.A01.S06: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L02.A01.S07: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L03.A01.S02: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L03.A01.S04: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L03.A01.S06: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L03.A01.S07: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L03.A01.S08: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L03.A01.S09: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L03.A01.S10: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L03.A02.S02: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L03.A02.S03: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L03.A02.S05: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L03.A02.S06: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L03.A02.S07: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L06.A01.S01: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L06.A01.S07: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C06.L06.A02.S04: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L02.A01.S04: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L02.A01.S05: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L02.A01.S07: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L02.A01.S09: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L02.A01.S11: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L02.A02.S02: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L02.A02.S03: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L02.A02.S04: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L02.A02.S05: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L03.A01.S01: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L03.A01.S02: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L03.A01.S04: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L03.A01.S05: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L03.A01.S06: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L03.A01.S07: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L03.A01.S09: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L03.A01.S10: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L03.A02.S03: Source describes video while runtime visual=none. Resolve the requirement before generating.
- B2.C10.L03.A02.S04: Source describes video while runtime visual=none. Resolve the requirement before generating.

## Language-reference appendix (not active artwork generation)

These entries are neither completed generated artwork nor a fabricated illustrative queue. The project intentionally renders static teaching content; any future stroke animation work needs verified linguistic/stroke data and a separate approved task.

| Screen | Character | Runtime visual | Retained media | Source |
|---|---|---|---|---|
| B2.C02.L02.A01.S01 | 参 | image | ["animated stroke model","word-example audio"] | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A01.S03 | 実 | image | ["animated stroke model","word-example audio"] | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A01.S05 | 然 | image | ["animated stroke model","word-example audio"] | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A01.S08 | 特 | image | ["animated stroke model","word-example audio"] | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A01.S10 | 例 | image | ["animated stroke model","word-example audio"] | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L07.A01.S01 | 優 | image | ["animated stroke model","word-example audio"] | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S03 | 怖 | image | ["animated stroke model","word-example audio"] | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S06 | 寒 | image | ["animated stroke model","word-example audio"] | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S08 | 暑 | image | ["animated stroke model","word-example audio"] | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S12 | 悪 | image | ["animated stroke model","word-example audio"] | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C03.L06.A01.S01 | 続 | image | ["animated character player","word-example audio"] | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A01.S03 | 通 | image | ["animated character player","word-example audio"] | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A01.S06 | 努 | image | ["animated character player","word-example audio"] | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A01.S08 | 試 | image | ["animated character player","word-example audio"] | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A01.S10 | 験 | image | ["animated character player","word-example audio"] | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C04.L04.A01.S01 | 勝 | image | ["Japanese audio"] | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A01.S03 | 負 | image | ["Japanese audio"] | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A01.S05 | 点 | image | ["Japanese audio"] | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A01.S08 | 位 | image | ["Japanese audio"] | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A01.S10 | 球 | image | ["Japanese audio"] | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C05.L02.A01.S01 | 館 | image | ["Japanese audio"] | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S03 | 段 | image | ["Japanese audio"] | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S07 | 庭 | image | ["Japanese audio"] | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S10 | 室 | image | ["Japanese audio"] | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S12 | 性 | image | ["Japanese audio"] | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C06.L05.A01.S01 | 客 | image | ["stroke_animation"] | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A01.S03 | 観 | image | ["stroke_animation"] | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A01.S07 | 光 | image | ["stroke_animation"] | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A02.S01 | 遠 | image | ["stroke_animation"] | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A02.S05 | 杯 | image | ["stroke_animation"] | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C07.L04.A01.S01 | 雪 | image | ["video"] | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A01.S03 | 景 | image | ["video"] | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A01.S05 | 流 | image | ["video"] | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A01.S07 | 公 | image | ["video"] | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A01.S09 | 園 | image | ["video"] | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C08.L04.A01.S01 | 腹 | none | ["animation"] | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A01.S03 | 顔 | none | ["animation"] | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A01.S05 | 首 | none | ["animation"] | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A01.S07 | 指 | none | ["animation"] | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A01.S09 | 歯 | none | ["animation"] | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C09.L03.A01.S01 | 約 | none | ["audio"] | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A01.S03 | 決 | none | ["audio"] | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A01.S05 | 断 | none | ["audio"] | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A01.S07 | 返 | none | ["audio"] | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A01.S09 | 確 | none | ["audio"] | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L08.A01.S01 | 堂 | none | ["audio"] | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A01.S05 | 忙 | none | ["audio"] | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A01.S07 | 静 | none | ["audio"] | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A01.S09 | 広 | none | ["audio"] | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A02.S01 | 風 | none | ["audio"] | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C10.L05.A01.S01 | 遊 | image | [{"kind":"visual_kanji_player","controls_observed":true,"acoustic_quality":"U","successful_visual_animation":"U"}] | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A01.S03 | 疲 | image | [{"kind":"visual_kanji_player","controls_observed":true,"acoustic_quality":"U","successful_visual_animation":"U"}] | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A01.S06 | 吸 | image | [] | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A01.S08 | 別 | image | [{"kind":"visual_kanji_player","controls_observed":true,"acoustic_quality":"U","successful_visual_animation":"U"}] | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A02.S01 | 直 | image | [{"kind":"visual_kanji_player","controls_observed":true,"acoustic_quality":"U","successful_visual_animation":"U"}] | apps/web/content/busuu/b2-c10-l05.v1.json |

## Complete B2 screen ledger

For queued screens, their canonical records provide generation prompts, filenames, destinations, handoffs and integration instructions. Non-media and language screens intentionally have no fabricated artwork prompts/destinations.

| Screen | Classification | Required media | Status | Exact local source |
|---|---|---|---|---|
| B2.C01.L01.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c01-l01.v1.json |
| B2.C01.L01.A01.S02 | lesson_generated_image | image | pending_generation | apps/web/content/busuu/b2-c01-l01.v1.json |
| B2.C01.L01.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l01.v1.json |
| B2.C01.L01.A01.S04 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c01-l01.v1.json |
| B2.C01.L01.A01.S05 | lesson_generated_image | image | pending_generation | apps/web/content/busuu/b2-c01-l01.v1.json |
| B2.C01.L01.A01.S06 | lesson_generated_image | image | pending_generation | apps/web/content/busuu/b2-c01-l01.v1.json |
| B2.C01.L02.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c01-l02.v2.json |
| B2.C01.L02.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l02.v2.json |
| B2.C01.L02.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l02.v2.json |
| B2.C01.L02.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l02.v2.json |
| B2.C01.L02.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l02.v2.json |
| B2.C01.L02.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l02.v2.json |
| B2.C01.L02.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l02.v2.json |
| B2.C01.L02.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l02.v2.json |
| B2.C01.L02.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l02.v2.json |
| B2.C01.L03.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c01-l03.v2.json |
| B2.C01.L03.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l03.v2.json |
| B2.C01.L03.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l03.v2.json |
| B2.C01.L03.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l03.v2.json |
| B2.C01.L03.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l03.v2.json |
| B2.C01.L03.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l03.v2.json |
| B2.C01.L03.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l03.v2.json |
| B2.C01.L03.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l03.v2.json |
| B2.C01.L03.A01.S09 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c01-l03.v2.json |
| B2.C01.L03.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l03.v2.json |
| B2.C01.L04.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c01-l04.v1.json |
| B2.C01.L04.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l04.v1.json |
| B2.C01.L04.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l04.v1.json |
| B2.C01.L04.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l04.v1.json |
| B2.C01.L04.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l04.v1.json |
| B2.C01.L04.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l04.v1.json |
| B2.C01.L04.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l04.v1.json |
| B2.C01.L04.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l04.v1.json |
| B2.C01.L04.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l04.v1.json |
| B2.C01.L04.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l04.v1.json |
| B2.C01.L05.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l05.v1.json |
| B2.C01.L05.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l05.v1.json |
| B2.C01.L05.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l05.v1.json |
| B2.C01.L05.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l05.v1.json |
| B2.C01.L05.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l05.v1.json |
| B2.C01.L05.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l05.v1.json |
| B2.C01.L05.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l05.v1.json |
| B2.C01.L05.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-l05.v1.json |
| B2.C01.CP.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-cp.v1.json |
| B2.C01.CP.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-cp.v1.json |
| B2.C01.CP.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-cp.v1.json |
| B2.C01.CP.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-cp.v1.json |
| B2.C01.CP.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-cp.v1.json |
| B2.C01.CP.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-cp.v1.json |
| B2.C01.CP.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-cp.v1.json |
| B2.C01.CP.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-cp.v1.json |
| B2.C01.CP.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-cp.v1.json |
| B2.C01.CP.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-cp.v1.json |
| B2.C01.CP.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-cp.v1.json |
| B2.C01.CP.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-cp.v1.json |
| B2.C01.CP.A01.S13 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-cp.v1.json |
| B2.C01.CP.A01.S14 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c01-cp.v1.json |
| B2.C02.L01.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c02-l01.v1.json |
| B2.C02.L01.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l01.v1.json |
| B2.C02.L01.A01.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c02-l01.v1.json |
| B2.C02.L01.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l01.v1.json |
| B2.C02.L01.A01.S05 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c02-l01.v1.json |
| B2.C02.L01.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l01.v1.json |
| B2.C02.L01.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l01.v1.json |
| B2.C02.L01.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l01.v1.json |
| B2.C02.L01.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l01.v1.json |
| B2.C02.L01.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l01.v1.json |
| B2.C02.L02.A01.S01 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A01.S03 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A01.S05 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A01.S08 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A01.S10 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L02.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l02.v1.json |
| B2.C02.L03.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c02-l03.v1.json |
| B2.C02.L03.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l03.v1.json |
| B2.C02.L03.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l03.v1.json |
| B2.C02.L03.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l03.v1.json |
| B2.C02.L03.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l03.v1.json |
| B2.C02.L03.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l03.v1.json |
| B2.C02.L03.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l03.v1.json |
| B2.C02.L03.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l03.v1.json |
| B2.C02.L03.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l03.v1.json |
| B2.C02.L03.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l03.v1.json |
| B2.C02.L04.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c02-l04.v1.json |
| B2.C02.L04.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l04.v1.json |
| B2.C02.L04.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l04.v1.json |
| B2.C02.L04.A01.S04 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c02-l04.v1.json |
| B2.C02.L04.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l04.v1.json |
| B2.C02.L04.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l04.v1.json |
| B2.C02.L04.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l04.v1.json |
| B2.C02.L04.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l04.v1.json |
| B2.C02.L04.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l04.v1.json |
| B2.C02.L04.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l04.v1.json |
| B2.C02.L05.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c02-l05.v1.json |
| B2.C02.L05.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l05.v1.json |
| B2.C02.L05.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l05.v1.json |
| B2.C02.L05.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l05.v1.json |
| B2.C02.L05.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l05.v1.json |
| B2.C02.L05.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l05.v1.json |
| B2.C02.L05.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l05.v1.json |
| B2.C02.L05.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l05.v1.json |
| B2.C02.L05.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l05.v1.json |
| B2.C02.L05.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l05.v1.json |
| B2.C02.L06.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l06.v1.json |
| B2.C02.L06.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l06.v1.json |
| B2.C02.L06.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l06.v1.json |
| B2.C02.L06.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l06.v1.json |
| B2.C02.L06.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l06.v1.json |
| B2.C02.L06.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l06.v1.json |
| B2.C02.L06.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l06.v1.json |
| B2.C02.L06.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l06.v1.json |
| B2.C02.L06.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l06.v1.json |
| B2.C02.L07.A01.S01 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S03 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S06 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S08 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S12 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A01.S13 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.L07.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-l07.v1.json |
| B2.C02.CP.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S13 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S14 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S15 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S16 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S17 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S18 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S19 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C02.CP.A01.S20 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c02-cp.v1.json |
| B2.C03.L01.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c03-l01.v1.json |
| B2.C03.L01.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l01.v1.json |
| B2.C03.L01.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l01.v1.json |
| B2.C03.L01.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l01.v1.json |
| B2.C03.L01.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l01.v1.json |
| B2.C03.L01.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l01.v1.json |
| B2.C03.L01.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l01.v1.json |
| B2.C03.L01.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l01.v1.json |
| B2.C03.L02.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c03-l02.v1.json |
| B2.C03.L02.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l02.v1.json |
| B2.C03.L02.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l02.v1.json |
| B2.C03.L02.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l02.v1.json |
| B2.C03.L02.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l02.v1.json |
| B2.C03.L02.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l02.v1.json |
| B2.C03.L02.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l02.v1.json |
| B2.C03.L02.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l02.v1.json |
| B2.C03.L02.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l02.v1.json |
| B2.C03.L03.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l03.v1.json |
| B2.C03.L03.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l03.v1.json |
| B2.C03.L03.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l03.v1.json |
| B2.C03.L03.A01.S04 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c03-l03.v1.json |
| B2.C03.L03.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l03.v1.json |
| B2.C03.L03.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l03.v1.json |
| B2.C03.L03.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l03.v1.json |
| B2.C03.L03.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l03.v1.json |
| B2.C03.L03.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l03.v1.json |
| B2.C03.L03.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l03.v1.json |
| B2.C03.L03.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l03.v1.json |
| B2.C03.L03.A02.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c03-l03.v1.json |
| B2.C03.L03.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l03.v1.json |
| B2.C03.L03.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l03.v1.json |
| B2.C03.L03.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l03.v1.json |
| B2.C03.L04.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A01.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L04.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l04.v1.json |
| B2.C03.L05.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l05.v1.json |
| B2.C03.L05.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l05.v1.json |
| B2.C03.L05.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l05.v1.json |
| B2.C03.L05.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l05.v1.json |
| B2.C03.L05.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l05.v1.json |
| B2.C03.L05.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l05.v1.json |
| B2.C03.L05.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l05.v1.json |
| B2.C03.L05.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l05.v1.json |
| B2.C03.L06.A01.S01 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A01.S03 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A01.S06 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A01.S08 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A01.S10 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.L06.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-l06.v1.json |
| B2.C03.CP.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S13 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S14 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S15 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S16 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S17 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S18 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S19 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C03.CP.A01.S20 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c03-cp.v1.json |
| B2.C04.L01.A01.S01 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A01.S07 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L01.A02.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l01.v1.json |
| B2.C04.L02.A01.S01 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A01.S04 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A01.S08 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A02.S01 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A02.S05 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L02.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l02.v1.json |
| B2.C04.L03.A01.S01 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L03.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l03.v1.json |
| B2.C04.L04.A01.S01 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A01.S03 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A01.S05 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A01.S08 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A01.S10 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L04.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l04.v1.json |
| B2.C04.L05.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.L05.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.L05.A01.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.L05.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.L05.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.L05.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.L05.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.L05.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.L05.A02.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.L05.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.L05.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.L05.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.L05.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.L05.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.L05.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.L05.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-l05.v1.json |
| B2.C04.CP.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S13 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S14 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S15 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S16 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S17 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S18 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S19 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C04.CP.A01.S20 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c04-cp.v1.json |
| B2.C05.L01.A01.S01 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A01.S05 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A01.S08 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A02.S01 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A02.S03 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A02.S05 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L01.A02.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l01.v1.json |
| B2.C05.L02.A01.S01 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S03 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S07 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S10 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S12 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S13 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A01.S14 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L02.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l02.v1.json |
| B2.C05.L03.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A01.S07 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A01.S13 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L03.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l03.v1.json |
| B2.C05.L04.A01.S01 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L04.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L04.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L04.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L04.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L04.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L04.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L04.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L04.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L04.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L04.A02.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L04.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L04.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L04.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L04.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L04.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l04.v1.json |
| B2.C05.L05.A01.S01 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A01.S06 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A01.S08 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.L05.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-l05.v1.json |
| B2.C05.CP.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S13 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S14 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S15 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S16 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S17 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S18 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S19 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C05.CP.A01.S20 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c05-cp.v1.json |
| B2.C06.L01.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A01.S02 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A01.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A01.S04 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A01.S05 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A01.S06 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L01.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l01.v1.json |
| B2.C06.L02.A01.S01 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l02.v1.json |
| B2.C06.L02.A01.S02 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l02.v1.json |
| B2.C06.L02.A01.S03 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l02.v1.json |
| B2.C06.L02.A01.S04 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l02.v1.json |
| B2.C06.L02.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l02.v1.json |
| B2.C06.L02.A01.S06 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l02.v1.json |
| B2.C06.L02.A01.S07 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l02.v1.json |
| B2.C06.L02.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l02.v1.json |
| B2.C06.L03.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A01.S02 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A01.S04 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A01.S06 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A01.S07 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A01.S08 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A01.S09 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A01.S10 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A02.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A02.S02 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A02.S03 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A02.S05 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A02.S06 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A02.S07 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L03.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l03.v1.json |
| B2.C06.L04.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A01.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A01.S05 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A01.S07 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A01.S09 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A01.S10 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A02.S02 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A02.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A02.S04 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A02.S07 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L04.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l04.v1.json |
| B2.C06.L05.A01.S01 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A01.S02 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A01.S03 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A01.S04 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A01.S07 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A01.S08 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A01.S10 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A02.S01 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A02.S02 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A02.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A02.S04 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A02.S05 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A02.S06 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A02.S08 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A02.S09 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L05.A02.S10 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l05.v1.json |
| B2.C06.L06.A01.S01 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l06.v1.json |
| B2.C06.L06.A01.S02 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l06.v1.json |
| B2.C06.L06.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l06.v1.json |
| B2.C06.L06.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l06.v1.json |
| B2.C06.L06.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l06.v1.json |
| B2.C06.L06.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l06.v1.json |
| B2.C06.L06.A01.S07 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l06.v1.json |
| B2.C06.L06.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l06.v1.json |
| B2.C06.L06.A02.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c06-l06.v1.json |
| B2.C06.L06.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l06.v1.json |
| B2.C06.L06.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l06.v1.json |
| B2.C06.L06.A02.S04 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c06-l06.v1.json |
| B2.C06.L06.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l06.v1.json |
| B2.C06.L06.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l06.v1.json |
| B2.C06.L06.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-l06.v1.json |
| B2.C06.CP.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S13 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S14 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S15 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S16 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S17 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S18 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S19 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C06.CP.A01.S20 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c06-cp.v1.json |
| B2.C07.L01.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A01.S02 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A01.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A01.S05 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A01.S06 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A01.S07 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A01.S08 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A01.S09 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A01.S10 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A02.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A02.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A02.S04 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A02.S06 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A02.S07 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L01.A02.S08 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l01.v1.json |
| B2.C07.L02.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A01.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A01.S04 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A01.S05 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A01.S07 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A01.S08 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A01.S09 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A02.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A02.S02 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A02.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A02.S05 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A02.S06 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A02.S07 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A02.S08 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L02.A02.S09 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l02.v1.json |
| B2.C07.L03.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A01.S02 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A01.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A01.S05 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A01.S06 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A01.S07 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A01.S08 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A01.S09 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A01.S10 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A02.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A02.S02 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A02.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A02.S04 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A02.S05 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A02.S06 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A02.S08 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A02.S09 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L03.A02.S10 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l03.v1.json |
| B2.C07.L04.A01.S01 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A01.S02 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A01.S03 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A01.S04 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A01.S05 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A01.S06 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A01.S07 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A01.S08 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A01.S09 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A01.S10 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A02.S02 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A02.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A02.S05 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A02.S06 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A02.S07 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A02.S08 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A02.S09 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L04.A02.S10 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l04.v1.json |
| B2.C07.L05.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A01.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A01.S04 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A01.S05 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A01.S07 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A01.S08 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A01.S09 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A01.S10 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A02.S02 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A02.S03 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A02.S05 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A02.S06 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A02.S07 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.L05.A02.S08 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c07-l05.v1.json |
| B2.C07.CP.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S13 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S14 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S15 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S16 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S17 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S18 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S19 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C07.CP.A01.S20 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c07-cp.v1.json |
| B2.C08.L01.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L01.A02.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l01.v1.json |
| B2.C08.L02.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L02.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l02.v1.json |
| B2.C08.L03.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L03.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l03.v1.json |
| B2.C08.L04.A01.S01 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A01.S03 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A01.S05 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A01.S07 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A01.S09 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L04.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l04.v1.json |
| B2.C08.L05.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L05.A02.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l05.v1.json |
| B2.C08.L06.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l06.v1.json |
| B2.C08.L06.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l06.v1.json |
| B2.C08.L06.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l06.v1.json |
| B2.C08.L06.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l06.v1.json |
| B2.C08.L06.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l06.v1.json |
| B2.C08.L06.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l06.v1.json |
| B2.C08.L06.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l06.v1.json |
| B2.C08.L06.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l06.v1.json |
| B2.C08.L06.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l06.v1.json |
| B2.C08.L07.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l07.v1.json |
| B2.C08.L07.A01.S02 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c08-l07.v1.json |
| B2.C08.L07.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l07.v1.json |
| B2.C08.L07.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l07.v1.json |
| B2.C08.L07.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l07.v1.json |
| B2.C08.L07.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l07.v1.json |
| B2.C08.L07.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l07.v1.json |
| B2.C08.L07.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l07.v1.json |
| B2.C08.L07.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l07.v1.json |
| B2.C08.L07.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-l07.v1.json |
| B2.C08.CP.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S13 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S14 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S15 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S16 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S17 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S18 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S19 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C08.CP.A01.S20 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c08-cp.v1.json |
| B2.C09.L01.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L01.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l01.v1.json |
| B2.C09.L02.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L02.A02.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l02.v1.json |
| B2.C09.L03.A01.S01 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A01.S03 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A01.S05 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A01.S07 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A01.S09 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L03.A02.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l03.v1.json |
| B2.C09.L04.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L04.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l04.v1.json |
| B2.C09.L05.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L05.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L05.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L05.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L05.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L05.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L05.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L05.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L05.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L05.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L05.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L05.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L05.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L05.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L05.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L05.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l05.v1.json |
| B2.C09.L06.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L06.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l06.v1.json |
| B2.C09.L07.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l07.v1.json |
| B2.C09.L07.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l07.v1.json |
| B2.C09.L07.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l07.v1.json |
| B2.C09.L07.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l07.v1.json |
| B2.C09.L07.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l07.v1.json |
| B2.C09.L07.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l07.v1.json |
| B2.C09.L07.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l07.v1.json |
| B2.C09.L07.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l07.v1.json |
| B2.C09.L08.A01.S01 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A01.S05 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A01.S07 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A01.S09 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A02.S01 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.L08.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-l08.v1.json |
| B2.C09.CP.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S13 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S14 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S15 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S16 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S17 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S18 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S19 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C09.CP.A01.S20 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c09-cp.v1.json |
| B2.C10.L01.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L01.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l01.v1.json |
| B2.C10.L02.A01.S01 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A01.S04 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A01.S05 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A01.S07 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A01.S09 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A01.S11 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A02.S02 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A02.S03 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A02.S04 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A02.S05 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L02.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l02.v1.json |
| B2.C10.L03.A01.S01 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A01.S02 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A01.S04 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A01.S05 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A01.S06 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A01.S07 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A01.S09 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A01.S10 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A02.S03 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A02.S04 | unknown | ambiguous | needs_review | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L03.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l03.v1.json |
| B2.C10.L04.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l04.v1.json |
| B2.C10.L04.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l04.v1.json |
| B2.C10.L04.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l04.v1.json |
| B2.C10.L04.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l04.v1.json |
| B2.C10.L04.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l04.v1.json |
| B2.C10.L04.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l04.v1.json |
| B2.C10.L04.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l04.v1.json |
| B2.C10.L04.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l04.v1.json |
| B2.C10.L05.A01.S01 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A01.S03 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A01.S06 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A01.S08 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A02.S01 | kanji_or_language_asset | None (illustrative) | language_reference_not_lesson_artwork | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L05.A02.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l05.v1.json |
| B2.C10.L06.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L06.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l06.v1.json |
| B2.C10.L07.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L07.A02.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l07.v1.json |
| B2.C10.L08.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A02.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A02.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A02.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A02.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A02.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A02.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A02.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A02.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L08.A02.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l08.v1.json |
| B2.C10.L09.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l09.v1.json |
| B2.C10.L09.A01.S02 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c10-l09.v1.json |
| B2.C10.L09.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l09.v1.json |
| B2.C10.L09.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l09.v1.json |
| B2.C10.L09.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l09.v1.json |
| B2.C10.L09.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l09.v1.json |
| B2.C10.L09.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l09.v1.json |
| B2.C10.L09.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l09.v1.json |
| B2.C10.L09.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l09.v1.json |
| B2.C10.L09.A01.S10 | lesson_generated_video | video | pending_generation | apps/web/content/busuu/b2-c10-l09.v1.json |
| B2.C10.L09.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l09.v1.json |
| B2.C10.L09.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l09.v1.json |
| B2.C10.L09.A01.S13 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-l09.v1.json |
| B2.C10.CP.A01.S01 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S02 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S03 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S04 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S05 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S06 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S07 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S08 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S09 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S10 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S11 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S12 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S13 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S14 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S15 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S16 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S17 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S18 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S19 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
| B2.C10.CP.A01.S20 | no_generated_media_requirement | None (illustrative) | not_required | apps/web/content/busuu/b2-c10-cp.v1.json |
