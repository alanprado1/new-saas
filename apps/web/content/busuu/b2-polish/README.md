# B2 polish: local walkthrough mode

Play the real course (map, lesson launch, runner, results, reload/resume, map progress) at localhost without Supabase sign-in and without any hosted database access. Development only.

## Start

It can run beside a normal `next dev` for `apps/web` (it uses its own build cache at `.next/walkthrough`). From the repo root:

```powershell
node apps/web/scripts/busuu-walkthrough.mjs 3100
```

or start the `busuu-walkthrough` entry of `.claude/launch.json` (port 3100). Open `http://localhost:3100/busuu/B2`. Stop the server to reset all progress.

The launcher sets `BUSUU_LOCAL_WALKTHROUGH=1`, binds to `127.0.0.1` only, and replaces the Supabase URL/keys for that one process with inert values, so a hosted Supabase call cannot happen even by mistake.

## What it does

- Opens only `/busuu/**`, `/api/course/attempts`, `/api/tts` and `/api/voices` without auth, as the fixed synthetic owner `local-walkthrough-owner`. Everything else (`/`, `/study`, `/api/generate`, ...) keeps its normal auth (redirect to `/login` / 401).
- Course persistence (start, events, save, completion, map progress, resume, restart) goes to an in-memory port of the `course_start_attempt` / `course_save_event` RPC contract (`lib/busuu/local-walkthrough.ts`). The real attempt server/evaluator, packs, versions and fingerprints are unchanged. Memory lasts for the server process; restarting resets it.
- Browser course components get the synthetic owner from a stand-in auth source instead of the Supabase browser client.

## Safety gates (all three required, otherwise behavior is identical to normal)

1. `NODE_ENV === 'development'` (inlined at build time, so production builds can never enable it).
2. `BUSUU_LOCAL_WALKTHROUGH=1`.
3. Request URL host and `Host` header are both `localhost`, `127.0.0.1` or `[::1]` (also rejects DNS-rebinding hosts).

Gate code: `lib/busuu/local-walkthrough.ts`; hooks: `proxy.ts`, `app/api/course/attempts/route.ts`, `components/busuu/{SavedCourseMap,LessonRunner}.tsx`, `next.config.ts`. Tests: `lib/busuu-local-walkthrough.test.mjs`.

## Limitations

- **Audio:** `/api/tts` and `/api/voices` are opened by the same gate (no Supabase user check; their other behavior and input validation are unchanged). Audio still depends on the external TTS providers (Edge TTS, VoiceVox), so it needs internet or a local VoiceVox.
- The browser keeps its course outbox in `localStorage` per owner. After restarting the server, clear `localhost:3100` site data if a lesson shows stale resume state.
- Not a database or RLS test; it reuses the disposable-memory approach of the `*-validation/saved-path.mjs` scripts.
- The root layout's background `POST /api/worker/wake` returns 401 in this mode (harmless).
