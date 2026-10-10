# Current handoff

## Latest: Graphite theme and Dock shell (10 October 2026)
- Whole app restyled to the owner-approved "ani語 Graphite" direction: graphite grounds (Graphite/Slate/Charcoal, chevron picker) saved separately from the five re-tuned accents (theme button), Dock navigation, new Home at `/`, Scene library moved to `/library`, Busuu course and lessons dark (colour/type only; behaviour, events, packs unchanged).
- Spec, mockup and report: `planning/2026-10-10-graphite-theme/` (`SPEC.md`, `mockup/`, `COMPLETION.md`, `course-after/`). Product context for the Impeccable design plugin: `PRODUCT.md` (repo root).
- Checks: tsc clean, 328/328 tests, lint 0 errors / 13 warnings. Backup of the pre-change source: `backups/2026-10-10-pre-graphite-apps-web.tgz`.
- `next build` passed on 11 October 2026 (Next.js 16.2.10, 20/20 static pages, 24 routes; only Node DEP0205 warnings). Pending: owner runs the ramen-scene 早い SQL given in chat.

## Latest: kanji animator replaced (10 October 2026)
- The kanji tile now uses the new engine at `C:/Users/alans/Documents/Kanji Animator New` (AnimCJK brush artwork, Arphic Public License, all 2,136 Jōyō kanji). Owner decision: it replaces the Noto/KanjiVG animator entirely. Everything about generators, R2, v2/v3/v4 styles and withdrawn kanji below is historical.
- `apps/web/scripts/sync-kanji-animator.mjs` (rewritten) copies `src/` into `lib/kanji-animator/` and bundles geometry for the kanji on kanji screens in `content/busuu` (55 now, 4.9 MB) into `public/kanji/animcjk-brush-v1/`, plus `manifest.json` (`defaultStyle: animcjk-brush-v1`) and licence notices. Rerun after adding kanji screens; `--check` verifies.
- `lib/busuu/kanji-animation.ts`: bundled `/kanji/` only (the R2 base URL is gone), cache `course-kanji-brush-v1`; a manifest for any other style supports nothing. The adapter drops the engine's hover `<title>`.
- Removed: `scripts/upload-kanji-r2.mjs`, `scripts/kanji-withdrawn.json`, `.kanji-r2-state.json`, the Noto v2 to v4 folders and the KanjiVG/Noto notices in `public/kanji`. The `kanji-preview` launch entry now serves the new engine's demo.
- Checks: 321/321 app tests (kanji 19/19), tsc clean, sync `--check` in sync; local walkthrough (port 3100) shows 参 animating with no runtime errors.
- Cleanup (10 October 2026): removed unused `public/test.mp3`, the five Next.js starter SVGs in `public/`, and `.playwright-mcp/`. Added a root `.gitignore`. R2: 2,145 old kanji objects (v2 2,117, v3 20, 8 notices/manifest) are listed in `planning/r2-kanji-cleanup/keys.txt`. The owner runs `delete-old-kanji.mjs` there (the delete was blocked for agents). The bucket's other 14 objects are not kanji and stay.
- Owner to-dos: the Vercel env var `NEXT_PUBLIC_KANJI_BASE_URL` and the R2 `kanji/` prefix are now unused and can be deleted. Production gets the new animation on the next deploy. The Arphic licence asks for visible AnimCJK credit; the learner UI has none yet (same open item as before).

## Latest completed batch: B2 polish (8 October 2026)
B2 now follows Busuu's Learn layout and behaviour: map, launch, lesson shell, grading triggers, feedback sheet, retries, results and audio player. Colours stay app-owned. The batch also delivered whole-lesson TTS prefetch with a persistent cache, and a content-text pass: 70 of 73 records have new versions, the registry holds 145 versions, and all 75 earlier versions are byte- and fingerprint-identical. Event, state and result shapes are unchanged, and old attempts replay identically.

Final checks:
- 292/292 tests pass.
- tsc is clean.
- Lint: 0 errors / 17 warnings.
- The hosted dev-account check passed.
- `next build` passed on 8 October 2026 after the kanji sync (Next.js 16.2.10, 18/18 static pages, 22 routes; only Node DEP0205 deprecation warnings).

