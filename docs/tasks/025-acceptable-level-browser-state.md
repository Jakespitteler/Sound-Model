# 025 — Preserve the acceptable level in browser state

Status: Implemented; ready for review after 021; prerequisite for 022.
Part of the owner's requested special-contour feature, split to keep implementation small.

## Scope

Add the optional acceptable level to browser state, shared JSDoc types and the saved snapshot/
restore path. Validate 0–300 dB(A) or unset. Count it within the existing 25-unique-level limit,
reusing an ordinary level if they match. Keep it as metadata until task 022 connects the line UI.

## Acceptance

- [x] Set/unset values survive Save/Open and recovery, and old records default to unset.
- [x] Adding/editing an ordinary or special level cannot exceed 25 unique levels or silently drop another line.
- [x] The setting changes neither source power nor the underlying acoustic equations; catalogue notes and IDs remain intact.

## Verification

Exercise set/clear, matching levels, the 25-level boundary, old records, Save/Open and recovery.
Use existing schema validation and compare saved snapshots. Record actual outcomes here.

## Likely files

- `src/static/js/state.js`
- `src/static/js/types.js`
- `src/static/js/scenario-files.js`

No new library or regulatory default. This task does not implement the line renderer or claim
an acceptable threshold has been approved by an acoustic reviewer.

## Evidence

State defaults to null, validates finite numeric 0–300 values or unset, and derives distinct
thresholds/line settings without including the reference in receiver/acoustic source payloads.
Snapshots persist it; restore defaults legacy omissions to null and rejects an invalid union
budget before changing the scene. Ordinary add/edit also honours the combined 25-level cap,
sharing an existing special slot when possible. No line is silently removed.

The dependency-free browser page `tests/browser/acceptable-level.html` checks 24 behaviours,
including invalid inputs, zero, matching/full/split budget cases, immutable rejected edits,
snapshot/restore, unset legacy files, intact identities/catalogue notes and unchanged acoustic
payloads. It initially failed on the missing unset default. Full UI Save/Open/recovery checks
follow with task 022. This slice has three runtime modules and no visible editor or physics change.
