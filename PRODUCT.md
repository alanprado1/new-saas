# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
The owner first, plus other learners (friends, family, possibly public later). They study Japanese on desktop and phone, often in long evening sessions, moving between a structured course, scene-based listening, and flashcard review.

## Product Purpose
ani語 is a Japanese-learning web app. It combines a structured course that closely follows Busuu's Japanese course (map, lessons, grading, checkpoints), AI-generated illustrated scenes with line-by-line audio, a spaced-repetition study deck, and an avatar chat. Success is a learner moving between these without feeling they have left one product for another.

## Positioning
A Busuu-faithful course sitting inside a personal scene library and study deck: the learner hears Japanese in illustrated situations, then drills it, in one place.

## Operating Context
- Routes: Library (`/`, scene grid), Course (`/busuu/[level]` map, lesson launch, lesson runner, results), Study (`/study` level carousel, `/study/[level]/session` flashcards), Scene player (`/lesson/[id]`), Chat (`/voicechat`).
- Course layout and behaviour are matched to Busuu's Learn section; colours are app-owned.
- Existing TTS for all audio. No speaking, microphone or speech-grading features in the course.

## Capabilities and Constraints
- Next.js 16, React 19, Tailwind 4; course styles are CSS modules with `--course-*` tokens; shell pages use many inline styles.
- A user-selectable accent theme switcher exists (`lib/themes.ts`, `hooks/useTheme.ts`) with Gold, Sakura, Cyber, Crimson and Spirit.
- Course structure, event shapes, content versions and saved attempts must be preserved; visual changes must not alter them.
- Learner-facing English uses Australian spelling.

## Brand Commitments
- Name: ani語 (wordmark with 語 highlighted).
- Owner wants a dark, grey/graphite interface everywhere, including inside the course and lessons.
- Keep the accent theme switcher and the current accent families (gold default, sakura, cyber, crimson, spirit), re-tuned so they no longer read as neon on black.
- Owner preference: layout direction of the "Aizome" proposal (icon dock navigation, Home screen with Continue card); graphite tones of the "Night Desk" proposal.

## Evidence on Hand
- AI-generated scene artwork per lesson (stored in Supabase), used on Library cards and the Scene player.
- Screenshots of the current app: `apps/web/content/busuu/b2-polish/` (runner, playthrough) and captures made 10 October 2026.
- No testimonials, metrics or public claims exist; none should be invented.

## Product Principles
1. One product: every route shares one navigation, one token set and one card language.
2. The course stays Busuu-faithful in structure; only colour and type are the app's.
3. Meaning colours (correct, wrong, checkpoint, kanji, fluency) mean the same thing on every screen.
4. Comfortable for long evening sessions: low glare, readable Japanese at small sizes.

## Accessibility & Inclusion
Readable Japanese and English text on dark surfaces (WCAG AA contrast for body text); state shown by more than colour alone (ticks, labels); respect reduced motion.
