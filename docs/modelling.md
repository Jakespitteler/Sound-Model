# Acoustic model proposal and limitations

Status: calculation design for review, not an implemented or validated mine model.

## Baseline

Represent each machine as an independent, steady, omnidirectional point source with a
specified A-weighted sound power level LwA (dB re 1 pW). For separation r in metres,
propose full-space geometric spreading:

`LpA = LwA - 20 log10(r) - 10 log10(4 pi)`.

This approximates free-field sound pressure under standard reference conditions. It does
not include reflective ground, source directivity, atmospheric absorption, terrain, barriers,
or refraction. In particular, full-space spreading is not a conservative ground-mounted-source
assessment. Do not call this an ISO 9613-2 implementation or use it to certify inaudibility.
Do not accept an equipment sound pressure reading as LwA without a documented conversion.

Combine independent contributions using `10 log10(sum(10 ** (Li / 10)))`, calculated with
a stable maximum-offset formulation. Silence/no active source is represented separately
from finite levels. Clamp display calculations at a documented minimum distance of 1 metre;
flag closer points as outside the model's valid near-field treatment, not exact predictions.
Geographic separation should use a documented geodesic approximation with metres as output.

## Weather

Cloud cover affects surface heating/cooling and may relate to atmospheric stability; it does
not define the vertical temperature/wind profiles needed for propagation. Do not implement a
fixed cloud-to-decibel multiplier. Initially record coverage (0–100%) and label it as having
no numerical effect. A future method must account for relevant meteorology and be validated.

## Required evidence before audibility conclusions

Obtain equipment sound power data, operating conditions, source and receiver heights,
frequency spectra where relevant, background noise at representative town receptors, and
suitable weather/terrain data. Validate predictions against measurements and an appropriate
acoustic method. Distinguish audibility from compliance with any applicable limit.

## Numerical validation planned

- Doubling distance reduces the baseline by approximately 6.0206 dB.
- Two equal independent contributions add approximately 3.0103 dB.
- At 10 m, LwA 100 dB gives approximately 69.0079 dB in this baseline.
- Zero sources, coincident coordinates, invalid numbers, and very different levels are handled.
- Adding/removing an instance changes the energetic total; map readouts match model results.

These are analytical checks, not measurements validating Greenbushes predictions.
