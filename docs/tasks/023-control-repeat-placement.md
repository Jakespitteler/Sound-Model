# 023 — Hold Control to place multiple machines

Status: Ready to plan implementation.
Task creation explicitly requested by the owner on 17 November 2026.

## Problem and scope

While in Place machine mode, a Ctrl-click adds a machine and leaves that placement mode active for the next click. A normal click places one machine and exits as today. Release Control and click to place the final machine, or press Escape/cancel to exit without another placement.

## Exclusions

No new framework, service, unapproved propagation engine or full assessment platform. These
briefs authorise planning of the requested POC features, not implementation within the
documentation PR. Keep future implementation in separate focused PRs.

## Acceptance

- [ ] Several Ctrl-clicks place distinct source instances of the selected type, with correct coordinates and unique IDs.
- [ ] Normal single placement, Escape/cancel, the 100-source limit and receiver placement retain predictable behaviour; no extra machine is added when cancelling.
- [ ] Each accepted placement updates combined sound normally and participates in recovery/undo when those features are present; no new input library is introduced.

## Verification

Exercise Ctrl-held clicks, release/final click, Escape, type selection and the source-count boundary. Inspect the active placement hint and resulting icons; confirm ordinary map navigation is unchanged. Do not repurpose Ctrl-drag as contour editing.

## Likely files

- `src/static/js/map-manager.js`
- `src/static/js/state.js`
- `src/static/js/main.js`

Record the chosen scope, commit, actual checks and remaining limits here when work proceeds.
