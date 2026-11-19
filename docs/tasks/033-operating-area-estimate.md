# 033 — Estimate an operating area from measurements

Status: Backend implemented; explicit area selection/preview editor follows in the stacked UI slice.
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

- [ ] An area centre and radius can be marked without placing any machines; suitable outside readings yield a preview with held-back checks.
- [ ] Interior/incompatible/background-dominated readings retain explicit reasons. Mixed site readings do not become individual-machine evidence.
- [ ] Applying creates one labeled area source feeding existing receiver and contour calculations; replacement is deliberate and original records/evidence persist.
- [ ] Browser checks, numeric tests and inspected screenshots cover source-free operation, invalidation and saving; the equivalent-point limitation is clear.

See the [shared fitting contract](../measurement-fitting.md). Independent check differences
must be reviewed; one point does not resolve an area's spatial emission or propagation effects.
