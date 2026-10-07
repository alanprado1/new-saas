# B2 learner playthrough (local walkthrough mode, observation only)

Date 2026-10-08. Server: `node apps/web/scripts/busuu-walkthrough.mjs 3100` (stopped at the end; :3000 untouched). Browser: in-app pane, own tab; VoiceVox voice (`pref_ttsProvider=voicevox`, set on the localhost:3100 origin only). Nothing in code, CSS, packs or tests was changed.

Method notes and limits:
- The browser pane is only ~577-1000 px wide, so the 1280x800 emulation is scaled down and screenshots of it are unreadable. 1280x800 results below are **JS measurements** (element sizes/positions), not visual review. Most desktop-style screenshots were taken at the pane's own width (~577-1000 CSS px). 375x812 was emulated with the mobile preset (screenshots OK).
- Saved screenshots are in `playthrough/` (file names start with the finding class).
- TTS worked (VoiceVox). Cold first call plus long scenes meant 5-30 s waits; see finding P1-4.

## 1. Coverage

| Area | Reached | Where |
| --- | --- | --- |
| Map (/busuu/B2) | all 10 chapters, 0% start state, level selector modal (4 levels, Current tag, Escape closes), lesson popover, selected-row highlight, completed-row pill, chapter/level % after completions, 375 px (no overflow) and 1280 measurements | map |
| Launch screen + lesson start | C02.L01, C10.L06, C10.L04, C04.CP, C04.L05, C09.L02, C02.L02, C04.L04, C01.L05, C03.L01 | `/busuu/B2/lesson/<id>` |
| Regular lesson, complete | B2.C02.L01 (10 screens: teaching/model, gaps, choice, ordered_slots 1/2 gaps, truth audio-only; 3 of 7 graded correct, deliberate wrongs) | results + map |
| Activity-boundary retry | B2.C10.L06 (19 screens). A01.S01 answered wrong on purpose, S05 answered correctly (I guessed wrong how to fail it, so S05 retry NOT exercised). Retry appeared after S12 | results + map |
| Checkpoint, complete | B2.C04.CP (20 screens: gaps incl. 5-slot characters, typed x2 (one wrong, one right), ordering 3/5, transcript-free choice, supported truth) | results + map |
| Optional writing | B2.C10.L04 results card (Write a draft, hint disclosure, textarea) | results |
| Wrong-answer feedback | gaps single slot, gaps multi-slot, choice, truth, ordering, typed, pairs, multi_choice (right only) | several |
| Teaching/model | C02.L01 S1/3/5, C10.L06 table/teaching screens | |
| Dialogue (JP-only) | C04.L05 S3 (+ sceneReuse choice/gaps S4-6) | |
| Table | C10.L06 S6/S9/S16, C01.L05 S3 at 375 | |
| Kanji model | C02.L02 S1, C04.L04 S1 | |
| multi_choice (exact set) | C09.L02 S8, right answer only | |
| Pairs | C10.L06 S17, C04.L05 S2, C01.L05 S2 (375) | |
| Reload mid-lesson | C02.L01 at S10 with a half-filled 2-gap screen | resumed correctly |
| Exit mid-lesson | C02.L02 at S2 via X | |
| Keyboard | Tab/focus ring on choice, Enter on typed, number keys, Enter on teaching/choice | |
| Dark mode | emulated dark/light | |
| Mobile 375 | map, gaps, pairs, table, dialogue, sceneReuse, results not re-run | |

Not reached: dialogue with translation, `end_once` retry, C08.L06 optional writing, C01.L03 ("Hotel scene" fallback), the 4 "Listen but optional audio" screens, glued/Japanese-only prompts other than one glued prompt (C04.CP S6 "...after 勝つ. です is supplied."), wide tables other than C01.L05 S3, expanded "Documented lesson sequence"/"Source limitations" disclosures on the launch page, wrong multi_choice, wrong supported truth.

## 2. Confirmed working

