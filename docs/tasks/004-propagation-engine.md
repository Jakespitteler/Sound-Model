# 004 — Select and validate a suitable propagation engine

> **Existing theme brief.** See the [backlog](README.md) for current status and approvals.
> Select a small remaining scope with the owner before treating this as an agent task.

Status: todo. Priority: P0. Owner: unassigned.
Dependencies: 001, 002, 003.

## Work

Evaluate a recognised method appropriate to the assessment, including frequency-dependent absorption, source/receiver heights, directivity, ground impedance, terrain/pit geometry, barriers, reflections/diffraction and meteorological assumptions. Identify which effects dominate this site before prioritising implementation.

Candidates to evaluate, not install: NoiseModelling (Java, GIS integration, CNOSSOS-EU propagation; GPL licensing and suitability for industrial sources/WA assessment need review); Acoustic Toolbox (Python acoustic utilities including ISO 9613-1 atmospheric absorption, not a complete site model). Compare versions, supported methods, benchmarks, Windows setup, licence obligations and maintained interfaces. Any additional technology requires owner approval.

## Acceptance evidence

Publish a comparison and approved method/version with stated domain of validity. Validate analytical cases and documented benchmark cases. Demonstrate treatment of ground/barriers/weather against reference results before calling the output an environmental assessment.
