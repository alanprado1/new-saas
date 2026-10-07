# Busuu B2 Learn section: measured layout and behaviour (2026-10-08)

Observed by the orchestrator in the owner's logged-in Busuu (Chrome, 1225x695 viewport, desktop). Learn section only. UI chrome measurements/behaviour, no lesson content transcription. Supplements `busuu-reference.md` (partial, from the earlier agent).

## Global
- Page bg `#F2F7FD` (242,247,253). Font family `Nista, "Helvetica Neue", Helvetica, Arial, sans-serif`; body 16px/27.2px, text black; secondary text `#1E2D40` (30,45,64).
- Neutral border `#DAE1EA` (218,225,234), borders ~1.78px. Primary blue `#116EEE` (17,110,238). Success green `#0EBE75` (14,190,117).
- Course copy uses British/Australian spelling (Practise, Flavour, emphasise).

## Course map (/dashboard/timeline/b2)
- Column 620px wide, centred (x=295 at 1210 content width).
- Title "Complete Japanese": 32px/41.6 weight 800, black.
- Level selector bar: 620x52, white, radius 16px, 1.78px #DAE1EA border, padding 12px; list icon + "Upper Intermediate B2 · 90%" 16px/24 weight 700 #1E2D40.
- Chapter card: `section` 620 wide, padding 24px, radius 24px, border 1.78px #DAE1EA, white bg. Completed chapter (100%): bg rgba(14,190,117,0.05), border #0EBE75, plus green check by title.
- Chapter title h3 24px/31.2 weight 800. Header block 568x67 (padding-bottom 24px).
- Chapter progress bar: track 568x12 #DAE1EA radius 16; fill #0EBE75 radius 16; percentage pill at the fill's end: 10px weight 700 white text on #0EBE75, radius 20, padding 0 8px, ~37x20.
- Lesson row: 568x122, white, radius 24px, padding 16px 0 (no border). Left: 90x90 svg progress ring (two circles r≈37.5, stroke 5px; track #DAE1EA, arc #0EBE75 using dasharray 314.159 → per-lesson progress ring), inner avatar image 60x60 circle. Completed: small green check badge (30x30) overlapping the ring bottom. Rows connected by a 2px vertical line (36px tall) between rings.
- Row text at x=427 (16px gap after ring): title 16px/24 weight 700 #1E2D40; subtitle 14px weight 400 #1E2D40, one line.
- Kanji rows: blue circle avatar with first kanji. Checkpoint row: flag/medal icon, subtitle "Test your skills to access the next chapter".
- Clicking a row opens an inline popover: tags "MIXED" and "N MIN", title, objective, buttons "Review skills" and "Restart lesson" (for completed lessons).
- On load, a bottom sheet "Review your skills / Warm up with a quick recap…" with Not now / Review skills (dismissed; out of scope).

## Lesson shell
- No intro screen: spinner ~2–5 s then exercise 1.
- Top bar: left three 40x40 round icon buttons (tips bulb, keyboard shortcuts, download with lock badge) colour #116EEE; centred progress bar 500x12 (track #DAE1EA, fill #0EBE75, radius full); close X 40x40 round, colour #4B5766, top right.
- Content column 500px centred. Instruction/prompt at top: 16px/27.2 weight 400 (rendered semi-bold look), centred, black.
- Media card: pale-blue (#F2F7FD-ish) rounded panel 500 wide containing images (rounded ~24px) and a docked blue pill audio/video player (play, scrub, "1x").

## Gap fill (character tiles)
- Sentence line ~24px Japanese with dotted-underline gaps (~44px wide).
- Tile bank centred below: tiles 54x62, white, radius 8, border 1.78 #DAE1EA, 20px glyph #1E2D40, small number badge (1,2,3) bottom-right for keyboard selection.
- Click tile → moves into next empty gap; its bank slot remains as a grey placeholder (same size, #DAE1EA fill). No Check button: placing the final tile auto-grades.
- Grading: wrong tiles turn pink bg (241,144,151) with red border (232,78,88); correct tiles stay neutral white/grey border (no green highlight on wrong-overall answers).

## Grammar tip / teaching screens (ungraded)
- Bold heading (pattern line) centred, 18px/30.6 body text #1E2D40 in the 500 column, left aligned.
- Example sentence card: white, radius 16, 0.89px #DAE1EA border, centred text: Japanese (bold particles, target underlined) with English in parentheses on the same line, small blue speaker icon below. Multiple examples stack in one bordered card separated by thin dividers.
- Bottom bar: thin top divider, right-aligned Continue pill (bar height ~64, button 200x48). Enter = Continue.

## Multiple choice (text options)
- Options are full-width 500x62 buttons, white, radius 8, 1.78px #DAE1EA border, 20px Japanese / 16px English text #1E2D40, centred; 16px gap. Number badge 20x20 (12px weight 800 #6D7783, white, radius 4, 1.78 border) overlapping each option's bottom-right corner. Keys 1–9 select (needs page focus).
- Selecting an option grades immediately (no Check). Correct: option bg #88F7C8 (136,247,200), border #11EE92. Wrong: selected option pink (241,144,151)/red border; the correct option is NOT highlighted — the feedback card states the answer.
- Audio-only listening questions: just the blue pill player (500x38) above options; answering is possible without playing the audio.

## Word ordering (sentence chunks)
- Answer box 500x100 white, radius 8, 1.78px border (214,222,230). Chips below: white, radius 8, 1.78 border, 62px tall, 20px text, number badges. Click chip → appended in the box; its bank slot stays as a grey placeholder. Final chip auto-grades; correct chips turn green (#88F7C8/#11EE92). Bank wraps onto multiple centred rows.
- Corrected sentence in feedback is shown with spaces between chunks.

## Gap fill variants
- Multi-gap sentences wrap; the active gap's dotted underline is blue, others grey. Gap width grows with chunk length. Tapping a placed tile returns it to the bank.

## Typed answer (cloze)
- Inline input inside the sentence with placeholder "Type here", dotted blue underline. Bottom bar shows a "Check" pill (same 200x48 style) disabled at 50% opacity until text is entered; Enter submits.
- Wrong: the typed region turns pink. Feedback card shows the corrected sentence with the answer inline and its romaji (e.g. "|ni"), translation, then a romaji line; explanation below.

## Pair matching
- Two columns of 240-wide option buttons (same style, number badges 1–4). Selecting a left item: pale-blue bg + blue border. Choosing its partner: both turn green and the pair animates to align on the same row (matched items lose badges). Wrong pair behaviour not observed.

## Feedback headings / tone
- Heading varies randomly: correct "Well done!", "You're improving", "Amazing work!", "You did it", "Nice work", "You got it"; wrong "Keep going", "Nearly there", "So close", "Not quite". Left icon is a gauge (green when correct, red when wrong).
- Feedback card always has a speaker icon before the Japanese line when audio exists.

## Retries and activity structure
- Missed items are re-queued at the end of the SAME activity with no banner/interstitial (the progress bar just keeps going and fills to the end). Repeat exercises look identical to the original.
- Activity boundary: the next activity starts immediately with the progress bar reset for that activity (no summary screen between activities).
- Enter = Continue/Check; 1–9 select options/tiles when the page has focus.

## Lesson results
- Full-page white screen, no shell bar: illustration (lesson: themed scene; checkpoint: blue flag with stars when passed, light flag with refresh icon when failed), h2 32px/41.6 weight 800 "Well done {name}!" / "Checkpoint completed!" / failed "Good effort" + body "You need 80% or above to pass…".
- Two stat cards side by side (~186x76 each, white, radius ~8, 1.78 #DAE1EA border): label 12px weight 700 #4B5766 ("Stars", "Score"), value 16px bold with icon ("+10 ★", "81%" + green bar icon).
- Bottom bar with divider and Continue pill (auto width ~124x48). Afterwards Busuu shows gamification screens (challenges, league, streak, shields): out of scope for our app.
- Checkpoint result evidence: research Evidence/S10-B2-checkpoint-completed.jpg (pass) and S05-B1-checkpoint-first-attempt.jpg (fail).

## Not measured (use catalog + shared tokens)
True/false, multi-select, kanji animation, explanation tables, scene video, 375px mobile. Behaviour for these is in Busuu-UI-Interaction-Catalog.json; reuse the shared tokens above (option buttons, badges, feedback sheet, bottom bar).

## Feedback bottom sheet (wrong answer)
- Fixed bottom sheet full width, white, shadow `0 0 10px -2px rgb(214,222,230)`, ~199px tall; the page scrolls so the prompt moves off the top.
- Left: illustrated icon (red/blue gauge) + h3 "Keep going" 24px/31.2 weight 800 black.
- Centre (x≈307, 520 wide): pale-blue rounded card with the corrected Japanese sentence (target chars highlighted) and English translation 14px/21 #1E2D40; below the card a plain-text grammar explanation 16px.
- Right: "Continue" pill 200x48, #116EEE, radius 26, 16px/24 weight 700 white.