Full report: apps/web/content/busuu/b2-polish/COMPLETION.md. Pack details: apps/web/content/busuu/README.md (top section) and b2-polish/pack-text-changes.md.

Owner decisions this batch:
- Australian English in learner copy.
- Readings run together, keeping katakana words as katakana.
- Listening can be answered without playing the audio.
- Layout matches Busuu, with the app's colours.

Owner standing preferences:
- Check the existing research docs and evidence before any expensive capture.
- Sample only unique Busuu screens and behaviours.

## Follow-up: kanji screen (8 October 2026)
The shared kanji screen now follows Busuu's arrangement: a "Look, a new kanji!" heading, a static white glyph on a teal tile used as the media, readings and meaning beneath it, then an EXAMPLE block (speaker button, word (reading) list, meanings). The change is presentation-only, and the packs, versions and fingerprints are untouched. Kanji TTS now reads the example words (`getAudioScript`/`getAudioReading` in content-readiness.ts). The shape note, reading notes and example sentences stay in the packs but are no longer displayed. Checks: 293/293 tests, tsc clean, lint 0 errors / 17 warnings. Screenshots: b2-polish/kanji-screen-desktop.png and kanji-screen-mobile.png. The stroke animation followed on 9 October (see below).
Second follow-up:
- 参 (B2.C02.L02) gained a third example, お墓参り. The word list comes from an owner screenshot; the sentence is authored. It shipped as new version b2-c02-l02.v3.json (1.2.0), so the registry holds 146 versions. v2 is pinned in b2-polish/pack-followups.json.
- Word-list audio now plays one clip per item with an 800 ms gap (`WORD_GAP_MS`, `playSequence`, `splitAudioList`). This covers kanji examples and the spaced ／ or → list screens: C05.L02.S14, C10.L07.S01, C10.L09.S07 (feedback only) and C10.L01 S06/S09/S10. If the item and reading counts differ, playback falls back to a single clip.
- Checks: 299/299 tests, tsc clean, lint 0 errors / 17 warnings.
- Kanji tile player: the tile has its own player (play, track, speed) below the glyph with no overlap. Its source playback autoplays the kanji readings, using `getKanjiReadingClips` (the hyphen is dropped and readings split on ・) with an 800 ms gap. The EXAMPLE speaker plays the example words on demand (`getKanjiExamplesPlayback`, `EXAMPLE_GAP_MS` 500). Only one of the two plays at a time. The tile exposes `data-audio-state` for the future stroke animation. Checks: 301/301 tests, tsc clean, lint 0 errors / 17 warnings.
- Kanji examples are synced to Busuu (8 October 2026): all 55 kanji screens use Busuu's meanings, hiragana readings and example lists. Eleven records gained new versions (B2.C02.L02 1.3.0; ten others 1.2.0), the registry holds 157 versions, and 43 new example words have app-authored sentences. Checks: 302/302 tests, tsc clean, lint 0 errors / 17 warnings. Details: apps/web/content/busuu/README.md (top section) and b2-polish/COMPLETION.md.

