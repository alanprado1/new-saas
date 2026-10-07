# Current handoff

## Latest completed batch: B2 polish (8 October 2026)
B2 now follows Busuu's Learn layout and behaviour: map, launch, lesson shell, grading triggers, feedback sheet, retries, results and audio player. Colours stay app-owned. The batch also delivered whole-lesson TTS prefetch with a persistent cache, and a content-text pass: 70 of 73 records have new versions, the registry holds 145 versions, and all 75 earlier versions are byte- and fingerprint-identical. Event, state and result shapes are unchanged, and old attempts replay identically.

Final checks:
- 292/292 tests pass.
- tsc is clean.
- Lint: 0 errors / 17 warnings.
- The hosted dev-account check passed.
- `next build` was NOT run (the owner's :3000 dev server was running).

Full report: apps/web/content/busuu/b2-polish/COMPLETION.md. Pack details: apps/web/content/busuu/README.md (top section) and b2-polish/pack-text-changes.md.

Owner decisions this batch:
- Australian English in learner copy.
- Readings run together, keeping katakana words as katakana.
- Listening can be answered without playing the audio.
- Layout matches Busuu, with the app's colours.

Owner standing preferences:
- Check the existing research docs and evidence before any expensive capture.
- Sample only unique Busuu screens and behaviours.

## Next step
1. Run `next build` once with the :3000 dev server stopped.
2. The owner deletes the dev-account rows listed in COMPLETION.md.
3. Optional B2 follow-ups (see COMPLETION.md "Remaining gaps"):
   - full-sentence map subtitles;
   - pause/scrub in the audio player;
   - spacing in the TTS-only readings;
   - batched saving (this needs separate authorisation, since it changes persistence).
4. Then inspect actual A1–B1 coverage and recommend the next level batch.

## Last verified milestone (historical: inspect current files before asserting current status)
All 73 canonical B2 entries across ten chapters were implemented and playable with account-owned saved progress. 1,187 required tasks plus seven optional writing endpoints; 1,117 individually documented rows plus 77 explicitly app-authored summary tasks. Registry held 75 preserved content versions. Chapter 10: 233 passing tests, 1,998 saved-path assertions, successful build/TypeScript, lint with zero errors and twelve existing warnings. No deployment or live database changes were part of the final B2 delivery. Original media remains deferred. No subsequent level has been started.

## Research package
C:/Users/alans/Documents/Codex/2026-10-03/read-c-users-alans-documents-codex/outputs/
- Master-Japanese-Course-and-Implementation-Reference.md
- Unified-Course-Inventory.json
- Unified-B2-Lesson-Records.json
- Curriculum-Concept-Catalog.json
- Busuu-UI-Interaction-Catalog.json
- Build-Readiness-and-Gaps.md
- Master-Reference-Validation.md
- Source-Manifest.json

## Other key file
planning/2026-10-03-busuu-integration/B2-Complete-Consolidated-Handoff.md
