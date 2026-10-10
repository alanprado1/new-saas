# Graphite theme and Dock shell — implementation spec (10 October 2026)

Owner-approved direction: the "ani語 Graphite" proposal, `planning/2026-10-10-graphite-theme/mockup/index.html`
(open it in a browser, or read its CSS; its `.m`, `.dock`, `.home`, `.lib`, `.sp-*`, `.course`, `.ls`, `.study`, `.fcw` rules are the visual reference, its PRESETS/GROUNDS/ACCENTS objects are the source of colour values). Real current-app screenshots are in `mockup/img/now-*`.

Owner decisions (binding):
- Implement everything in the proposal EXCEPT: layout is **Dock only** (no sidebar, no shelf); strength is **Quiet only** (no Committed variant).
- The theme button changes the accent colour exactly as today (five accents: gold, sakura, cyber, crimson, spirit, re-tuned values below).
- Next to the theme button is a **chevron-down** button that opens a ground picker (Graphite, Slate, Charcoal). Ground is saved separately and **stays saved when the accent changes**.
- Busuu course, lessons, kanji screens, Study, flashcards, Scene player and Chat are all dark graphite.
- Backup of the pre-change source: `backups/2026-10-10-pre-graphite-apps-web.tgz` (repo root). Not a git repo.

## 1. Tokens (globals.css, owned by the shell agent)

Defined on `:root` (defaults = graphite + gold) and swapped by attributes on `<html>`:
`data-ground="graphite|slate|charcoal"` and `data-accent="gold|sakura|cyber|crimson|spirit"`.

| token | graphite | slate | charcoal |
|---|---|---|---|
| `--g` (page) | #1b1c1f | #17171d | #121315 |
| `--s1` (surface) | #232428 | #1f1f27 | #1a1b1e |
| `--s2` (raised) | #2b2d31 | #272831 | #212327 |
| `--s3` (control/track) | #34363b | #30313b | #2a2c30 |
| `--ln` (line) | #393b41 | #363846 | #2f3135 |
| `--ink` | #ecebe6 | #ebebf1 | #efeeea |
| `--mut` | #a7a59e | #a4a5b5 | #a3a29c |
| `--faint` | #77766f | #727384 | #6e6d68 |

| accent | `--acc` | `--acc-ink` (text on accent) | `--acc-rgb` | was |
|---|---|---|---|---|
| gold | #e2b752 | #2a1f05 | 226,183,82 | #f5c842 |
| sakura | #e595b6 | #2e1020 | 229,149,182 | #ff6eb4 |
| cyber | #4dbfb1 | #072723 | 77,191,177 | #00ffe0 |
| crimson | #df7357 | #2d0d07 | 223,115,87 | #ff4d4d |
| spirit | #a490ee | #1b1236 | 164,144,238 | #b388ff |

Derived (all themes): `--acc-soft: color-mix(in srgb, var(--acc) 14%, transparent)`, `--acc-line: color-mix(in srgb, var(--acc) 42%, transparent)`, `--tile: color-mix(in oklab, var(--acc) 34%, var(--g))` (kanji tiles/avatars, white glyph).
Meaning colours (fixed): `--ok #45c08a`, `--ok-ink #062618`, `--bad #ec6f7a`, `--medal #e89b3c`, `--flu #9d8be8`.
Quiet strength: dock background `--s1`; active dock item `--acc-soft` background with `--acc` text/icon.
Fonts via `next/font/google` in `app/layout.tsx`, exposed as `--f-ui` (Figtree), `--f-jp` (BIZ UDPGothic; interface Japanese), `--f-study` (Klee One; words being studied: flashcard word/sentence, scene-player lines, kanji glyphs, lesson teaching text). JP fonts `preload: false`. Remove the Google Fonts `@import` of Noto Sans/Serif JP where it is replaced.
`body`/`html` background `var(--g)`, text `var(--ink)`, `color-scheme: dark`; delete the purple radial `--app-gradient` and the noise overlay. Focus ring `var(--acc)`. `::selection` accent. Viewport `themeColor` #1b1c1f.
No glows: no coloured box-shadow halos, no `drop-shadow` glows, no gradient text or gradient progress fills, no emoji used as icons (⛩ etc.). Depth = surface steps + one soft dark shadow (`0 18px 40px -12px rgba(0,0,0,.55)`) for popovers only.

