# Shared runner / TTS validation

**Persistence superseding record, 4 October 2026:** L01 now has versioned account-owned server evaluation, ordered idempotent saves, retained-response recovery, resume/restart and genuine saved map progress. Both course-only migrations are applied to the existing Supabase project; actual authenticated writes/reads and completion after refresh were verified. See [persistent-attempt validation](../persistence-validation/README.md) for current tests, database evidence, desktop/narrow screenshots and the remaining hosted-app release step. Next bounded work is L02–L04 and CP, retaining L05 teaching. The local-only statements and 79-test evidence below remain the unchanged historical record of the earlier runner/TTS increment.

Validated 4 October 2026, Australia/Sydney. This increment is limited to the shared lesson engine, five renderer families, Japanese TTS delivery and B2 chapter 1 lesson 1. Assessment remains in memory for one attempt. No progress records, migrations, rewards or original media acquisition were added.

## Playable content

`/busuu/B2/lesson/B2.C01.L01` launches the reviewed `b2-c01-l01.v1.json` pack, schema 1.0 / content version 1.0.0. All six required fixed-screen configurations are complete: model, true/false, three-register matching, stem gap with supplied `ました`, sentence choice and two ordered token gaps. The model is ungraded; the other five screens receive equal local weighting. Feedback and replay do not create additional screens.

No required L01 prompt, fixed bank, answer mapping or visible support wording remains unresolved after reviewing the retained before-answer and feedback screenshots. Unknown source facts remain explicit: raw option IDs, hidden accepted variants, shuffle/retry policies, the source scoring formula, precise audio alignment and millisecond timing. Original recordings, portraits and video remain deferred; neutral placeholders and app TTS are identified replacements. Wrong-answer policies and equal local weighting are app decisions. Other lessons without complete packs remain unavailable. Development previews are explicitly marked and never award a score or completion.

## Automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| Existing and new web tests | 79 passed, 0 failed, 0 skipped | [tests.log](tests.log) |
| Lint | Passed; 0 errors, 12 pre-existing warnings | [lint.log](lint.log) |
| Production build / TypeScript / route generation | Passed | [build.log](build.log) |
| Independent read-only implementation review | No critical or important findings; minor preview audio-gap copy omission fixed and regression tested | Review within this implementation chat |
| Offline pack regeneration | Byte-identical | [provenance.json](provenance.json) |
| Retained input/reference checksums | Six inputs, 38 screenshots and 18 pack references verified | [provenance.json](provenance.json) |

Tests cover final-pair grading and either-side selection; immediate choice grading; supplied suffix and ordered slots; token removal and restoration; repeated and stale screen actions; hidden pre-answer support; missing text, answers, audio and unsupported renderer guards; non-scoring preview and exit; canonical multi-activity sequencing; account/voice-aware caching, replay and speed; deduplicated loading; screen/account cancellation; stale fetch, JSON and playback callbacks; invalid audio, provider/playback failures, timeout and retry. Fixtures are created in test code and are never imported into the production pack. Existing Node module-type/deprecation warnings remain.

## Authenticated browser checks

The existing local authenticated app was exercised with real Edge Japanese TTS. One full correct path reached **100%, 5/5 graded screens, 6/6 base screens**. Returning to the chapter retained the selected L01 card and **zero saved course progress**. Relaunch and exit returned to lesson details. Required audio initially disabled response/Continue, then enabled them when playback started. The live synthesis completed too quickly to click the transient Cancel control during the final desktop check; timeout, cancellation and stale-response recovery are covered by deterministic adapter tests. Account switching was tested through the adapter/auth lifecycle contract without changing the user's live account. VoiceVox request shape and recovery were tested with injected responses; a live VoiceVox provider run was not performed.

At **1280 × 720 CSS px**, the lesson used a 512px content column without horizontal overflow. At **375 × 812 CSS px**, matching, feedback, two-gap tokens and results fit without horizontal overflow; longer content scrolls vertically and the course/runner headers remain accessible. DOM measurements establish CSS sizes; screenshot export dimensions are not claimed to equal CSS pixels. Temporary browser viewport overrides were reset after validation. No new live Busuu capture was performed.

| Screenshot | Observed state |
| --- | --- |
| [desktop-model.jpg](desktop-model.jpg) | First model, two script layers, translation, replaceable media and TTS replay |
| [desktop-supplied-suffix.jpg](desktop-supplied-suffix.jpg) | Stem gap with supplied past suffix before feedback |
| [narrow-matching.jpg](narrow-matching.jpg) | Three-register matching before final-pair feedback |
| [narrow-matching-feedback.jpg](narrow-matching-feedback.jpg) | Final pair graded; explanation appears after answering |
| [narrow-two-gap.jpg](narrow-two-gap.jpg) | Two-gap token bank before answering |
| [narrow-two-gap-feedback.jpg](narrow-two-gap-feedback.jpg) | Both tokens placed; immediate feedback |
| [narrow-result.jpg](narrow-result.jpg) | Local result and six-screen count |
| [desktop-result.jpg](desktop-result.jpg) | Desktop result and return to chapter |

## Next bounded implementation task

Persist **L01** attempts and progress: evaluate the versioned pack on the server, save answers idempotently, resume the account-owned attempt and update verified completion on the existing map. Introduce persistence/migrations only in that next increment. No additional general research phase is required.
