# 033 — Estimate an operating area from measurements

Status: Implemented; fitting API and editor PRs stacked for review.
Depends on: [031 Measurement pins](031-site-measurement-pins.md), shared fitting tools in [032](032-machine-measurement-calibration.md).

## Approved scope

The owner approved estimating site noise with no individual machines placed, using a marked
operating area and readings from similar conditions. First use one fixed equivalent source,
not an inferred distribution of equipment. A centre and circular footprint are the bounded
POC representation; radius does not change the spreading equation. Outside observations fit
or check the estimate; inside observations remain as context. No interpolation/extrapolated
measurement heatmap, fitted source location, distributed-source inverse model or new dependency.

Reuse task 032's background correction, explicit fit/check roles and reviewed application.
Mixed/unknown isolation is acceptable for combined site noise; unknown metric, duration,
activity or background remains a limitation. All selected readings must represent one activity
or site operating state. If sources already exist, explicit replacement prevents counting the
same machinery twice. Preserve measurements, receivers and original catalogue data.

## Acceptance

- [x] An area centre and radius can be marked without placing any machines; suitable outside readings yield a preview with held-back checks.
- [x] Interior/incompatible/background-dominated readings retain explicit reasons. Mixed site readings do not become individual-machine evidence.
- [x] Applying creates one labeled area source feeding existing receiver and contour calculations; replacement is deliberate and original records/evidence persist.
- [x] Browser checks, numeric tests and inspected screenshots cover source-free operation, invalidation and saving; the equivalent-point limitation is clear.

See the [shared fitting contract](../measurement-fitting.md). Independent check differences
must be reviewed; one point does not resolve an area's spatial emission or propagation effects.

## Evidence — 19 November 2026

Uses backend `ed528ca` / `4152110` and editor `c0e7e47`; shared tests and command outcomes
are recorded in [task 032](032-machine-measurement-calibration.md#evidence--19-november-2026).
Browser checks demonstrate source-free fitting from mixed site observations, area centre
placement, visible radius, preview invalidation, Save/Open/recovery, preserved unlinked
records and a resulting source feeding existing receiver/contour calculations. Application
cannot replace active sources without explicit confirmation. The catalogue retains the
reviewed fitting snapshot, readable after reopening. The area uses a distinct map icon,
dashed footprint and Noise sources heading rather than claiming to be a specific machine.

Captured and inspected [area preview](../images/task-033/fit-area-preview.png),
[applied contours and receiver](../images/task-033/fit-area-applied.png) and
[390 px layout](../images/task-033/fit-narrow.png). No horizontal page overflow or page errors.
The UI is optimized for desktop; narrow forms remain one naturally scrolling column.
Fictional readings and unavailable satellite imagery are explicit test limitations.

The equivalent-point centre is fixed by the user, not fitted. It does not infer a distribution
of sound within the boundary. Separate check readings expose differences without claiming
physical accuracy; no terrain, atmospheric or ground model is added. No real site evidence
or independent reviewer was available. Owner review and merge remain required.


## Workflow review follow-up

[Review findings and verification](../measurement-workflow-review.md) document the
owner-requested usability/bug review above the feature PRs. Commit `ba2890a` corrects mode
cancellation, preview identities, map-numbered selection and activity entry. No physical
model, background policy or stored measurement data changed. All 214 Python tests and 225
browser checks passed; desktop/narrow validation and preview screenshots were inspected.
Author review only; human review/merge remains required.
