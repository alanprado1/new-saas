# Continue Project Guide for ani語

This guide is intended to help developers understand the ani語 (ani-go) Japanese learning SaaS application architecture, development workflow, and coding conventions.

## 1. Project Overview
ani語 is a Japanese learning application featuring AI-generated scenarios, an interactive audio lesson player, flashcard study with Spaced Repetition System (SRS) using the SuperMemo-2 (SM-2) algorithm, and a voice chat module for conversational practice.

**Key Technologies:**
- **Frontend Framework:** Next.js (App Router, v16.1.6)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4, custom inline styles for animations and specific UI components
- **Authentication & Database:** Supabase (@supabase/ssr, @supabase/supabase-js)
- **Audio & TTS:** Howler.js, VoiceVox (local & cloud via HuggingFace), msedge-tts
- **Japanese Text Processing:** Kuromoji (morphological analysis)
- **Backend/Worker:** Node.js worker for asynchronous TTS generation

### High-Level Architecture
The project follows a monorepo-style structure inside the `apps` folder, consisting of two main services:
1. `apps/web`: The Next.js frontend and API routes.
2. `apps/worker`: A local/server-based Node.js worker responsible for listening to Supabase Realtime events and generating Text-To-Speech (TTS) audio files using VoiceVox.

## 2. Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- Supabase Project (Database, Auth, Storage set up)
- VoiceVox running locally (`http://127.0.0.1:50021`) or configured via HuggingFace Space.

### Installation
1. Clone the repository.
2. Install dependencies for both apps:
   ```bash
   cd apps/web && npm install
   cd ../worker && npm install
   ```

### Environment Configuration
**`apps/web/.env.local`** (Requires Next.js Supabase setup)
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# AI Provider keys (e.g., OPENAI_API_KEY)
```

**`apps/worker/.env`**
```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
TTS_PROVIDER=voicevox # or "mock"
VOICEVOX_URL=http://127.0.0.1:50021
VOICEVOX_HF_URL=https://alanweg2-my-voicevox-api.hf.space
```

### Basic Usage
Start the web app:
```bash
cd apps/web && npm run dev
```

Start the audio worker:
```bash
cd apps/worker && node worker.js
```

## 3. Project Structure

### `apps/web`
- **`app/`**: Next.js App Router pages.
  - `page.tsx`: Dashboard / Library Grid view.
  - `api/`: API routes (e.g., generation, proxy logic).
  - `lesson/[id]/`: Scene player for individual lessons.
  - `study/`: SRS flashcard interface.
  - `voicechat/`: AI tutor conversational practice.
- **`components/`**: React components.
  - `ScenePlayer.tsx`: Interactive dialogue and audio playback.
  - `AvatarChat.tsx`: Interface for the AI chat module.
  - `StudyCard.tsx`: Reusable flashcard component.
- **`lib/`**: Core domain logic and utilities.
  - `supabase.ts`: Supabase client initialization.
  - `sm2.ts` & `srs.ts`: Spaced Repetition System logic.
  - `themes.ts`: Application themes and level configurations.
- **`proxy.ts`**: Middleware to handle Supabase session refresh and route protection.
- **`next.config.ts`**: Next.js configuration, notably uses `experimental.after` for non-blocking background tasks.

### `apps/worker`
- **`worker.js`**: Core script that subscribes to Supabase Realtime (`lessons` table updates). When a lesson is marked as `generating_audio`, it fetches the lines, queries VoiceVox, uploads `.wav` files to Supabase Storage, and updates the DB.

## 4. Development Workflow

- **Authentication & Middleware:** All pages except `/login` and API routes are protected by the proxy middleware (`apps/web/proxy.ts`). 
- **Database Realtime:** The UI utilizes Supabase Realtime channels to detect when the worker completes audio generation.
- **Background Tasks:** The API uses Next.js 15+ `after()` API to perform operations (like generating background images) without blocking the client response that triggers the audio worker.

## 5. Key Concepts

### Scene Generation Flow
1. User requests a scenario on the Dashboard.
2. Next.js API generates the structured content (Japanese text, translation, kanji, roles) via LLM and inserts it into Supabase with status `generating_audio`.
3. Client receives `202 Accepted` and subscribes to DB changes.
4. `worker.js` detects the new lesson, iterates through the lines, and requests audio from VoiceVox.
5. Worker uploads audio to Supabase Storage, updates the row to status `ready`.
6. Client receives realtime update, redirects to `/lesson/[id]`.

### Spaced Repetition (SRS)
- Handled primarily by `lib/sm2.ts` and `lib/srs.ts`. Flashcards are graded and scheduled dynamically based on user recall performance.

### VoiceVox Integration
- `worker.js` manages connections to VoiceVox. It has a pre-warming mechanism for HuggingFace spaces to mitigate cold-start delays.
- Features exponential backoff and a fallback `MockProvider` for robust development.

## 6. Common Tasks

### Adding a New Theme
1. Open `apps/web/lib/themes.ts`.
2. Add a new theme definition matching the `Theme` interface (needs a name, gradients, and specific RGBA accent colors).

### Modifying the Database Schema
If you change `lessons` or `lesson_lines` tables:
1. Update Supabase backend schemas.
2. Regenerate Supabase TypeScript types (if utilized) or manually update typings in `apps/web/lib/lesson.ts`.
3. Ensure `worker.js` selects the newly added columns if needed.

## 7. Troubleshooting

**Audio Generation is Stuck:**
- Verify `worker.js` is running locally or on a stable server.
- Check the worker console for VoiceVox timeout errors. The HuggingFace space may be waking up (can take up to 180s).
- Verify Supabase Realtime is enabled on the `lessons` table.

**Audio Echo/Ghost Voices in UI:**
- The architecture was updated to separate `/lesson` and `/voicechat` routes entirely. Ensure `Howler.js` and `AudioContext` instances are properly unmounted in cleanup functions if making changes to `ScenePlayer` or `AvatarChat`.

**Session Timeouts on Page Load:**
- Ensure `.env.local` contains valid Supabase keys.
- Check `proxy.ts` is running and properly updating session cookies.

## 8. References
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Supabase SSR Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [VoiceVox Engine API](https://voicevox.github.io/voicevox_engine/api/)
- [Howler.js Documentation](https://howlerjs.com/)
