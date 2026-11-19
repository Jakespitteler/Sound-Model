# 026 — Select feasible improvements to the POC sound model

Status: Feasibility review complete; proposed first increment awaits owner selection and data.
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

- [x] A short option matrix states required data, method, limits, reference evidence and effort for each effect, distinguishing feasible POC slices from parked work.
- [x] One recommended increment has a clear input/output contract and independent analytical/reference validation cases, including an omitted-effect baseline and representative failure/boundary cases.
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


## Review — 19 November 2026

See [model feasibility](../model-feasibility.md) for the option matrix, data/method/dependency
requirements, references actually read, a small numerical example, the proposed input/output
contract, independent validation cases and a path-to-audibility diagram.

The owner asked to follow the recommendation and then work on this task. The immediate
recommendation is implemented separately: the existing 0.1 dB boundary now says **Negligible
overall increase**, without changing its calculation or inventing a maximum hearing distance.
This review is the subsequent task, not an implementation of an environmental engine.

Recommended next increment: optional measured/assumed octave-band equipment power and
background pressure evidence, plus receiver-only geometry band calculations. Keep existing
LwA results/contours untouched; do not fabricate spectra, apply unverified A-weighting
coefficients, or claim the band comparison establishes audibility. No measured spectral data
were found in the repository. The owner has not yet selected this concrete slice; acceptance
item 3 remains open. No new implementation brief, dependency, GIS/weather service or detection
method has been added.

Evidence read: OSHA frequency/weighting, sound-power/pressure and free-field guidance, plus
FHWA measurement/meteorology/absorption and ground/barrier context. ISO/NPL requests were
unavailable and are explicitly excluded as read evidence. These are not WA assessment or
mine-audibility validation claims.

A fictional two-bin calculation reproduced identical overall backgrounds (45.000434 dB(A))
and increases (0.107732 dB), despite active-bin margins of +24 versus −16 dB. Independent
intensity arithmetic reproduced 49.007901 dB at 100 m for 100 dB sound power, −6.020600 dB
on doubling distance and +3.010300 dB for equal-source energy addition. These are foundation
checks, not a validated masking model. Existing prediction code was unchanged by the review.
86 local documentation links resolve; `git diff --check` passed. Author review only;
implementation selection and any method/technology approval remain with the owner.
