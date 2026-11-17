# 006 — Make contour calculation faster and more robust

> **Existing theme brief.** See the [backlog](README.md) for current status and approvals.
> Select a small remaining scope with the owner before treating this as an agent task.

Status: in progress (first optimisation implemented). Priority: P1. Owner: unassigned.
Dependencies: current independent-source baseline.

## Work

Profile representative small/large/widely separated/mixed-power scenarios. NumPy and ContourPy are approved by the owner on 2026-11-16; benchmark batched distance/energy evaluation and compiled line extraction against the scalar reference.

Use bounded batches, source-based domains and tiled/adaptive refinement so compact rings are preserved without evaluating a huge dense grid. Retain contributions from all relevant sources, including sources outside a tile. Test seams, closed contours, saddles and vertex errors. Improve local accuracy allocation instead of forcing every distant contour to resolve the smallest source radius.

Follow-ups: cache each level independently; cancellable jobs/backpressure/progress for large workloads. Keep explicit computational bounds and distinguish radius/complexity errors from invalid physical inputs.

## Acceptance evidence

Record repeatable timings, memory limits and numerical/geometry comparisons. No silent source dropping, contour truncation or accuracy reduction. Regression tests cover worst cases; the UI identifies which level failed while independent receiver results remain usable.

## Implemented first stage — 2026-11-16

NumPy batches the field/pruning evaluations; ContourPy extracts sparse 8×8 tiles and lattice
IDs stitch paths. Vertex refinement is vectorised. Batch memory is bounded, and all sources
contribute to every evaluated tile. The cell budget increased from 160,000 to 640,000 only
after a regression case demonstrated completion with unchanged vertex accuracy.

Remaining: local accuracy allocation for extreme mixed-power cases, per-level caching,
workload cancellation/backpressure and broader real-scenario benchmarks.

Per-level success/empty/error responses and visible partial-failure handling are now implemented.
Remaining performance work includes per-level caching, cancellation/backpressure and local accuracy allocation.
