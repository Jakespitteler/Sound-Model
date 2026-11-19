# Library and optimisation options — 2026-11-16

> **Historical change record.** For current behaviour, use the [documentation index](README.md)
> and [architecture](../ARCHITECURE.md). The current engine uses the documented 640,000-cell budget and returns per-level outcomes. Earlier scalar limits and timings below are historical measurements.

## Approved performance tools

The owner explicitly approved NumPy and ContourPy on 2026-11-16. NumPy provides compiled
array operations for batched distance/energy calculation; ContourPy provides compiled line
extraction (without needing Matplotlib). Neither adds environmental physics by itself.

Primary references checked:
- https://pypi.org/project/numpy/ and https://numpy.org/doc/
- https://pypi.org/project/contourpy/ and https://contourpy.readthedocs.io/

## Physical-model candidates: evaluation only

- [NoiseModelling](https://github.com/Universite-Gustave-Eiffel/NoiseModelling): free/open-source
  Java environmental noise mapping, including CNOSSOS-EU propagation, absorption, ground,
  diffraction, reflections and meteorological conditions. Integrating it requires reviewing
  industrial-source support, GIS inputs, Windows/Java packaging, GPL obligations and suitability
  for the agreed assessment. It is not a small Python drop-in or automatic WA compliance check.
- [Acoustic Toolbox](https://github.com/Universite-Gustave-Eiffel/acoustic-toolbox): Python
  acoustic utilities, including ISO 9613-1 atmospheric absorption. Potential component/reference,
  not a complete terrain/barrier/site propagation engine. Its source module was inspected:
  `acoustic_toolbox/standards/iso_9613_1_1993.py`.

Neither candidate is approved for installation/integration yet. Selection and validation are
tracked in [task 004](tasks/004-propagation-engine.md). Avoid confusing similarly named random
“noise” generation libraries with sound propagation tools.

## Why the current contour can be too complex

The scalar implementation refines potential threshold crossings to a common depth based
on the smallest relevant source radius. Wide domains and mixed machine powers can force
many tiny cells. Its conservative bounds may also require extra subdivisions to establish
that a cell contains no crossing. The 160,000-cell guard prevents an unbounded local calculation;
exceeding it is not evidence of unusual physical interference or an invalid source configuration.

A separate total-power radius limit is 200 km. Raising the input ceiling to 300 dB does not
remove it or make such powers realistic for machinery. Low thresholds from very high powers
can fail this radius guard before contour extraction starts. Inspect units/data first.

Priorities: compiled batched evaluation and extraction; bounded sparse tiles; shared source
coefficients; per-level cache and partial error results; local accuracy allocation; measured
memory/runtime budgets. Do not simply remove the cap, drop sources, or coarsen lines silently.

## Implemented optimisation

The approved engine now uses batched NumPy field/bounds evaluation and ContourPy on sparse
8×8 tiles, joining exact lattice endpoints and refining vertices together. The cell budget is
now 640,000, with an explicit regression case that fails at 160,000 but completes at the new
budget in approximately 1.1 seconds. It retains the accuracy target and all source contributions.
The 200 km radius guard remains. Future local refinement is still needed for harder cases.

The reproducible benchmark is `uv run python scripts/benchmark_contours.py`. Component and
vertex counts match the pre-optimisation 20-source/four-level case; geometry tests check actual
values and closure, not just counts. Runtime measurements are machine-specific.

Final comparison (five alternating runs on this cloud instance, scalar reference at b4b4c65):

| Implementation | Median runtime | Output |
| --- | --- | --- |
| Previous scalar engine | 2.2698 s | 1 / 1 / 1 / 20 components at 35 / 45 / 55 / 65 dB(A) |
| NumPy + ContourPy | 0.3322 s | Same component and vertex counts; independently tested vertex accuracy |

Median speed-up: **6.83×** for this benchmark, not a promise for every scenario.
`uv run pytest`: **62 passed**; Ruff and strict Pyright checks passed. Browser regression
checks passed for editing/dragging, local styling, camera request counts, error/retry and
stale-response handling. The 300 dB creation/edit/threshold controls were also exercised.
Windows CPython 3.13 x64 wheels were confirmed in PyPI metadata for both approved libraries;
native Windows execution was not available for validation. Run `uv sync --frozen` after updating.

## Documentation review — 17 November 2026

Current-state links and a historical-status banner were added to prevent older controls,
limits, save behaviour or verification counts being mistaken for the current app. The
original change record and its evidence have been retained.


## Feasibility follow-up — 19 November 2026

The [task 026 review](model-feasibility.md) recommends an optional frequency-band evidence
and scalar-baseline foundation before an audibility boundary. It requires no additional
library. The candidates above remain evaluation-only; no engine, service or dataset has
been approved or adopted. Missing bands, atmospheric inputs or detection criteria are not
replaced with guessed values. Background relevance from task 024 is a display rule, not
an environmental propagation or audibility engine.
