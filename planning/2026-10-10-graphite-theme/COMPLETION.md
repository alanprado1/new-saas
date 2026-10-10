# Graphite theme and Dock shell: completion report (10 October 2026)

Owner-approved direction: "ani語 Graphite" (mockup in `mockup/index.html`), with the owner's choices: Dock layout only, Quiet strength only, theme button keeps changing the accent (five re-tuned accents), plus a chevron ground picker (Graphite / Slate / Charcoal) saved independently of the accent. Spec: `SPEC.md`. Pre-change source backup: `backups/2026-10-10-pre-graphite-apps-web.tgz`.

## What shipped
- **Tokens and fonts** (`app/globals.css`, `app/layout.tsx`): ground/accent tokens on `<html data-ground data-accent>`, meaning colours fixed, pre-paint script (no flash), Figtree / BIZ UDPGothic / Klee One via `next/font`. Purple gradient, noise, glows and emoji icons removed.
- **Theme state** (`lib/themes.ts`, `hooks/useTheme.ts`): same five theme names (saved choices carry over, key `anigo-theme`); ground key `anigo-ground`; `useTheme()` returns `{ theme, setTheme, ground, setGround }`, live-synced across components and tabs. `TAG_GRADIENTS`/`TAG_EMOJI` removed.
- **Shell** (`components/shell/*`): 88px Dock on desktop (Home, Library, Course, Study, Chat, theme control, account menu with Credits), bottom tab bar + compact top bar on phones. Full-screen (no shell): Busuu lessons, flashcard session, auth pages.
- **Routes**: `/` is the new Home (Continue card from the course's existing attempts read, Study card from the study snapshot, latest four scenes); the Scene library moved to `/library` (all functions kept; `/library?new=1` opens the generate dialog). `proxy.ts` unchanged; `/library` is protected.
- **Busuu course**: fully dark via `--course-*` remap in `busuu.module.css` / `runner.module.css`; `CourseHeader` deleted, map pages inside the shell with a Credits link. Layout, behaviour, events, state, packs and versions unchanged.
- **Study**: carousel replaced by a level-tile row; level page with Auto-Learn and stats panels. Flashcards: Klee One words, accent furigana/meaning, colour-coded ratings muted before reveal (still clickable), underline on the example sentence while its audio plays.
- **Scene player**: inside the shell; desktop two-column (stage + current line | Transcript / Vocabulary / Grammar tabs); phone stacked. Karaoke underline driven by Howler `seek()/duration` via rAF. New Next button (same debounce as rewind). Back goes to `/library`.
- **Chat** and **login / forgot / reset password**: tokens only, no logic changes.

## Checks (10 October 2026)
- `npx tsc --noEmit`: clean.
- `node --test lib/*.test.mjs components/shell/*.test.mjs`: 328/328 pass (new `continue-target` suite: 8).
- `npx eslint`: 0 errors, 13 warnings (was 17).
- Test edits: `lib/busuu-navigation.test.mjs` (header tests replaced by shell/credits assertions), `lib/busuu-lesson-runner-ui.test.mjs` (`color-scheme: dark`). No behaviour assertions weakened.
- Visual: owner's :3000 (signed in, read-only) for Home, Library, Study, Scene player (idle and playing), Chat, flashcard front/back at 1280 and 375; theme control verified (Slate ground kept after switching accent to Sakura and reloading; storage restored afterwards). Course in local walkthrough (:3100): `course-after/` (15 captures).
- Orchestrator fixes after review: desktop media block moved last in `components/shell/shell.module.css` (tab bar was showing at desktop width); `display: block` on the scene-card art span (art had no height).

## Not done / open
- `next build` not run (needs the owner's :3000 stopped and their go-ahead).
- Sprite 404s in the scene player (`/sprites/<speaker>_<expression>.png`) are pre-existing; the image hides on error as before.
- The app has no sign-out action anywhere; the account menu shows email + Credits only.
- Course audio player has no karaoke underline (`CourseAudioAdapter` exposes no position).
- AnimCJK credit: the Credits page is now one tap from the account menu on every shell page; whether that satisfies the Arphic notice is the owner's call.
- Content note found while capturing: the ramen scene vocabulary example 足が早い should be 足が速い.

## Follow-up fixes (11 October 2026, owner feedback)
- Scene player: line controls smaller (36/44px) and on the translation row (bottom-right); speed control always in the top toggle group; full-screen subtitles use the old fading black gradient with no karaoke underline; full-screen toggles are solid chips; the page uses `AppShell collapsed` (Dock hidden, menu button in the scene header opens it as an overlay; `components/shell/DockFrame.tsx`, `useDock()`).
- Study: `/study` shows the last-opened level (per direction, `anigo-study-level:<direction>`, default N5 / A1); shared `app/study/LevelDashboard.tsx`; the right panel is now "Next up" (word, then its meaning); stats rows removed.
- Flashcards: hint line removed; rating buttons stay neutral (no colour after reveal); top half sizes to its content (reading and meaning never clipped at large font sizes), card scrolls if needed, example sentence sits just above Meaning / Furigana.
- Checks: tsc clean, 328/328 tests, eslint 0 errors on changed files. Full-screen styling verified in code only (the browser pane blocks the Fullscreen API).
- Ramen scene 早い example: stored in Supabase `lessons.structured_content`; the database connector here has no permission, so the owner runs the SQL given in chat.

## Round 3 (11 October 2026)
- Speed: `experimental.staleTimes { dynamic: 300, static: 300 }` in `next.config.ts` (visited pages reused for 5 min instead of the root loading screen); `lib/busuu/attempts-cache.ts` (in-memory, per owner) lets Home's Continue card and the course map show the last progress at once and refresh in the background; `/study` reads the saved level synchronously.
- Course button: `/busuu` opens the last course level (cookie `anigo-course-level`, set by the map; A1 first time). `lib/busuu-routes.test.mjs` updated to cover first visit, saved level and invalid value.
- Scene player full screen: taller, stronger fade; translation smaller and in the romaji colour; less space under it. Line-panel translation also smaller and muted.
- Study "Next up" word 1.7x larger (64 → 109px); flashcard word and sentence sit higher with more space between them.
- Checks: tsc clean, 328/328 tests, eslint 0 errors on changed files.
- `next build` passed (11 October 2026): Next.js 16.2.10, 20/20 static pages, 24 routes; only Node DEP0205 deprecation warnings.