## 2. Theme state (lib/themes.ts, hooks/useTheme.ts — shell agent)

- `THEMES` keeps the same five names and the `Theme` interface fields (other components read them); update values to the re-tuned accents; `accentMid/Low/Glow/cardBorder` become plain alpha mixes of the new accent; `gradient: "none"`. Labels without emoji ("Gold", "Sakura", "Cyber", "Crimson", "Spirit").
- `useTheme()` returns `{ theme, setTheme, ground, setGround }`. Accent persists under the existing key `anigo-theme` (names unchanged, so saved choices carry over); ground under new key `anigo-ground` (default `graphite`). Setting one never touches the other. Both write `data-accent`/`data-ground` on `document.documentElement` and broadcast to other hook instances (e.g. a `storage`-style custom event) so every mounted component updates live.
- No flash: a tiny inline script in `<head>` of `app/layout.tsx` reads both keys and sets the attributes before paint (wrap in try/catch). Add `suppressHydrationWarning` on `<html>`.
- Components should colour themselves from CSS variables (`var(--acc)`, `rgba(var(--acc-rgb), x)`) rather than the JS `theme` object, so a change in the dock re-themes the whole page without prop drilling.

## 3. Shell (components/shell/* — shell agent)

`<AppShell active="home" | "library" | "course" | "study" | "chat">{children}</AppShell>` from `@/components/shell/AppShell`.
- ≥768px: fixed left **Dock**, 88px wide, full height, `--s1` background, right border `--ln`. Top: 語 mark tile (44px, `--s3`, accent glyph) linking to `/`. Items (icon + label, 68px wide, radius 14): Home `/`, Library `/library`, Course `/busuu`, Study `/study`, Chat `/voicechat`. Bottom: theme control, then account avatar button.
- <768px: bottom tab bar with the same five items (icon over label), safe-area bottom padding; the theme control and account move into a top-right compact button group on Home and Library (or an account sheet) — keep both reachable on phones.
- **Theme control**: a joined pair — palette button (opens the accent list: five swatches + names, current ticked; choosing sets accent only) and a chevron-down button (opens the ground list: Graphite / Slate / Charcoal with a small swatch, current ticked; choosing sets ground only). Popovers: `--s2`, `--ln` border, radius 14, close on outside click and Escape, keyboard reachable, `aria-expanded`.
- **Account**: whatever the current Library header offers (account/settings, sign out, if present) moves to the avatar button's menu. Also a **Credits** link (`/busuu/credits`) in that menu — it carries the kanji artwork licence notices and must stay reachable.
- Content area: `margin-left: 88px` desktop; `padding-bottom` for the tab bar on phones.
- Full-screen surfaces with no shell (as today): Busuu lesson runner (`/busuu/[level]/lesson/...`), flashcard session (`/study/[level]/session`), login/auth pages.

## 4. Routes

- `/` becomes **Home** (new). `/library` is the current Scene library (move the page, keep all functions: level filter, mine/all scope, language selector, New scene/generate modal, cards → `/lesson/[id]`).
- Update links that mean "Library" (`app/lesson/[id]/page.tsx` back button → `/library`; any others found). `/voicechat` close can go to `/`.
- `proxy.ts`: `/library` must be auth-protected exactly like `/` (check `PUBLIC_PAGE_ROUTES` and matcher; do not loosen anything; local walkthrough gate unchanged).
- Home content (from existing data only; no new tables, no schema changes): greeting `おかえり` + "Welcome back" + date; **Continue** card for the course (latest in-progress Busuu lesson if obtainable from an existing read path; otherwise a "Continue the course" card linking `/busuu`); **Study** card (due/review count for the current study level if an existing read gives it, else link to `/study`); **Your scenes** (latest four scene cards, same data as Library). Use the course's ring-avatar look for the Continue card. Do not invent numbers.

## 5. Surfaces