- **Results screen**: shown after the last screen ("Lesson completion saved", "N of N base screens reviewed", big %, "x of y graded screens correct · server-confirmed accuracy", "Saved to your account.", Restart lesson / Return to chapter / Back to lesson details). Optional writing card sits below on C10.L04.
- **Map progress updates after return** (shared state in the walkthrough): after C02.L01 the row shows "Completed · saved · 43% accuracy", Chapter 2 = 13%, level pill 1%. After C10.L06 + C10.L04 + C04.CP: C10 = 20%, C04 = 17%, level 5%. Counts match "1 of N rows per chapter".
- **Retry** (C10.L06): after the last base screen of activity 1 (S12) the shell shows "Activity retry 1 of 1", an amber banner ("This activity's base screens are reviewed. Try this task once more; your first-attempt accuracy stays recorded separately."), the missed true/false with fresh audio, then returns to S13. Results: 79% = 11 of 14 first-attempt graded, plus "1 of 1 retry tasks correct. Retry outcomes are separate from first-attempt accuracy...". First-attempt accuracy was not changed by the retry. S19 (wrong, not an opted-in retry screen) was correctly not retried.
- **Resume**: reload during C02.L01 S10 -> launch page -> Start or resume lesson -> back on S10 with the first of two gap tokens still placed. Exit via X -> lesson details page; resume entered at the saved screen.
- Transcript-free audio-only true/false showed English statement only before answering; Japanese appeared only in feedback. Gaps/ordering/pairs/multi_choice interactions (place, return, match, exact-three set) behaved correctly. No horizontal overflow at 375 px (map, runner, table, pairs, dialogue). Focus ring is clearly visible (2.7 px dark outline). Level selector modal is fine.
- Console: only the documented 401 on `/api/worker/wake`; no app errors seen. No request other than `/api/tts`, `/api/course/attempts` after typing in the optional writing box (nothing is sent for the private draft).

## 3. Findings (ranked)

Legend: SHARED = component/CSS (no content version needed); PACK = text in a content record.

### P1 - broken or confusing

