# 034 — Field-measurement guide

Status: Implemented; documentation PR ready for review.
Depends on: measurement workflows 031–033 and their interaction review.

## Approved scope

The owner requested the next task after the recommended short field guide was proposed.
Document isolated-machine tests, combined-site readings, representative background and
reserved check points, using the app as it exists. Meter make/model is unknown, isolated
work may or may not be possible, and town-side on/off measurements may be unavailable.
Keep this a small practical guide, not a formal survey protocol or a new app feature.

No runtime/UI changes, instrument integration, prescribed meter class, invented measurement
duration/data, new physics/dependency, reports or printing feature.

## Acceptance

- [x] The guide distinguishes isolated, mixed/unknown, inside-area and moving/event readings, and identifies when they cannot support the current fit.
- [x] It explains the actual LAeq/background/role requirements, preserves unknowns, reserves checks before fitting and treats town predictions as extrapolations without matching evidence.
- [x] App terminology and links match the implementation; users can reach the guide from the README, documentation index and measurement instructions.

## Evidence — 20 November 2026

[Field guide](../field-measurement-guide.md) checked against `Measurement`/`FitRequest`,
background separation/eligibility in `measurement_fitting.py`, and the measurement/fitting
HTML and browser controllers. Covers the existing 2-fit/1-check minimum, 1 m distinct-location
rule, outside-area requirement, single background level, explicit preview/apply and named saves.
These software rules are distinguished from sufficient measurement coverage or a formal method.

Meter-specific instructions remain with the unknown instrument's manual. No external method
was claimed as reviewed, no real dataset was supplied and no field/instrument validation is
implied. Local documentation links/anchors and whitespace checked. Author review only;
no application tests rerun because no runtime code or dependencies changed.
