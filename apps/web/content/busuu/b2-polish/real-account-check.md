# B2 real-account (hosted Supabase) check

Date: 2026-10-08. Server: http://localhost:3000 (owner's dev server, untouched), signed-in session in pane tab "tab-1" (never saw /login). Verification only; no code changes. Progress writes were limited to the dev account's course attempts, as authorised.

## Result summary

| Check | Result |
| --- | --- |
| Map loads; `GET /api/course/attempts?include=active` against hosted DB | PASS (200 on every call, 6+ calls; no column mismatch) |
| Regular lesson B2.C02.L02 end to end | PASS |
| Answers save silently (no save panel) | PASS (no panel appeared; every `POST /api/course/attempts` 200) |
| Results screen shows Score | PASS ("Well done!", Score 33%, Correct first time 5 of 15, Restart lesson / Continue) |
| Continue returns to map at chapter | PASS (URL `/busuu/B2#B2.C02`, scrolled to chapter 2) |
| Row shows complete (full ring + check badge, sr text "Completed") and chapter % rose | PASS (see table) |
| Mid-lesson resume after reload (B2.C03.L01) | PASS (reload landed on the same unanswered screen) |
| X -> "Leave lesson" -> map shows in progress (partial ring) | PASS (ring 75/100, sr text "In progress") |
| Popover "Continue lesson" resumes | PASS (same screen as before) |
| Checkpoint B2.C01.CP end to end | PASS ("Checkpoint completed!", Score 7%, Correct first time 1 of 14, no threshold/pass text; Continue -> `/busuu/B2#B2.C01`; CP row complete) |
| Console errors | None (read_console_messages errors-only: "No console logs") |
| Failed `/api/course/attempts` POSTs | None observed (in-page fetch wrapper: 0 non-2xx; network panel: all 200 OK) |

## Map before / after

| | Before | After C02.L02 | After CP + C03.L01 partial |
| --- | --- | --- | --- |
| Level pill (B2) | 1% | 3% | 4% |
| Ch1 Myself | 17% | 17% | 33% |
| Ch2 Personalities | 0% | 13% | 13% |
| Ch3-Ch10 | 0% | 0% | 0% |

Pre-existing state noted at start: B2.C01.L01 complete, B2.C01.L02 in progress (not touched).

## What I did (IDs)

1. B2.C02.L02 (Kanji: 参 然 実 特 例), started from the map popover "Start lesson". 15 scored exercises. First answer wrong on purpose (残りました), a reconstruct exercise answered wrongly, the rest mostly right. Attempt `a5bc15dc-8b62-4ec8-bfb9-e4743e04c4a2`.
2. B2.C03.L01 (Saying an action continues): started from popover, answered about 7 screens, reload resumed on the exact screen (`Complete the life period and continuation te-form`), exited via X -> Leave lesson, popover showed "Continue lesson", resumed same screen, exited again. Left in progress. Attempt `3536a4ad-39f7-45d2-ad89-cf78c824e6ad`. (A second-session resume event was also posted; same attempt id.)
3. B2.C01.CP, opened by URL. Attempt `62b2acd6-3e18-4255-906e-0bc04dda88a7`. Answered mostly first option, so low score; completed.

## Hosted dev-account data written (for cleanup)

Course attempts for the signed-in dev account (attempt ids above) for lesson records:
- B2.C02.L02 (completed, attempt a5bc15dc-8b62-4ec8-bfb9-e4743e04c4a2)
- B2.C03.L01 (in progress, attempt 3536a4ad-39f7-45d2-ad89-cf78c824e6ad)
- B2.C01.CP (completed, attempt 62b2acd6-3e18-4255-906e-0bc04dda88a7)

Also: before I began, tab-1 was sitting on `http://localhost:3100/busuu/B2/lesson/B2.C04.L05` with roughly 190+ earlier `POST /api/course/attempts` calls for attempt `768d230a-2db7-4bd4-a8d6-e96446f28a85` in its network buffer. That is another server on port 3100, not from this run; I do not know whether it points at the hosted DB. Mentioned so you can check B2.C04.L05 when cleaning up. I did not stop or alter either server. Stored voice preference was not changed.

## TTS (default voice, signed in)

Default voice (Provider Edge TTS, Nanami) returned real audio when signed in: `POST /api/tts` -> 200 OK on every call (60+), response body JSON with `audioBase64` holding MP3 frames (LAME header, tens of KB per clip), not empty. The page showed "Playing Japanese audio". So the Edge empty-audio issue did not reproduce in real signed-in use.

## Observations / minor notes (not failures)

- Event volume and speed: every interaction posts one event and they drain serially at about 0.5-3 s each against hosted Supabase (C02.L02 produced roughly 250 POSTs; the page needed a bit of time after the results screen before the Continue link navigated). A synthetic `.click()` on the results "Continue" link did not navigate for ~40 s while the queue drained; a real click then navigated promptly. Likely queue-drain/navigation gating, not an error. Worth a glance if results-screen latency matters.
- Reconstruct/tap exercises: when a script clicked the last remaining tile instantly after the previous one, the click was ignored once (needed a real click). Likely a transition lock; humans unaffected.
- First "Leave lesson" -> immediate hard navigation to another URL did not lose the in-progress state (ring still 75/100 afterwards).
- One `GET /api/course/attempts?include=active` was left without a status in the panel because the page navigated away mid-request (aborted); not an error.
- In-progress ring for B2.C03.L01 read 75/100 after about 8 answered/completed screens; progress fraction semantics not verified against the lesson length.

## Not done / not verified

- No screenshots were relied on (pane renders a zoomed crop); ring/check state was read from the DOM.
- Did not verify DB row contents directly (browser-only check); persistence evidence is the 200 responses, correct map state after navigating back, and resume-after-reload.