**P1-1 Typed-answer input is unreadable when the browser/OS prefers dark** (SHARED)
- Seen: B2.C10.L04 S4 (and every typed screen: C04.CP S2/S6). With prefers-color-scheme: dark the field computes `background rgb(10,10,10)` and `color rgb(30,45,64)` (dark on near-black); a typed 「を」 is almost invisible. In light scheme the same field is white and fine (C04.CP S2). The course surface itself is always white (see P2-14), so only the native control flips.
- Expected: field always white with dark text (or a real dark theme). Busuu reference does not cover typed.
- Fix: set explicit `background`, `color`, `color-scheme: light` (or reuse the writing textarea's styling, which is transparent over the white card and readable) on the typed input. Files: `components/busuu/LessonScreen.tsx` typed block + `app/busuu/runner.module.css` (`.typed*`). Screenshot: `p1-typed-input-dark-bg.jpg`.

**P1-2 Wrong answers are not clearly marked on several screen types; feedback is colour only** (SHARED)
- Single-slot gaps (C02.L01 S2 まじめ, S8 特に): the placed chip stays neutral (just a teal underline), no red, correct word not shown in the slot; only the heading "Review the answer" and the corrected sentence below. Multi-slot gaps (C10.L06 S3/S19, C04.CP S7/S12) do turn red/green per slot; choice and truth turn the picked option red; typed shows no mark on the field (C04.CP S2, C10.L04 S4; after Check the field is greyed, the Check button stays visible but disabled). In choice screens the correct option is NOT highlighted green after a miss (C02.L01 S6). Ordering paints every chunk red even where the position was right (C10.L04 S5).
- No text anywhere says "Incorrect"/"Not quite" (the live region is only "Saved to your account."), so the result is colour-only and the single-gap and typed cases have none. Heading differs ("Well done!" vs "Review the answer").
- Expected (Busuu reference not captured for feedback, see 5): clear correct/incorrect state in text and colour, correct option shown.
- Files: gaps single-slot marker and outcome class in `LessonScreen.tsx`/`runner.module.css` (slot/token result classes), outcome heading + `aria-live` status for feedback, choice correct-option highlight, typed field result class. Screenshot: `p1-wrong-single-gap-no-marker.jpg`.

**P1-3 Continue/Check is not docked; the main action is below the fold on almost every screen** (SHARED)
- Measured: `.continueRow` is `position: static`. At 577x682 Continue top = 940; at 1280x800 on C03.L01 S1 it is at y=967 (viewport 800); on the long multi_choice screen y=1253. A 16:9 "Visual placeholder" (512x288 at desktop) sits above the audio panel and pushes real content down on every model/dialogue screen, plus a 75 px status banner above the prompt and the 60 px global nav (two rows at 375).
- After answering, the feedback block appears below the answer (often off-screen) and the learner must scroll to find Continue, with no auto-scroll to feedback.
- Busuu reference: bottom bar with divider; Continue pill right-aligned 200x48, #116EEE, always visible; content column 500 px. Our button size already matches (200x48, 26 px radius, 16 px bold) but not its placement.
- Fix: sticky bottom action bar, scroll feedback into view on answer, shrink/collapse the placeholder on small heights. Files: `app/busuu/runner.module.css` (`.continueRow`, `.visualPlaceholder`), `LessonRunner.tsx`. Screenshot: `p1-continue-below-fold-teaching.jpg`.

**P1-4 Required audio silently locks Continue and answers; long scenes auto-replay on every reuse question** (SHARED, plus a content-length question)
- Continue is disabled (no explanation text) on teaching/dialogue/model screens until the audio finishes (C10.L06 S6, C04.L05 S3, C09.L02 S1: first click did nothing). On sceneReuse questions (C04.L05 S4, S5, S6...) the whole 6-turn scene auto-plays (about 25-30 s with VoiceVox) and the answer options/chips are **disabled until it ends**, again with no hint ("Playing Japanese audio" only). Every reuse question repeats it. Short single-sentence clips unlock quickly (and true/false could be answered while "Playing"), so behaviour feels inconsistent. "Cancel audio" appears while preparing but nothing says it will not unlock.
- Expected (Busuu reference, teaching screen): Continue is enabled immediately; audio is optional to advance except where gated by design.
- Fix: show a reason ("Listen to continue" / progress), do not auto-replay the full scene for each reuse question (offer "Replay scene" only), consider letting Continue skip on teaching screens. Files: `LessonScreen.tsx` audio gating (`audio.required`/played state), `LessonRunner.tsx`.

**P1-5 "Restart lesson" sits beside Continue on every screen and restarts immediately with no confirmation** (SHARED)
- Tested at C10.L06 S1: one tap wiped the attempt and returned to S1 (progress 0, a fresh attempt). It is an outline button right next to the primary action on every screen and on results.
- Expected: Busuu has no restart control in the runner (restart lives in the lesson popover). At minimum a confirm dialog, and ideally move it to the exit/launch screen.
- Files: `LessonRunner.tsx` / `LessonScreen` action row.

### P2 - clear polish win

**P2-1 Developer/engine wording in shared UI (SHARED; confirms the scan's shared list)**
- On the screen, every lesson screen: caption "Japanese audio · app TTS replacement"; status banner "Saving your responses… 1 changes pending." / "Saved to your account." above every prompt; teaching label "Ungraded model"; scene caption "friends talking about games and programming · app TTS dialogue replacement" (C04.L05 S3); "Reuses the friends talking about games and programming from screen 3." (C04.L05 S4-6); kanji "Static shape study · animation replacement" (C02.L02, C04.L04); results "N of N base screens reviewed", "server-confirmed accuracy", "Core completion records finishing all tasks. No pass threshold is configured." (C04.CP checkpoint); retry banner "base screens are reviewed"; "Replay corrected sentence" shown even after a correct answer and on matching screens.
- Launch page: "Ready to practise" (British), "Images and video use neutral placeholders", "Resume your account's saved screen... completion is recorded after a confirmed save", a six-row readiness list (Structure/Text and answers/Required audio "TTS ready"/Media "Deferred"/Lesson runner "Shared models, ..., Scoring requires complete reviewed content"), disclosures "Documented lesson sequence · N screens" and "Source limitations and app choices". Checkpoint launch shows title "Checkpoint" with subtitle "Checkpoint".
- Fix: shared copy pass; hide the readiness list/disclosures behind a developer flag. Files: `components/busuu/LessonRunner.tsx`, `LessonScreen.tsx`, `LessonLaunch.tsx`, `SavedCourseMap.tsx`. Screenshot: `p2-launch-developer-wording.jpg`, `p2-results-screen.jpg`.

**P2-2 Map: "K[...]" leaks into kanji lesson subtitles** (PACK/structure data)
- Every kanji row shows subtitle `K[参 然 実 特 例]` under "Kanji: 参 然 実 特 例" (10 rows, all chapters), also on the launch page. The consistency scan did not cover `b2-structure.json` titles/objectives. Looks like an internal key format. Busuu: "Learn 5 new kanji".
- Fix: subtitle text in `b2-structure.json`/map mapper (or render "Learn 5 new kanji"). Also fluency rows read "F: lists", "F: personality" ("Developing fluency / F: ...").

**P2-3 Map/lesson-row state is thin compared with Busuu** (SHARED)
- All avatars are the same book icon; kanji, fluency and checkpoint rows are not distinguished (Busuu: kanji tile, flag-medal for checkpoints). A completed lesson gets only a small text pill "Completed · saved · 43% accuracy"; the avatar ring does not turn green, no check badge, connector stays grey (Busuu: green ring + check, green connector). Chapter bar has no percentage pill at the fill end and no 100% green card. No "in progress" state: a lesson exited at S2 of 21 looks identical to an untouched one (`p2-map-completed-row-no-badge.jpg`).
- The popover (teal, not blue) says "LESSON / READY TO PRACTISE ... Resume your saved attempt or restart in lesson details." with a single "View lesson details" button, also for completed lessons (Busuu: MIXED/1 MIN tags, "Review skills"/"Restart lesson"). Starting needs map -> popover -> details page -> "Start or resume" (4 taps; Busuu: popover -> exercise 1 after a spinner).
- On load every chapter and the level pill briefly read 0% before saved progress arrives ("Loading your saved progress"), which looks like lost progress.
- Files: `SavedCourseMap.tsx`, map CSS in `app/busuu/*.module.css`.

**P2-4 Launch/exit loop does not show progress** (SHARED)
- After an attempt exists the launch page still says "Ready to practise" and "Start or resume lesson" with no "Screen 10 of 10". X in the runner goes to the launch page, not the map, with no "your progress is saved" message and no exit confirmation (the Busuu reference could not confirm its own exit behaviour).

**P2-5 Gap sentence shown twice on some listening gaps** (PACK or SHARED)
- C09.L02 S2 and S4: a plain statement line `会議の時間が＿＿ました。` is rendered above the interactive gap line `会議の時間が…ました。`. Likely a `statement`/support block duplicating the gap template. Suppress when it equals the gaps template (shared) or drop the `statement` (pack). Screenshot: `p2-gap-sentence-shown-twice.jpg`.

**P2-6 Post-answer support duplicates (confirmed in UI)** (SHARED, scan item 4)
- Supported truth C04.CP S8: the source Japanese + reading appear above the options and again in "Well done!" block. Kanji C04.L04 S1: the joined sentence (試合に勝ちました。勝利を...) + reading + joined translation appear once, then the model repeats the three sentences individually.

**P2-7 Ordering/gaps chips reflow while tapping; tap targets move** (SHARED)
- After a chip is placed, bank chips shift/wrap (C04.CP S12: 野 球 一 位 勝 sequence put 勝 and 位 in the wrong slots because the bank reflowed after each tap; C04.CP S7 same). Placed chips leave grey holes but remaining chips re-wrap. Sentences with gaps wrap mid-word (そ / うではありません, プロ / グラミング, 書か / せました) because each segment is an inline-block.
- Files: bank layout CSS in `runner.module.css` (use fixed grid cells / keep chip positions), gap sentence wrapping.

**P2-8 Pairs screens (C10.L06 S17, C04.L05 S2, C01.L05 S2)** (SHARED)
- No instruction that you tap a left tile then a right tile; tiles are 2 columns with tall (95-190 px) cells. A wrong pair shows an amber "Those do not match. Choose another pair." **below the whole grid**, off-screen at 375 (`p2-pairs-wrong-notice-below-grid-375.jpg`). Matched pairs jump to the top and tiles reorder while you are tapping. Japanese in tiles wraps mid-word at 375 (「ゲームで遊び続けてい / ます。」) in ~13 px light text. After a corrected pair the final pair still needs explicit matching. Feedback concatenates all four sentences into one run-together line (C10.L06 S17) under "Replay corrected sentence".
- Aria labels "Left item: / Right item:" are good.

**P2-9 Typed screens (C04.CP S2/S6, C10.L04 S4)** (SHARED + PACK wording)
- Layout: "Your answer" label, field, supplied text, "Finish typing, then select Check. The text beside the field is supplied.", full-width Check, then Continue + Restart: two stacked primary buttons. Enter checks (good), Enter does not continue; after checking, Check remains visible/disabled. Prompt sometimes also says "then select Check" (duplicate of the hint).

**P2-10 Multi-select (C09.L02 S8)** (SHARED)
- Six full-width tiles (each ~95 px) push Check off-screen; selected state is only a pale-blue fill, no check mark or counter ("0/3 selected"); Check and Continue both visible.

**P2-11 Japanese typography/hierarchy** (SHARED)
- Body font stack is Helvetica Neue/Arial with no Japanese family, so kana/kanji render in the system fallback and look noticeably thin/light next to the bold English prompts (option tiles, gap sentences, support lines). Hierarchy on teaching screens: target Japanese is the lightest/smallest line, while the English explanation below is larger and darker and left-aligned (Busuu: Japanese bold and largest, translation smallest).
- Embedded Japanese in English explanations is rendered in a different weight/size inline (visible in "A na-adjective takes な before a noun...").

**P2-12 Global app nav stays inside lessons** (SHARED)
- Library/Busuu/Study/Chat/Account bar (60 px, two rows at 375) is visible throughout the runner; Busuu's lesson shell is bare with only icon buttons, progress bar, close X.

**P2-13 Progress bar semantics** (SHARED)
- Bar is empty on screen 1 and fills with completed screens; Busuu shows 1/7 on screen 1 (reference notes the bar already counts the current screen). In retry the label switches to "Activity retry 1 of 1" while the bar stays at ~12/19.

**P2-14 No dark mode support** (SHARED)
- Emulated dark and light give identical course screens: a white course surface on the app's near-black body (`rgb(7,7,15)`); native controls flip with the OS (P1-1). Either add dark tokens for the course surface or force `color-scheme: light` on the runner root.

**P2-15 Checkpoint result presentation** (SHARED, product decision)
- Checkpoint results read exactly like a lesson ("Lesson completion saved") plus "No pass threshold is configured". Per project rules no threshold should be invented; the copy could just omit the sentence and use "Checkpoint complete". Busuu's checkpoint result/pass messaging was not observed (see 5).

### P3 - nice to have
- Mobile target sizes (375): Speed select 74x28, voice selects 28-30 px high, "Audio voice" summary 21 px high, Replay audio 40 px, Restart lesson 42 px, close X 40x40. Primary buttons are fine (48-52 px). Tiles are large.
- First screen at 375x812 almost fits (Continue visible for a gaps screen) but not for tables/dialogue/feedback; there is no safe-area padding at the bottom.
- Table at 375 (C01.L05 S3): three equal columns, "Use" column wraps into 168 px rows, no horizontal scroll needed, no overflow. Stacking cells below ~480 px would read better (scan item 17). Other long tables not reached.
- Dialogue (JP-only, C04.L05 S3): plain list of speaker name + line, no readings/translation toggle, no bubbles or per-turn replay; fine but flat vs Busuu.
- Optional writing card: heading "Optional free writing" is body weight; textarea lang="ja" (good), helper text is clear.
- Keyboard: no global Enter for Continue/Check except typed field; number keys (0-9), K (play/pause), S/O shortcuts from the Busuu reference are not implemented (`LessonScreen.tsx` has the only key handler for typed Enter; `LevelSelector.tsx` for Escape). Tab order on choice screens is logical (nav links, X, audio controls, voice settings, options, Continue) and the focus ring is visible; options are `<button aria-pressed>`.
- Audio panel is large on every screen (Replay + Stop + Speed + caption + "Audio voice" details with 100+ VoiceVox voices exposed to learners).
- Consistency-scan confirmations: the reading-spacing convention differs on screen (C10.L04 S6 "ちちは わたしに ..." spaced vs C04.CP S3 "さいごまで、ぜんりょくでは..." unspaced); explanations with build language were visible at C04.CP S2 ("This occurrence accepts 行け and いけ explicitly. ... No automatic kana/romaji conversion applies"), C04.CP S4 ("This separate clip has no scene replay before answering"), C09.L02 S8 ("Select ... as one exact set"). Nothing new to report beyond the scan for these.

## 4. Per-pack vs shared summary

- SHARED CSS/component (fix once): P1-1, P1-2, P1-3, P1-4, P1-5, P2-1, P2-3, P2-4, P2-6, P2-7, P2-8, P2-9, P2-10, P2-11, P2-12, P2-13, P2-14, P2-15, all P3 except dialogue/table content.
- PER-PACK/data: P2-2 (kanji subtitle `K[...]` and `F: ...` titles in `b2-structure.json`), P2-5 (statement duplicating the gaps template, if not fixed in the component), plus the scan's per-pack list.
- No content-version changes are needed for any P1 item.

## 5. Busuu comparison (partial reference; see busuu-reference.md)

| Aspect | Busuu (reference) | Our app |
| --- | --- | --- |
| Map | Level pill with %, chapter cards with green progress bar + % pill, 100% chapter turns green; lesson rows 568x122 with distinct avatars, green ring + check badge when complete, vertical connector | Same card/row structure and 122 px rows (matches), level pill + chapter % bars; but one generic icon, no green/check/connector state, text pill only, no in-progress state, 0% flash on load, `K[...]` subtitles |
| Launch | Popover with mode tag, 1 MIN, title, objective, "Review skills"/"Restart lesson" (completed) and direct start; spinner then exercise 1, no intro | Popover -> details page with developer-style readiness list -> Start; popover copy unchanged after completion |
| Lesson shell | Bare shell, progress bar 500x12, X 40 px, 500 px column, bottom bar with Continue 200x48 #116EEE | 512 px column, X 40 px, similar bar (teal fill) and Continue size, but global nav inside, status banner, Continue not docked, extra Restart button |
| Progress | Bar counts the current screen (1/7 on first screen) | Counts completed screens; "Screen N of M" label |
| Teaching screen | Video card, bold target Japanese, plain-script line, translation; Continue enabled immediately; shortcuts menu (S/O), Enter, 0-9, K | Placeholder image, light target Japanese, larger English explanation; Continue disabled until audio ends; no shortcuts |
| Exit | X, behaviour unconfirmed (native dialog suspected) | X goes to launch page, no confirm |
| Feedback states | NOT observed in reference (no exercise, results, checkpoint, mobile, post-completion map) | See P1-2; results screen exists with accuracy, retry notes and optional writing |

Not covered by the reference, so no comparison possible: exercise feedback visuals, results/score screens, checkpoint flow, mobile 375, post-completion map state.

## 6. Environment/process observations

- Dev server logged one "Fast Refresh rebuilding" while I played (files may have been edited in the repo by someone else during the run).
- The pane width kept changing (577 -> 1000 px) during the session; the 375 preset was cleared and re-set several times.
- `find`/click refs on chips/tiles go stale after every state change (the DOM re-mounts options); not an app issue but note any automated harness should key on aria-labels (pairs have them, chips do not).