## Follow-up: kanji stroke animation (9 October 2026)
- The kanji tile now animates the glyph with the Kanji Stroke Animation Engine (C:\Users\alans\Documents\Kanji Animator): Noto Sans JP Regular outlines, KanjiVG stroke order. Presentation-only: no pack, version, fingerprint, event, state or persistence change.
- App files: `components/busuu/KanjiAnimation.tsx` (adapter), `lib/busuu/kanji-playback-sync.ts` (play/pause rules), `lib/busuu/kanji-animation.ts` (loader, manifest filter, silent preload), `LessonScreen.tsx` `KanjiStage`, one preload `useEffect` appended at the end of `LessonRunner` hooks, `runner.module.css`. Engine runtime vendored byte-identical in `lib/kanji-animator/src/` (plus a bundler stub `lib/kanji-animator/data/kanji/index.js`); geometry and licence notices in `public/kanji/`. `proxy.ts` excludes `kanji/` from auth (public geometry only); eslint ignores `lib/kanji-animator/**`.
- Behaviour: the tile starts as an empty outline; whenever the readings playback starts (autoplay or the play button) the animation restarts; pausing pauses both; the animation finishes on its own if the TTS ends first. The EXAMPLE speaker does not animate. Owner decision: the TTS speed control does not change the stroke speed. Reduced motion: autoplay shows completed ink, a press animates. Characters without geometry, or any load failure, show the static glyph.
- Stroke data: owner decision, regions are generated, not hand-traced. In the Kanji Animator project, `node scripts/kanji-pipeline.mjs --file data/lists/b2.txt` fetches KanjiVG, generates Noto stroke regions, compiles and checks every character, and writes `data/reports/generation-report.json`; flagged characters stay out of the manifest. Then `node scripts/sync-kanji-animator.mjs` (from apps/web) copies the runtime and geometry into the app (`--check` reports drift).
- Coverage: 62 characters shipped (11 original hand-annotated plus 51 generated). 51 of 55 B2 kanji animate; 優 堂 確 観 are flagged and show the static glyph. A 200-kanji random Jōyō stress test passed 174 (87%); the main failure is KanjiVG/Noto form mismatch (two KanjiVG strokes drawn as one Noto stroke).
- Checks: 318/318 tests, tsc clean, lint 0 errors / 17 warnings; engine suites pass (91 unit, browser 1,768 checks, Noto 6,792 checks); the 11 original geometry files are byte-identical. Verified in the local walkthrough on B2.C02.L02: 参 animates on play with no new console errors.
- Attribution: KanjiVG is CC BY-SA 3.0 and Noto is OFL; notices ship in `public/kanji/`. No visible credit line in learner UI (learner text never names sources); a credits page would be needed before any distribution.

