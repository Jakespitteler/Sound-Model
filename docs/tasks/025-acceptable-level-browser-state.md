# 025 — Preserve the acceptable level in browser state

Status: Blocked until 021 is complete; prerequisite for 022.
Part of the owner's requested special-contour feature, split to keep implementation small.

## Scope

Add the optional acceptable level to browser state, shared JSDoc types and the saved snapshot/
restore path. Validate 0–300 dB(A) or unset. Count it within the existing 25-unique-level limit,
reusing an ordinary level if they match. Keep it as metadata until task 022 connects the line UI.

## Acceptance

- [ ] Set/unset values survive Save/Open and recovery, and old records default to unset.
- [ ] Adding/editing an ordinary or special level cannot exceed 25 unique levels or silently drop another line.
- [ ] The setting changes neither source power nor the underlying acoustic equations; catalogue notes and IDs remain intact.

## Verification

Exercise set/clear, matching levels, the 25-level boundary, old records, Save/Open and recovery.
Use existing schema validation and compare saved snapshots. Record actual outcomes here.

## Likely files

- `src/static/js/state.js`
- `src/static/js/types.js`
- `src/static/js/scenario-files.js`

No new library or regulatory default. This task does not implement the line renderer or claim
an acceptable threshold has been approved by an acoustic reviewer.