- **Library** (`/library`): graphite cards, scene art shown undimmed (16:10), level pill over the art bottom-left, title + place · date below. Header: "Scene library" + count, segmented controls (Mine + shared / All users; All / Beginner / Intermediate / Advanced), language selector, New scene button (accent). Generate modal and other dialogs restyled with tokens.
- **Busuu course** (`app/busuu/*.module.css`, `components/busuu/*`): remap `--course-*` to tokens (`accent→--acc`, `accent-soft→--acc-soft`, `page→--g`, `surface→--s1`, `ink→--ink`, `muted→--mut`, `border→--ln`, `success→--ok`, `blue→--tile` for kanji, `medal→--medal`, `fluency→--flu`), `color-scheme: dark`, and replace every hard-coded light literal (#000 headings, #fff surfaces, #e6eef8 avatars, light fills, shadows) with tokens. Lesson feedback fills: correct `color-mix(in oklab, var(--ok) 20%, var(--s1))`, wrong same with `--bad`; borders full colour. Launch popover: `--acc` background, `--acc-ink` text, inner button `--g` with `--ink`. Kanji tile: `--tile` with white glyph in `--f-study`. Map pages render inside `AppShell active="course"`; remove `CourseHeader` and keep a small Credits link on the map page. Lessons stay full-screen. **Layout, measurements, behaviour, events, state and content are unchanged.**
- **Study** (`/study`, `/study/[level]`): replace the 3D carousel with a plain row of level tiles N5–N1 (active tile `--acc-soft` + accent border, progress meter when data exists). `/study/[level]` shows the level row plus the Auto-Learn panel (level progress, New words, Review words, "Study N cards" accent button, direction toggle if it exists) and the stats panel. Same data and actions as today.
- **Flashcard session** (`SessionClient.tsx`, `StudyCard.tsx`, skeleton): graphite card, `--f-study` for the word and example sentence, furigana in `--acc` via ruby, meaning in `--acc`. Rating buttons Again/Hard/Good/Easy tinted `--bad`/`--medal`/`--ok`/`--acc` (14% fill, 34% border, full-colour text); before reveal render them muted (still working exactly as now). Settings sheet restyled. Keep every behaviour, timer, keyboard shortcut and grading call unchanged.
- **Scene player** (`components/ScenePlayer.tsx`, `app/lesson/[id]/page.tsx`): inside `AppShell active="library"`. Desktop ≥1024px: stage (art) + current-line panel on the left; right column 360px with tabs Transcript / Vocabulary / Grammar (existing content). Phone: stage, current line, controls, toggles, then transcript. Toggles (振り仮名 / Romaji / EN) as small outlined buttons, on-state `--acc-soft` + `--acc-line` + `--acc` text. Furigana `--acc`. Keep every playback, TTS, fullscreen, settings and voice behaviour.
- **Signature (only ornament)**: the line currently being spoken gets an accent underline (3px, `--acc`) whose width follows audio progress (background-size from currentTime/duration; if progress is not available, full-width while playing). Same treatment on the flashcard example sentence while its audio plays. Respect reduced motion (no animation, just the static underline).
- **Chat** (`/voicechat`, `components/AvatarChat.tsx`): tokens and `AppShell active="chat"`; no behaviour changes.

## 6. Constraints and checks

- Do not change course packs, versions, fingerprints, events, state shapes, API contracts, database, or TTS logic. No new dependencies beyond `next/font` (built in).
- Learner-facing English: Australian spelling.
- Never stop/restart the owner's `:3000` dev server and never run `next build`. Use `npx tsc --noEmit` (from `apps/web`) and the relevant `node --test lib/<file>.test.mjs` suites. Some tests read component/CSS source (e.g. `busuu-navigation`, `busuu-lesson-runner-ui`, `busuu-renderer`, `busuu-routes`, `busuu-scene-context`); update a test only where it asserts a removed visual detail (e.g. the old CourseHeader links), never to weaken a behaviour assertion — report each test edit.
- Browser checks: course pages in local walkthrough mode on :3100 (`apps/web/content/busuu/b2-polish/README.md`); signed-in pages on the owner's :3000 (HMR picks up edits) — read-only browsing, do not create scenes, rate cards or change data.
