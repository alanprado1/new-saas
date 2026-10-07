# L01 persistent attempts validation

**4 October 2026 extension:** the versioned content registry and persistence resolver now support L02/L03 alongside L01. Both new runtime packs are incomplete development previews and are rejected before any saved attempt is created. Their full synthetic fixture sequences were verified against the same isolated PostgreSQL functions, with per-lesson isolation, partial-state/outbox recovery, completion and restart accounting. The original 42 L01 checks were rerun unchanged; the L01 pack/fingerprint remains identical. See [the expansion validation](../expansion-validation/README.md). No new migration or live database modification belongs to this extension. The following record describes the earlier L01 persistence increment.

Validated 4 October 2026, Australia/Sydney. This increment adds persistence only for the existing reviewed B2 chapter 1 lesson 1 runner. The original six-screen pack, source/reference evidence, support timing, audio adapter, deferred visual placeholders and optional-production decisions remain intact.

## Implementation

- `lib/busuu/attempt.ts` validates exact response shapes and replays the existing runner on the server. The API accepts actions, consecutive sequence numbers and immutable request UUIDs; it rejects client scores, outcomes, completion flags, fabricated IDs and invalid order. Lesson ID, content version and SHA-256 of the serialized pack bind starts, saves and acknowledgements to the same content. The retained pack file SHA-256 still matches the prior validation record.
- Existing Supabase cookie authentication is verified with `getUser`. Every request carries the expected account; the authenticated server must match it before reading or writing. Course writes use the existing server-only service key and service-only `SECURITY INVOKER` functions. Authenticated clients have owner-only SELECT policies and no direct mutation/RPC privileges. Both functions have a fixed empty search path. No Study/SRS tables, policies or data were changed.
- Transactional start/restart uses an owner/lesson advisory lock. Restart retains the prior attempt and creates a distinct active attempt. Transactional saves lock the attempt, compare revision and content, reject retired attempts, compare duplicate payloads and commit the event plus evaluated state/result together. A failed transaction leaves neither half written. A completed attempt cannot accept additional answers.
- `attempt-client.ts` keeps immediate local feedback and serializes saves. Account/pack-scoped, independent writer outboxes retain pending actions and request identities through refresh or page closure. Matching endpoints, accepted pairs, mistakes, token slots/removals, feedback and current screen are restored by server state plus pending actions. New tabs can recover a retained queue; concurrent writers never overwrite each other's queue. A conflict remains visible with retry/reopen/restart recovery instead of silently rebasing answers.
- UI distinguishes local results, pending changes and server-confirmed saved results. Completion is labelled saved only after acknowledgement. Failed saves retain responses and expose Retry save. Restricted browser storage still permits server saves, with an explicit notice to keep the page open until acknowledged. Restart requests retain their UUID when retried. Account changes abort and retire the controller/audio; late callbacks cannot update a replacement account.
- The map fetches authenticated, uncached saved attempts and clears its display on account changes. Chapter/level completion counts each genuinely completed course entry once; accuracy is separate and uses the latest completed attempt. Unfinished attempts, previews and optional production generate no completion. Required audio readiness remains an ordered client playback-start observation, not proof that a person listened or spoke.

## Automated evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Web regression and focused tests | 95 passed, 0 failed/skipped | [tests.log](tests.log) |
| Lint | 0 errors; 12 existing warnings | [lint.log](lint.log) |
| Production build and TypeScript | Passed | [build.log](build.log) |
| Isolated PostgreSQL migration/application checks | 42 passed | [database.log](database.log), [database.mjs](database.mjs) |
| Live database independent reads | Saved result, event count and unchanged existing row counts verified | [live-database.json](live-database.json) |

The isolated test installs pinned PGlite 0.5.8 in `runtime/`, creates Supabase-equivalent client/service roles and an auth ownership helper, applies both course migrations and executes the actual server evaluator against PostgreSQL. It tests real writes and reads, invalid/tampered actions, duplicate/conflicting requests, concurrent revision races, transaction rollback, wrong responses, partial matching/token resume, database export/reopen, genuine completion/map projection, restart, content-version/hash mismatch, cross-owner reads/writes and denied client mutation/function access. An existing Study/SRS sentinel stays unchanged. This test never connects to the live database. Reproduce from `apps/web` with `node content/busuu/persistence-validation/database.mjs`; if the validation runtime is absent, install its exact locked dependency in that directory first.