## Follow-up: kanji data on R2, fixed stroke order (10 October 2026)
- Owner review found 堂 animating in the wrong stroke order (⺌'s dots took the 冖 bar). Cause: the generator aligned KanjiVG to Noto with one transform per character, and KanjiVG proportions differ from Noto's. Fix (Kanji Animator `scripts/stroke-fit.mjs` `alignComponents`): each KanjiVG component and stroke gets its own scale/offset, chosen so the strokes together cover the ink once. The order check (`scripts/order-check.mjs`) now uses that alignment plus a best one-to-one pairing test, and catches the old 堂. Generation runs on worker threads with a per-kanji time limit (`scripts/generator-pool.mjs`).
- Results: B2 55/55 animate; Jōyō 2,107/2,136 (98.6%). 29 are held back and show the static glyph: 准 姉 粉 (time limit), 向 層 御 愁 撃 箇 箋 籠 鈍 鬱 (shape mismatch), 恥 武 滅 秘 訴 雲 髄 奪 敷 薫 譲 (unclear ink ownership), 壌 奈 奴 嫌 (order check), 浸 (compile error). Orchestrator reviewed stroke-order contact sheets for all 55 B2 and 60 sampled Jōyō kanji.
- Data format: compact schema 4 (`noto-sans-jp-regular-v2`, about 10 KB per kanji). The app reads it from `NEXT_PUBLIC_KANJI_BASE_URL` (set in Vercel to https://pub-658953925075462392a8d9c2f3decc97.r2.dev/kanji/), falling back to the bundled B2 set in `public/kanji/`. Cache name `course-kanji-v2`.
- R2: 2,115 files (manifest, 2,107 kanji, 7 notices; 21.6 MB) uploaded on 10 October 2026 with owner approval to bucket `japanese-media`, prefix `kanji/`, via `apps/web/scripts/upload-kanji-r2.mjs` (uses the owner's `wrangler login`; never handles keys). Kanji files are cached for a year as immutable: never change an uploaded file; any geometry change needs a new style folder and cache name. Adding newly passing kanji is safe. Source upload folder: `C:\Users\alans\Documents\Kanji Animator\work\joyo2-v2`. CORS allows the Vercel origin and localhost:3000/3100.
- Checks: app 320/320 tests, tsc clean; engine unit 108/108, browser 1,930, regressions 3, compact 5,127, Noto fill 7,532; Jōyō sample 19,444/19,445 (one pixel at a sweep detour turnaround in 彙 stroke 7, invisible, a renderer limit). 堂 verified on the real lesson screen (B2.C09.L08).
- Owner to do: redeploy on Vercel so production uses R2.

## Follow-up: held-back Jōyō kanji (10 October 2026, later)
- 12 of the 29 held-back Jōyō kanji now animate correctly. They are prepared but NOT uploaded:
  - default generator: 准 奈 姉 浸 粉;
  - opt-in wide fit, each one reviewed: 壌 武 滅 秘 籠;
  - reviewed guide-level hand annotations in Kanji Animator `data/fonts/noto-strokes.json`: 雲 向.
  Once uploaded, Jōyō coverage is 2,119/2,136. Still held back (static glyph): 撃 嫌 層 奪 御 恥 愁 敷 箇 箋 薫 訴 譲 鈍 髄 鬱 奴.
- Generator fixes in Kanji Animator (details in docs/GENERATOR.md):
  - `scripts/polygon-clipping.mjs` patches polygon-clipping 0.15.7 at load time. The sweep line's prev/next walk cycled forever; this was the 准 姉 粉 "time limit". The patch also adds a per-family deadline, and resets segment ids during generation so results no longer depend on worker history.
  - Each fit family has its own time budget (`GEN_ALIGNED_MS` 240 s; pool `GEN_TIMEOUT_MS` 900 s), so a slow family falls through to the next one inside the same worker.
  - Contours are nested by orientation (fixes 奈), and `dilate` retries a collapsed union (fixes 浸).
  - New general check `split-stroke`: a stroke may own separated ink only where earlier ink joins it.
- The wide fit (`GEN_WIDE=1`) is opt-in. Of the 9 kanji it passed, 4 were wrong (撃 嫌 層 奪). The new gates reject 嫌 奪, and 層 御 no longer pass, but 撃 still passes every automatic check. Every wide result must be reviewed on a contact sheet.
- Verification of the 12. The orchestrator reviewed every stroke-by-stroke contact sheet against KanjiVG order. Results: order-check 12/12 including the split test; browser-noto 1,625 checks across 133 strokes; engine unit tests 108/108; Noto regressions 3/3; compact check clean. The 12 files rebuild byte for byte from the repository.
- **Finding:** the split-stroke audit shows that 36 of the 2,096 generated kanji already on R2 have a stroke that owns a fragment of another stroke's ink: 備 優 堀 妙 密 履 怨 憶 械 毒 漆 爆 献 留 砂 窮 範 総 縦 繁 聴 脅 臆 船 蔽 誓 講 謝 警 護 豪 費 鍛 随 隠 露. 優 is a B2 kanji. All seven sampled cases are real. R2 geometry is immutable, so the fix is either a new style folder or dropping them from the manifest (owner decision).
- Upload prepared:
  - The 12 compact files were copied into `C:\Users\alans\Documents\Kanji Animator\work\joyo2-v2` and its manifest merged (2,107 to 2,119). The previous manifest is kept as `work/joyo2-v2-manifest.before-2026-10-10b.json`.
  - Dry run (`node scripts/upload-kanji-r2.mjs --from <joyo2-v2> --dry-run`, run from apps/web): 13 uploads (12 new geometry files and manifest.json), 2,114 unchanged. Uploaded on 10 October 2026 with owner approval: 13 uploaded, 0 failed, 2,114 skipped. The public manifest lists 2,119 kanji, and spot-checked files match byte for byte with immutable caching.
  - The app needs the manifest update to use the new kanji (the manifest has a 5-minute cache).

## Follow-up: re-issued kanji, style v3 (10 October 2026, latest)
- 20 of the 36 withdrawn kanji were regenerated, reviewed and re-issued under the new style folder `noto-sans-jp-regular-v3`: 優 堀 妙 密 履 憶 械 毒 漆 留 砂 窮 総 聴 蔽 講 護 費 隠 露. They were uploaded on 10 October 2026 with owner approval.
- 16 stay withdrawn and keep the static glyph: 備 怨 爆 献 範 縦 繁 脅 臆 船 誓 謝 警 豪 鍛 随. Thirteen fail the split-stroke check and 警 has an area mismatch. 範 and 繁 pass every automatic check but are wrong on the contact sheet: in 範 the ⺮ bar owns the dot, and in 繁 strokes 3 and 4 own the ends of 毎's long bar. No hand annotations or wide fit were used.
- Evidence (Kanji Animator):
  - Default-fit run in `work/redo36`: 22 pass, 14 flagged (`work/redo36-run.log`, `work/redo36/data/reports/generation-report.json`).
  - Order check including the split test: 20/20 clean.
  - browser-noto on the compact build: 3,333 checks across 274 strokes (`work/redo36-v2test`, which is the same geometry with `t` = v2, plus 一 and 語).
  - The orchestrator reviewed a stroke-by-stroke contact sheet for each of the 22 against KanjiVG order. The sheets show earlier ink grey, the current stroke red, the KanjiVG guide and start point in blue, and the fitted guide in green.
- Owner-approved design (10 October 2026):
  - The engine registers `noto-sans-jp-regular-v3` (`REISSUE_GEOMETRY_STYLE`), and compact schema 4 accepts `t` v2 or v3.
  - The manifest gains `styles: {"noto-sans-jp-regular-v3": [...]}`. Re-issued kanji are NOT in `characters`, so older app builds keep the static glyph.
  - `lib/busuu/kanji-animation.ts` (`parseKanjiManifest`, `kanjiRuntime.styles()`) passes each character's `geometryStyle` to preload and to `KanjiAnimator`.
  - The cache name stays `course-kanji-v2` (the cache is keyed by URL and v3 has its own folder). The 2,083 v2 kanji are unchanged.
- Tools:
  - `make-upload-folder.mjs --style`, `compact-format.mjs --style`, and the new `add-reissued.mjs`.
  - Reviewed assets live in Kanji Animator `data/reissued/`.
  - `sync-kanji-animator.mjs` bundles re-issued kanji that are in the bundled set: `public/kanji` now has `noto-sans-jp-regular-v3/0512a.json` (優) and `styles` in its manifest.
  - `kanji-withdrawn.json` now lists only the 16.
- Upload prepared:
  - Upload folder `Kanji Animator/work/joyo2-v2`: 20 new v3 files, and the manifest gains `styles` with `characters` unchanged (2,083). The previous manifest is `work/joyo2-v2-manifest.before-v3.json`.
  - Dry run: 21 uploads (20 `noto-sans-jp-regular-v3/*.json` plus `manifest.json`), 2,126 unchanged. Uploaded with owner approval: 21 uploaded, 0 failed. The live manifest has 2,083 `characters` plus 20 under `styles`; a spot-checked v3 file matches byte for byte with immutable caching.
  - After upload and redeploy, 2,103 of 2,136 Jōyō kanji animate.
- Checks: app 323/323 tests (including 4 new kanji style tests), tsc clean, eslint clean on the changed files; `sync-kanji-animator.mjs --check` in sync; engine unit 109/109 (one new v3 loader test), compact check up to date (66), Noto regressions 3/3; the vendored engine loads v3 優 and v2 参 from `public/kanji`. `next build` was not run.
- Follow-up worth considering: the contact-sheet findings in 範 and 繁 are not caught by any automatic check. A check for "an earlier crossing stroke owns another stroke's tip" could be built, and the v2 set audited with it.

## Follow-up: ownership audit (10 October 2026, latest)
- The owner approved the follow-up and then chose "A + B": B audits now with round caps treated as a known limit, and A fixes the round caps and regenerates.
- **露 (v3)** was found defective in playback by the owner. The orchestrator session removed it from the v3 `styles` and the withdrawn list; that manifest upload is pending owner approval.
- **New automatic check `foreign-reach`** (Kanji Animator `scripts/order-check.mjs` `foreignReach`, generator flag `foreign-reach`; general, no per-character parameters). It flags a stroke owning ink that lies on another stroke's KanjiVG guide, away from its own fitted guide.
- **Calibration:** flags 範, 繁, 窮 and 籠, and nothing in the hand/B2 set except the old v2 優.
- **Accuracy:** about 24% of its flags are false positives (KanjiVG proportions), and it misses small cases (算), so flags are screened for review rather than trusted on their own.
- **B results** (full report, evidence and tools: `Kanji Animator/work/audit-2026-10-10/REPORT.md`):
  - Shipped v2 set, confirmed defects not yet withdrawn (28): 箸 節 筋 築 簿 籍 笑 量 宴 鼻 壇 膚 彙 遣 矯 藍 驚 歓 憂 兼 廉 号 神 慶 射 庸 算 熊. 射 and 熊 are minor; 偽 is doubtful. 暑 (B2, bundled) has a minor wavy cut at its ノ crossing.
  - Uploaded on 10 October: 窮 (v3) and 籠 have order defects of the 範 kind. 雲, 蔽 and 向 have minor ones. All other v3 kanji and the earlier 12 show only round caps.
  - Slivers and notches have no reliable automatic check yet. They were reviewed on the 31 uploaded kanji only.
- **Not changed:** nothing on R2, `kanji-withdrawn.json` and the manifests. The owner decides whether to withdraw now.
- **Reproducibility:** generation under heavy CPU load can change geometry, not only pass/fail (this corrects GENERATOR.md). Run batch A on an idle machine.
- **Batch A started:**
  - Flat tube ends: `tube(..., {flat:true})`. The generator writes `ends:"flat"` (`GEN_ENDS=round` restores round ends); the compiler honours it, and existing annotations rebuild unchanged.
  - Next: calibration and proofs for 露 留 堀 講 毒 go to the owner before the two-hour full regeneration into `noto-sans-jp-regular-v4`.

## Follow-up: flat-ended ownership, style v4 (10 October 2026, latest)
- **Fix (batch A):** an earlier stroke that ends on a later stroke no longer owns a half-disc of it (Kanji Animator `stroke-ownership.mjs` flat tube ends; generator flags `round-cap` and `foreign-reach`). Calibrated against the 11 hand-annotated kanji: overlap with the hand regions 95.0%, 46/47 strokes, 0 flagged. The orchestrator approved the proofs of 露 and 留 before the full run.
- **Full regeneration** (`work/joyo4`, default fits, idle machine, 101 minutes, no timeouts):
  - 2,045 of 2,123 generated kanji pass every check, and the standalone order check agrees.
  - Only kanji whose engine playback proof I reviewed ship in v4: 54 B2, the 21 now-passing withdrawn kanji and a seeded random 150.
  - 14 were doubtful (small ticks, spikes, seams) and keep their current state: 館 園 腹 確 兼 辺 還 塁 墓 蔑 抑 何 窒 架.
  - **211 ship in `noto-sans-jp-regular-v4`.**
- **Publishing, not uploaded:**
  - Upload folder `Kanji Animator/work/joyo2-v2`; the manifest gains `styles.v4` (211), and v3 drops to 16 because 憶 and 械 moved to v4. The previous manifest is `work/joyo2-v2-manifest.before-v4.json`.
  - `characters` stays at 2,054 (this includes the orchestrator's pending audit withdrawal). v4 kanji already in `characters` stay there so that builds reading only `characters` keep their v2 animation; withdrawn kanji are never in `characters`.
  - New builds animate 2,092 of 2,136 Jōyō kanji.
- **Withdrawn list:** 27 kanji (20 left it for v4): 備 怨 爆 献 縦 繁 脅 臆 船 誓 謝 警 豪 鍛 随 箸 筋 築 算 鼻 歓 憂 兼 廉 慶 窮 籠.
- **Bundled set:** `public/kanji` gains `noto-sans-jp-regular-v4/` (50 B2 kanji) in `styles`. 優 stays on v3, and 館 園 腹 確 stay on v2.
- **App and engine:** the engine and the app loader accept v4 (`KANJI_REISSUE_STYLES`; later styles win). App 323/323 tests, tsc clean; engine unit tests pass.
- **Dry run:** 212 uploads (211 `noto-sans-jp-regular-v4/*.json` plus `manifest.json`), 2,146 unchanged; saved as `Kanji Animator/work/joyo4-dryrun.txt`.
- **Next, optional:** review more of the 1,820 passing v4 kanji in batches and re-issue them the same way. 優 still fails in v4 (it stays on v3).

## Next step
1. Kanji: the 12 new kanji are uploaded. The 36 split-ownership kanji were withdrawn on 10 October 2026 (owner approved the quick fix):
   - They are listed in `apps/web/scripts/kanji-withdrawn.json`. The R2 manifest now lists 2,083 kanji and is verified live; the previous manifest is `Kanji Animator/work/joyo2-v2-manifest.before-withdrawal.json`.
   - The bundled `public/kanji/manifest.json` drops 優 (applied by `sync-kanji-animator.mjs`). It reaches production on the next redeploy.
   - Geometry files are untouched. App kanji tests pass (18/18).
   - Done 10 October 2026: 20 of them were re-issued in `noto-sans-jp-regular-v3` (see the section above). Uploaded (21 files). **Owner to redeploy on Vercel** so production gets the app's v3 support and the bundled v3 優. 16 stay withdrawn.
   - A1–B1 is on hold by owner decision.
2. Done: `next build` passed (8 October 2026, registry 157 versions).
3. The owner deletes the dev-account rows listed in COMPLETION.md.
4. Optional B2 follow-ups (see COMPLETION.md "Remaining gaps"):
   - full-sentence map subtitles;
   - pause/scrub in the audio player;
   - spacing in the TTS-only readings;
   - batched saving (this needs separate authorisation, since it changes persistence).
5. Then inspect actual A1–B1 coverage and recommend the next level batch.

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

## Correction: 露 withdrawn from v3 (10 October 2026)
- The owner found 露 (v3) defective in playback. Stroke 12 owns a round cap inside bottom bar 15, stroke 20 owns a sliver of the ㇏ tail (18), and 各's 口 builds up in fragments. Static contact-sheet review had passed it.
- Removed from the R2 manifest `styles` with owner approval; live v3 now has 19 kanji and 露 is not published. It is back in `apps/web/scripts/kanji-withdrawn.json` (17 kanji). The previous manifest is `Kanji Animator/work/joyo2-v2-manifest.before-ro-withdrawal.json`.
- **Do not redeploy** (which activates v3 in production) until the regeneration session has re-checked the 19 v3 kanji and the 12 uploaded earlier, using the new tip-ownership check plus engine playback proofs (`create-char-proof.mjs`).

## Audit B results and pending withdrawal (10 October 2026)
- The audit (`Kanji Animator/work/audit-2026-10-10/REPORT.md`) confirmed 28 order defects in the shipped v2 set, plus 窮 (v3) and 籠 (uploaded today). The orchestrator checked the 籠 evidence: the ⺮ dot is drawn with stroke 5. A new general check, `foreign-reach`, is in order-check.mjs and the generator; it is a screening aid, with 24% false positives and misses such as 算.
- The owner delegated judgement and approvals while away, except the R2 upload and the redeploy. Decision: withdraw all 30.
  - Prepared but NOT uploaded: the manifest `characters` go from 2,083 to 2,054 and v3 from 19 to 18; `apps/web/scripts/kanji-withdrawn.json` now has 47 kanji.
  - Dry run: 1 upload (manifest.json), 2,146 unchanged. The previous manifest is `work/joyo2-v2-manifest.before-audit-withdrawal.json`.
  - **The owner approves the upload on return.**
- Minor, not withdrawn: 射 熊 偽 (doubtful), 雲 蔽 向 (small bump or wedge), 暑 (B2, wavy cut). Round caps are systemic and are being fixed by batch A (flat ends, new style folder after a full regeneration on an idle machine).
- The redeploy stays on hold until A is done.
- Batch A checkpoint (10 October 2026): the flat-end fix (`tube(..., {flat:true})`, `ends:"flat"`) and a new `round-cap` check passed preview on 露 留 堀 講 毒 範 and the hand set. The orchestrator reviewed 露 and 留 proofs before and after and approved the full Jōyō regeneration into `noto-sans-jp-regular-v4` under the owner's delegation.
  - Conditions: idle machine and default fits only. A kanji ships only if every check passes AND its proof has been reviewed; that covers all B2 kanji, the withdrawn kanji that pass, every borderline kanji, and 150 or more random passes. Failures keep their current state.
  - The run stops at a dry run, and the owner approves the upload and the redeploy.
- v4 (flat ends) is NOT to be uploaded. The owner's playback review (via `Kanji Animator/work/review.html` on the kanji-preview server, port 4173) found junction defects throughout: tips trimmed, corners lost, dots stopping mid-bar, leftovers drawn into neighbours. Cause: flat ends drop a half-width at every guide end.
  - New rule, implemented by an implementer agent and not yet reviewed: free tips own their ink to the outline; a stroke ending inside another stroke's body stops at that stroke's edge, whichever is earlier; corners go to the earlier stroke; crossings go to the earlier stroke.
  - Test set in `work/junction-test`. The orchestrator reviews it before any full regeneration.
