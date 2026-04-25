# ani語 — Project Guide

## Stack
- **Frontend:** Next.js 16 App Router · TypeScript · Tailwind CSS v4
- **Auth/DB:** Supabase (SSR cookies, Realtime, Storage)
- **Audio/TTS:** Howler.js · VoiceVox (local `localhost:50021` / HuggingFace) · msedge-tts · Gemini TTS
- **Japanese NLP:** Kuromoji (morphological analysis, furigana)
- **Worker:** Node.js `apps/worker/worker.js` — always-on, NOT on Vercel

## Monorepo Layout
```
apps/
  web/          # Next.js app
    app/
      page.tsx              # Dashboard / library grid
      lesson/[id]/page.tsx  # ScenePlayer route
      study/                # SRS flashcard routes
      voicechat/page.tsx    # AvatarChat route
      api/
        generate/route.ts   # LLM lesson creation + bg image
        tts/route.ts        # Per-word TTS proxy
        avatar/route.ts     # Chat LLM + TTS
        voice/route.ts      # Trigger voice regen
        voices/route.ts     # VoiceVox speaker list
    components/
      ScenePlayer.tsx       # Audio player, subtitle chunking, furigana
      AvatarChat.tsx        # Voice chat UI + mic/STT
      StudyCard.tsx         # SRS flashcard with TTS
    lib/
      supabase.ts           # Browser Supabase client + ensureSession()
      lesson.ts             # fetchLessonData(), fetchLibrary()
      sm2.ts                # SM-2 SRS algorithm
      themes.ts             # Theme definitions, TAG_GRADIENTS, LEVELS
      voicevox.ts           # getVoiceVoxUrl(), waitForVoiceVox()
    hooks/useTheme.ts
    proxy.ts                # Next.js middleware (auth guard + session refresh)
    utils/supabase/         # server.ts, client.ts, middleware.ts
  worker/
    worker.js               # Supabase Realtime listener → VoiceVox → Storage
```

## Key Data Flow — Lesson Generation
1. `POST /api/generate` → Gemini generates JSON script → inserts `lessons` row (`status=generating_audio`) + `lesson_lines` rows → returns `202`
2. Client subscribes to Supabase Realtime on `lessons.id`
3. `worker.js` picks up `UPDATE` event → calls VoiceVox per line → uploads `.wav` to Storage bucket `audio/` → sets `status=ready`
4. Client receives Realtime push → navigates to `/lesson/[id]`
5. `after()` in the API route generates a Ghibli-style background image via Gemini (non-blocking)

## DB Tables (key columns)
| Table | Key columns |
|---|---|
| `lessons` | `id, status, scenario, scenario_hash, level, voice_id, structured_content (jsonb), background_tag, background_image_url, error_message` |
| `lesson_lines` | `id, lesson_id, order_index, speaker, kanji, romaji, english, audio_url` |
| `vocabulary` | `id, level, kanji, reading, meaning, example_jp, example_en` |
| `user_card_progress` | `user_id, card_id, repetition, interval, ease_factor, next_review` |

`lessons.status` states: `queued → generating_audio → ready | failed`

## Worker — Critical Details
- Resolves VoiceVox URL **once per job** (local → HF fallback), not per line
- `processingLessons` Set prevents duplicate concurrent processing
- Orphan poller runs every 60 s for lessons stuck >2 min (Realtime delivery not guaranteed)
- Retries each line up to 3× with exponential back-off (2 s base)
- HF Space warm-up timeout: 180 s
- Per-speaker voice map built from `structured_content.character_voices`; falls back to pool `[3,1,8,14,2,10,11,13]`

## TTS Providers & Prefs
- **Scene audio (worker):** VoiceVox only
- **Interactive TTS (browser):** Gemini TTS → Edge TTS → VoiceVox (cascading fallback)
- localStorage keys: `pref_ttsProvider`, `pref_geminiVoice`, `pref_edgeVoice`, `pref_voiceVoxId`, `pref_storyFurigana`, `pref_storyRomaji`, `pref_storyTranslation`

## ScenePlayer — Key Internals
- State machine: `IDLE → PRELOADING → PLAYING_LINE → PAUSED | WAITING_NEXT → COMPLETED | REGENERATING`
- Subtitle chunker: splits at `。、！？…` with `MIN_CHUNK=11`, `MAX_CHUNK=22`; forgiving merge for ≤5-char orphans
- Howler `html5:true` used; AudioContext primed before first play to avoid clipping
- `seekPositionRef` + 80 ms tick drives subtitle chunk advancement (not timers)
- `authorizedIndexRef` prevents stale `onend` callbacks from advancing wrong line
- Fullscreen: real API on desktop; CSS `position:fixed` simulation on iOS

## Auth & Middleware
- `proxy.ts` (matched via `middleware.ts`) guards all non-`/login`, non-`/api/` routes
- Session refresh via `@supabase/ssr` `updateSession()` on every request
- Server routes use `utils/supabase/server.ts`; client components use `utils/supabase/client.ts`

## SRS (Spaced Repetition)
- Algorithm: SM-2 in `lib/sm2.ts`; ratings: `again=0, hard=2, good=4, easy=5`
- Progress persisted to `user_card_progress` via Server Action `saveCardProgress()`
- `getDueCards(level)` returns new + overdue review cards merged

## Env Vars
```
# apps/web/.env.local
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
GROQ_API_KEY

# apps/worker/.env
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
TTS_PROVIDER=voicevox   # or mock
VOICEVOX_URL=http://127.0.0.1:50021
VOICEVOX_HF_URL=https://alanweg2-my-voicevox-api.hf.space
```

## Common Tasks
- **New theme:** add to `lib/themes.ts` matching `Theme` interface (accent, accentRgb, accentMid, accentLow, accentGlow, cardBorder, gradient)
- **New background tag:** add to `BackgroundTagSchema` in `api/generate/route.ts` + `TAG_GRADIENTS`/`TAG_EMOJI` in `themes.ts`
- **Schema change:** update Supabase → update types in `lib/lesson.ts` → update `worker.js` selects if needed

## Troubleshooting
| Symptom | Fix |
|---|---|
| Audio stuck in `rendering voice lines` | Restart `worker.js`; check HF Space (180 s cold start); verify Realtime enabled on `lessons` table |
| Ghost/echo audio | Check `Howler.unload()` and `AudioContext.close()` called on component unmount |
| Session loop / 401s | Check `.env.local` keys; verify `proxy.ts` middleware is matched |
| Wrong voice after change | Cache-bust param added to audio URLs on voice regen — check Supabase Storage upload succeeded |