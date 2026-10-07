# B2 chapter 3 implementation plan

Goal: seven playable saved core entries, 98 required screens from 99 retained surfaces.
Spec: Chapter-2-Complete-and-Chapter-3-Handoff.md (owner-approved execution scope).

Architecture: immutable reviewed 1.0.0 packs assembled offline; shared configurable service dialogue, version-bound scene context and one-pass end retry. Preserve old pack hashes and state/result shapes; new retry fields occur only for configured packs.

- [x] Author L01–L06/CP using retained chapter 3 structure and occurrence targets, review readings/translations/mappings, separate L05 writing.
- [x] Add configurable speaker labels/translation visibility and versioned external scene context. Validate fact bindings against exact scene, show separate prelaunch review, hide source/replay on CP S04. Add focused component/readiness tests before behavior changes.
- [x] Add one end retry for configured wrong audio-only occurrence, using existing validated response events and conditional retry state. First outcomes remain immutable; separate retry report; completion follows one retry pass regardless of correctness. Test resume, audio gating, invalid events and unchanged old shapes.
- [x] Register packs, independently review responses and complete actual API/client/evaluator paths against isolated PostgreSQL. Reuse established transport/ownership baseline; preserve released fingerprints.
- [x] Run web tests, lint, build once after fixes; inspect new UI briefly; update skill/map/status and prepare whole chapter 4 handoff.

Review focus: hidden context support/replay; optional count/source numbering; unique repeated tokens; first-score versus retry; exact old versions.
