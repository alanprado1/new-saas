# Busuu B2 Japanese: learner-experience reference (PARTIAL, 2026-10-08)

Scope: Learn section only (course map, lesson/checkpoint flow). Desktop ~1225 x 695 viewport, Chrome, owner's logged-in profile. Read-only UX observation; no lesson text is transcribed. Nothing here is app content.

STATUS: INCOMPLETE. Observation stopped after the lesson launch and first teaching screen. Progressing a lesson (clicking Continue) was blocked by the permission system, because the lesson-completion authorization arrived via an agent message rather than from the owner directly. Exercise-type feedback states, results screens, checkpoint flow, mobile (375px) and post-completion map state are NOT observed. See "Not reached".

Legend: NEW = observed today; CAT = already in Busuu-UI-Interaction-Catalog.json (consistent with it).

## 1. Course map (B2 timeline, /dashboard/timeline/b2)

- NEW: Header block "Complete Japanese", then a level pill "Upper Intermediate B2 - 90%" (list icon, 620px-wide rounded outline box, level-selector entry). Overall level progress is a percentage. CAT for level selector, NEW for the pill text pattern.
- NEW: Premium upsell banner full-width card between the level pill and Chapter 1 (purple, crown, chevron); a floating purple "70% off Premium" tile also overlays the right edge of the map while scrolling. (Chrome, not to be copied.)
- CAT/NEW measurement: lesson rows 568 x 122px (matches recorded 122px), white, 24px border radius; 10 chapters in B2 (73 row-like elements including checkpoints).
- NEW: Chapter card: outlined 24px-radius card; heading "Chapter N: Title"; green progress bar with a percentage pill at the end of the filled part (e.g. 83%, 87%, 85%, 100%); lessons listed beneath as a vertical timeline.
- NEW: Chapter at 100% turns light green: card background and border green-tinted, a green check badge beside the title, bar full with "100%" pill.
- NEW: Lesson row: circular avatar (photo, or a blue circle with the first kanji for kanji lessons, or an orange flag-medal icon for checkpoints) ringed in green with a small green check badge at its lower right when complete; a vertical connector line joins rows (green between completed, grey toward incomplete). Title (bold) over a one-line objective subtitle.
- NEW: Not-complete lesson (here every "Developing fluency" lesson) shows a grey ring, no check badge, and a grey connector below it. Chapters containing a fluency lesson cap below 100% (83-90%) even when the checkpoint is complete; chapters without a fluency lesson show 100%. The 83% in Chapter 1 equals a chapter whose only incomplete item is the fluency lesson, so fluency counts toward chapter percentage.
- NEW: Row hover/selection shows a pale-blue highlighted rounded row.
- NEW: Checkpoint row: title "Checkpoint", subtitle "Test your skills to access the next chapter", flag-medal avatar, last row of each chapter.
- NEW: Kanji lessons titled "Kanji:" followed by the five kanji, subtitle "Learn 5 new kanji". Fluency lessons are titled "Developing fluency" with a topic subtitle.
- NEW: Chapter structure is variable: 4-10 rows; most chapters mix grammar lessons, one kanji lesson (some two), a fluency lesson (chapters 1, 2, 3, 6, 8, 9 and 10 per the page text), a review/listening lesson near the end, and a final Checkpoint.
- Sources: whole-page text and visual scan of chapters 1-4; chapters 5-10 from page text only.

## 2. Lesson launch

- NEW: Clicking a COMPLETED lesson card opens an anchored blue-gradient popover under the row with: a mode tag with icon ("MIXED"), a duration tag ("1 MIN"), lesson title, objective text, and two buttons: "Review skills" (white filled) and "Restart lesson" (outlined). (CAT: popover with mode, estimated minutes and start action; the two-button completed state is NEW.)
- NEW: "Restart lesson" navigates to a launch route (launchType=restart) showing only a centered blue spinner (white page) for roughly 2-3 seconds, then drops directly into exercise 1. There is NO intro/summary screen before the first exercise.
- NEW: URL pattern encodes objective, activity and exercise number (.../activity_<id>/exercise_<n>), so an activity/exercise index exists in the route.

## 3. Lesson shell (teaching screen "Look, something new!")

- NEW: Top bar: left two circular 40px icon buttons (keyboard shortcuts; a download icon with an orange lock badge = premium/offline), centered progress bar 500 x 12px (grey track, green fill) at x=355, close X (40px circular) at far right. Content column 500px wide, centered.
- NEW: Progress shown on screen 1 was 14.29% (1/7): the lesson had 7 screens and the bar already shows one segment on the first screen (progress counts the current screen, not completed answers). (CAT says weighting unknown.)
- NEW: Heading "Look, something new!" (centered, bold, ~16-18px) above a 500px rounded card: pale-blue striped gradient with a speaker-video thumbnail, then a bottom-docked blue pill audio/video player (play button, thin scrub bar, "1x" speed label, settings gear; speed menu includes 0.75x and Normal).
- NEW: Below the player in the same card: target Japanese sentence in bold (largest), then a plain-script/kanji version line, then English translation (smallest). Japanese shown with kanji and no furigana here; no romaji toggle seen.
- NEW: Playing the video shows a buffering state (striped scrub bar, play icon replaced by a spinner/triangle) before playback; the player has a stable layout throughout.
- NEW: Bottom bar: thin divider line, "Continue" pill button right-aligned (200 x 48px, background rgb(17,110,238) i.e. #116EEE, 26px radius, 16px bold white). Continue is enabled immediately on a teaching screen.
- NEW: After clicking the video play button, pressing Enter did NOT advance (focus was on the player control); keyboard behaviour depends on focus.
- NEW (keyboard): Keyboard-shortcuts icon opens a small menu ("Show / Hide shortcuts" = S, "Open / Close shortcuts summary" = O) with a tooltip "Speed up your learning with keyboard shortcuts". The summary dialog lists: S show/hide shortcuts, O open/close summary, Enter = Continue / Check answer, 0-9 = select answer, K = play/pause audio, Shift+K = play/pause example audio. Escape closes the dialog. Shortcut badges are shown beside options on exercise screens (not verified, since only a teaching screen was reached).
- Exit control: close X; exit confirmation behaviour on a 1/7 restart lesson NOT confirmed (see below).

## 4. Course map after exit and completion state

NOT OBSERVED (blocked).

## Not reached (needs owner direct confirmation or a different approach)

- Exercise screens: multiple choice, true/false, ordering, fill the gap, typed, multi-select, dialogue, grammar table, kanji (only one teaching screen seen).
- Correct/wrong feedback visuals, banner position and colours, retry/review at lesson end, result screen, scores/stars.
- Checkpoint launch, pass messaging, locked/next-chapter signposting.
- Mobile 375px behaviour.
- Final screens, map changes after completion.

## Session note

On closing the lesson with X, the browser tab stopped responding to screenshots (likely a native exit-confirmation dialog blocking the page). It needs to be dismissed manually in Chrome by the owner.