Focused client/API tests also cover failed saves and safe retry, lost acknowledgements, refresh recovery, late initial/save responses, independent/cloned tabs, inaccessible storage, stale same-version content, unauthenticated access, expected-account mismatch, private no-store reads, foreign origin and malformed/oversized requests. Existing renderer, readiness, audio cancellation, navigation, Study and session-cache regressions still pass. An independent review found three recovery issues (writer overwrite, restart after failed open and stale client fingerprint); failing tests reproduced all three before fixes. No review issue remains outstanding.

## Live authenticated browser and database checks

The existing authenticated local app connected to the actual Supabase project. Initial launch wrote an account-owned attempt. Restart created a second attempt and retained the first as inactive. A deliberately wrong true/false response showed immediate correction; refresh/resume restored its acknowledged feedback. A matching endpoint and a single token on the final screen each survived refresh/resume. Real Japanese Edge TTS remained in use; screen changes cancelled audio, and the prior adapter tests cover provider/cancellation failure paths.

The six-screen attempt visibly moved from **local 80% / save pending** to **Lesson completion saved / server-confirmed 80% accuracy**. An independent database query returned revision **22**, exactly **22** event rows, six visited screens, four correct of five graded screens and completion timestamp `2026-10-04T01:19:34.289767Z`. Refresh/resume restored that confirmed result. Returning to the map and navigating afresh showed **L01 completed · saved · 80% accuracy**, **17% chapter completion** (one of six entries) and **1% B2 completion**. Other entries stayed unfinished. An unauthenticated live API request returned 401.

Live Study/lesson row counts before and after were identical: Japanese lessons 36, lesson lines 193, Study progress 257, reviews 0; English lessons 18, lesson lines 130, Study progress 0. Migration SQL exclusively creates course tables/functions/indexes/grants/policies. No learner or validation attempt was deleted. Cross-account checks used isolated PostgreSQL roles and deterministic API/controller tests; the live browser account was not switched.

At **1280 × 720 CSS px**, the map column remained 620px with no horizontal overflow. The desktop runner's saved status and existing model/audio layout were inspected. At **375 × 812 CSS px**, resumed matching, partial tokens, confirmed results and map badges fit without horizontal overflow (document scroll width 360px; runner column 328px, accounting for the scrollbar). Content scrolls vertically and navigation remains accessible. Temporary viewport overrides were reset. Screenshot export scaling is not used to assert CSS dimensions.

| Screenshot | State |
| --- | --- |
| [narrow-resumed-matching.png](narrow-resumed-matching.png) | Saved partial matching endpoint after refresh/resume |
| [narrow-partial-token.png](narrow-partial-token.png) | One placed final-screen token with pending save status |
| [narrow-confirmed-result.png](narrow-confirmed-result.png) | Confirmed saved completion and separate 80% accuracy |
| [narrow-saved-map.png](narrow-saved-map.png) | Saved L01 badge in selected card; other cards unfinished |
| [desktop-saved-map.png](desktop-saved-map.png) | 17% chapter completion, 1% level completion and separate accuracy |

## Database setup and remaining release step

Both additive migrations were validated in isolated PostgreSQL and then applied to **Japanese Saas Project** (`qzxaiuussclxzlzvxuig`). Supabase migration history was read back; repository filenames are aligned to its recorded versions:

1. `supabase/migrations/20261004011140_course_attempts.sql`
2. `supabase/migrations/20261004011331_course_attempt_events_owner_index.sql`

No database setup remains for this project. The second migration covers the composite event/owner foreign key flagged by Supabase's performance advisor. Course functions have no security-advisor findings. New unused-index INFO entries are expected with the small validation dataset; existing unrelated advisor warnings were preserved. See Supabase's [database advisor explanations](https://supabase.com/docs/guides/database/database-linter).

**Remaining release step:** deploy this updated `apps/web` build to the existing web host with its existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY`, pointing at this project. That hosted app deployment was not performed in this increment. The service key must remain server-only. Other environments need only the two specific new course migrations in order; avoid blindly replaying this repository's older migrations against existing data.

## Next bounded task

Expand the existing runner/content registry to **B2 chapter 1 L02–L04 and its checkpoint**, using reviewed versioned packs from the retained evidence and the now-verified attempt protocol. Preserve their recorded **9/10/10/14** base-screen sequences, occurrence-specific support, existing TTS and deferred visuals. Keep **L05 between L04 and CP**, retain its **seven teaching/practice screens** and the checkpoint's cultural sake-vessel teaching dependency; optional speaking/pronunciation and free writing must not replace or skip that teaching. Incomplete required packs/dependencies must not award completion. Validate each new pack and a complete saved/resumed attempt before making it playable. No further capture or general research phase is proposed.
