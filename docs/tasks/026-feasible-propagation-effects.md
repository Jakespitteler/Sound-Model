# 026 — Select feasible improvements to the POC sound model

Status: Ready for a focused feasibility review; implementation follows an agreed small slice.
Requested by the owner on 17 November 2026, alongside reducing developer-facing UI copy.
Related: 024 (credible display scope), parked themes 002–005 (evidence and validation).

## Scope

Identify which missing effects can be added credibly with the data and existing Python stack.
Compare required inputs, physical method, validation reference, effort, licensing/dependencies
and expected benefit. Recommend one small first increment, not a full environmental engine.

Consider source/receiver heights and 3D paths; measured source powers and frequency spectra;
frequency-dependent atmospheric absorption; directivity and reflective ground; pits/terrain,
buildings, barriers and diffraction; weather refraction; operating cycles; background noise
comparison; and uncertainty. Mark options blocked by absent evidence or an unsuitable model.

A-weighted broadband inputs alone do not justify choosing a representative frequency or
inventing a universal absorption coefficient. Cloud cover is not a substitute for wind,
temperature or humidity data. Background noise must be a separate measured/assumed input,
not a number inferred from the humorous guide. Do not silently convert averages into maxima.

## Exclusions

No automatic installation of an engine or GIS/weather service, invented site data, arbitrary
attenuation credits, legal pass/fail criteria, or claim of environmental validation. Keep
projected implementation small and preserve the current model as an explicit baseline.

## Acceptance

- [ ] A short option matrix states required data, method, limits, reference evidence and effort for each effect, distinguishing feasible POC slices from parked work.
- [ ] One recommended increment has a clear input/output contract and independent analytical/reference validation cases, including an omitted-effect baseline and representative failure/boundary cases.
- [ ] The owner agrees which slice proceeds before it is implemented; any new library, dataset or service receives separate approval. Scope 024 remains a display-confidence decision, not a replacement for missing physics.

## Verification

Check authoritative method documentation against the proposed input quantities and units.
Cite sources actually read and flag unavailable references. If a tiny experiment is needed,
use fictional inputs and existing dependencies, report its limitations and do not integrate it
into app predictions as a side effect. Propose the smallest implementation task(s) only after
the selected approach and validation basis are clear.

## Likely files

- `docs/model.md`
- `docs/library-options.md`
- `docs/tasks/026-feasible-propagation-effects.md`
- The selected calculation modules/tests for read-only investigation
