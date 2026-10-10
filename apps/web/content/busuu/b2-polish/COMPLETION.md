# B2 polish batch: completion report (8 October 2026)

Owner goal: polish B2 before any other level, so the Learn experience closely matches Busuu's layout and behaviour, with app-owned colours, Australian English and reviewed content.

## Delivered

**Evidence and tooling**
- **Local walkthrough mode** (`README.md` here; launch config `busuu-walkthrough`, port 3100). It only switches on when all three hold: development mode, `BUSUU_LOCAL_WALKTHROUGH=1`, and a loopback host. It uses a synthetic owner and in-memory storage, makes no Supabase calls, and lets `/api/tts` and `/api/voices` through. Production builds cannot enable it.
- **Busuu reference:**
  - `busuu-layout-behaviour.md` holds measured Busuu tokens and behaviour. It came from one completed B2 lesson; checkpoint results were taken from the existing research evidence.
  - `busuu-reference.md` covers the map and shell. Learn section only.
- **Consistency scan:** `consistency-scan.mjs` (results before and after are in its JSON outputs).
- **Learner playthrough:** `playthrough.md`.
- **Real-account check on the hosted database:** `real-account-check.md`.

**Shared app changes** (no event, state or result shape changes; old attempts replay identically — fixture test `busuu-playback-compat`)
- **Map and launch:**
  - Busuu geometry: a 620px column, chapter cards with a percentage pill, and 568×122 rows with progress rings and check badges.
  - Kanji, fluency and checkpoint avatars; clean subtitles derived for display only, with raw evidence unchanged.
  - A row popover offering Start, Continue or Restart.
  - No launch page: lessons open straight from the map, with a loading spinner.
  - Leaving a lesson asks for confirmation and returns to the map at its chapter. The global nav is hidden during lessons.
  - `GET /api/course/attempts?include=active` is an additive, owner-scoped read used for in-progress rings.
- **Lesson runner:**
  - Shell: a 500×12 progress bar per activity that counts the current screen, a close button, and a docked bottom bar.
  - Grading and audio:
    - Tapping grades immediately; multi-select grades once the required number is picked; typed answers keep Check.
    - The play-before-answer requirement is removed (owner decision).
  - Bottom feedback sheet with varied headings. Answer states are pink when wrong and green when right; a wrong pick does not reveal the correct option.
  - Retries happen without banners, and the results screen shows Score cards with Restart there only.
  - The save panel is removed (only a failed save shows a message).
  - Removed: developer captions and duplicate support blocks.
  - Light-only colours with explicit input colours.
  - Japanese font stack, `lang="ja"` markup, number keys, Enter, and stable tile and chip positions.
- **Audio:**
  - The whole lesson's TTS is prefetched into a persistent Cache API store (`course-tts-v1`). Keys are hashes and storage is bounded.
  - Busuu-style pill player; the voice picker moved to a settings icon at the top left.

**Content** (owner-approved text pass; details in `pack-text-changes.md` and `pack-text-validation.json`)
- 70 of 73 records have new versions (1.1.0, or 1.2.0 for C01.L03). The registry holds 145 versions; all 75 earlier versions are byte- and fingerprint-identical.
- Changes:
  - engine and provenance wording rewritten into plain teaching text;
  - animation and meta disclaimers removed;
  - Australian spelling;
  - run-together readings;
  - 166 reading lines restored to katakana;
  - English instructions added to Japanese-only and run-on prompts;
  - real table translations;
  - consistent instructions per exercise type.
- Answer keys, accepted forms, tokens, options, partitions, counts and retries are unchanged, proven by a leaf-level diff over 1,154 screens.

## Validation (final, run by the orchestrator)
- 292/292 web tests pass.
- `tsc --noEmit` is clean.
- Lint: 0 errors and 17 warnings (12 old, plus 5 in this folder's `consistency-scan.mjs`).
- The pack transform `--check` regenerates byte-identically.
- Saved paths: 2,285 assertions over 10 sampled records (new and previous versions). The chapter 7–10 `saved-path.mjs` scripts still pass.
- Hosted database check (dev account, owner-authorised): one lesson, one checkpoint, resume after reload and leaving mid-lesson all passed, and the map's in-progress read works.
- Changed UI was inspected at 375 and 1280 (`runner-after/`), plus a final map and lesson check on the walkthrough server.
- **Not run:** `next build`, which would disturb the owner's running :3000 dev server. Run it once with that server stopped.

## Owner cleanup
Dev-account rows written by the real-account check: B2.C02.L02 (`a5bc15dc-8b62-4ec8-bfb9-e4743e04c4a2`), B2.C03.L01 in progress (`3536a4ad-39f7-45d2-ad89-cf78c824e6ad`), B2.C01.CP (`62b2acd6-3e18-4255-906e-0bc04dda88a7`).

Busuu account side effects (8 October 2026, kanji sync, owner-approved in chat): the 11 B2 kanji lessons were restarted and re-completed on Busuu. The level selector was opened twice by mistake and closed with no change.

## Remaining gaps and candidate next work
- **Resolved (8 October 2026): kanji examples.** All 55 kanji screens now use Busuu's example lists (new versions for 11 records; registry at 157 versions).
- **Map subtitles are terse** (e.g. "Humble self-introduction (say/come)"). Busuu uses full objective sentences, so authored display objectives would be a presentation-only change.
- **Saving is chatty:** every response is posted on its own, about 250 requests per lesson, sent one at a time. Batching would change the transport and persistence contract, so it needs owner authorisation and database harnesses.
- **Audio player:** pause acts as stop and there is no scrubber; adding them needs position and duration from the audio adapter.
- **TTS-only readings** (`audio.reading` and dialogue-turn readings) still contain word spaces. They are not visible to learners.
- **Not visually re-checked:** true/false, multi-select, kanji and table layouts at Busuu's exact metrics, which the research catalog marks as unknown.
- **Unfinished attempts** on older versions don't carry over to the new version; the learner starts fresh. This matches earlier version bumps.
- **Deferred:** original images, video and animation; the in-runner placeholders remain.
