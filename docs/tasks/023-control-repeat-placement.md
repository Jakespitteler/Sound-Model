# 023 — Hold Control to place multiple machines

Status: Implemented; ready for review.
Task creation explicitly requested by the owner on 17 November 2026.

## Problem and scope

While in Place machine mode, a Ctrl-click adds a machine and leaves that placement mode active for the next click. A normal click places one machine and exits as today. Release Control and click to place the final machine, or press Escape/cancel to exit without another placement.

## Exclusions

No new framework, service, unapproved propagation engine or full assessment platform. These
briefs authorise planning of the requested POC features, not implementation within the
documentation PR. Keep future implementation in separate focused PRs.

## Acceptance

- [x] Several Ctrl-clicks place distinct source instances of the selected type, with correct coordinates and unique IDs.
- [x] Normal single placement, Escape/cancel, the 100-source limit and receiver placement retain predictable behaviour; no extra machine is added when cancelling.
- [x] Each accepted placement updates combined sound normally and participates in recovery/undo when those features are present; no new input library is introduced.

## Verification

Exercise Ctrl-held clicks, release/final click, Escape, type selection and the source-count boundary. Inspect the active placement hint and resulting icons; confirm ordinary map navigation is unchanged. Do not repurpose Ctrl-drag as contour editing.

## Likely files

- `src/static/js/map-manager.js`
- `src/static/js/state.js`
- `src/static/js/main.js`

Record the chosen scope, commit, actual checks and remaining limits here when work proceeds.


## Implementation and evidence

`MapManager` resumes source mode only after an accepted Ctrl-click below the 100-source
cap. Normal placement uses the existing store unchanged; repeat mode is transient and not
saved. The active placement hint explains Ctrl-click and Escape. No dependency, equation,
request lane or scenario-schema change.

`tests/browser/repeat-placement.html` passes 14 checks using the actual Leaflet event
binding and store: distinct IDs/coordinates, selected-type changes, final ordinary click,
per-source geometry notifications, payloads, undo/redo, cancellation, receivers and the
99/100 boundary. It first failed on the old one-click behaviour.

Actual Chromium mouse/keyboard checks additionally pass repeated Ctrl-clicks, release/final
click, Escape and Cancel, single-use receiver placement, undo/redo, browser recovery after
reload and no contour calls on panning. Inspected screenshots include active placement and
restored objects; artifacts live under `/workspace/artifacts/repeat-placement-*.png` with
`check_repeat_placement.py`. Satellite imagery was unavailable. The existing low-level contour
extraction guard reported a 30 dB failure in this scene while other lines remained visible;
this placement task does not alter that calculation.

Verification: 110 pytest tests, Ruff, formatting, Pyright and Agent Skills integrity pass.
The existing placement-history browser page passes 23 checks alongside the 14 new checks.
Desktop and 390 px screenshots were inspected; the narrow layout has no horizontal overflow.
