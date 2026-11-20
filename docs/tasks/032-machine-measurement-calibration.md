# 032 — Calibrate a machine from measurements

Status: Implemented; fitting API and editor PRs stacked for review.
Depends on: [031 Measurement pins](031-site-measurement-pins.md).

## Approved scope

On 19 November 2026 the owner approved fitting machine emission from measurements,
representative-background energy correction, a preview before applying, and separate
check readings. Tests may contain other machinery: record Isolated/Mixed/Unsure explicitly.
Mixed/unknown tests remain available for the area workflow, never silently attributed to a
single machine. No subtraction of predictions for other machines is approved.

Use known stationary LAeq readings with duration, activity, a matching machine position/setup
and confirmed isolation. Require two distinct fit locations and a separate check location.
Keep original readings, existing catalogue inputs and unrelated instances. Apply a derived
effective sound power only to the chosen instance. Keep the reviewed input/result snapshot.
No instrument integration, spectral fitting, automatic calibration or propagation upgrade.

## Acceptance

- [x] Users can record isolation, select fit/check roles and preview background-corrected results.
- [x] Unknown/mixed/maximum/moving/background-dominated or changed-context readings show explicit reasons and cannot silently influence a machine fit.
- [x] Applying affects one instance; original catalogue and readings persist through Save/Open/recovery. Pending/stale previews cannot apply.
- [x] Independent numeric references, browser interactions and inspected screenshots support the implementation; limits are documented.

See the [shared fitting contract](../measurement-fitting.md). Calibration estimates one
full-space effective emission; it does not establish measured sound power or town audibility.

## Evidence — 19 November 2026

Backend commits `ed528ca` / `4152110` ([PR #58](https://github.com/Jakespitteler/Sound-Model/pull/58));
editor commit `c0e7e47`. The owner approved both isolated and non-isolated test handling.
Unknown isolation defaults to Unsure in legacy/new records. Preview rejects mixed/unknown
machine calibration and suggests the area workflow. Applying clones emission for one instance,
retaining the original shared catalogue entry and full historical observation data.

- `uv run pytest`: **214 passed**. Ruff check/format, Pyright and all 25 pinned skills passed.
- **206 browser checks**: measurement-fitting 17, measurements 18, sidebar-expanded 17,
  frequency-bands 14, equipment-metadata 6, sidebar-entities 15, background-boundary 15,
  receiver-map-names 17, map-deletion 21, repeat-placement 14, placement-history 23,
  acceptable-label-priority 13, contour-cache 16.
- Real-app Chromium: preview does not mutate inputs; deliberate apply preserves the old
  catalogue/powers/readings/receiver/contour/background settings and changes the chosen
  instance only. Mixed readings cannot enable Apply. Input edits and a delayed response
  cannot revive a stale preview. Save/Open, browser recovery and readable saved evidence pass.
  The prior record/compare workflow also passes its full placement/edit/context/draft/save/
  recovery/deletion regression. No page errors; navigation makes no acoustic requests.
- Inspected [fit/check preview](../images/task-032/fit-machine-preview.png) and
  [mixed-machine rejection](../images/task-032/fit-mixed-blocked.png). The preview brings its
  results and Apply action into view; long forms use the sidebar's single scroll area.

All readings are fictional numerical references. Imagery was unavailable, so screenshot
backgrounds use the fallback grid. No real meter, instrument performance, field propagation,
maximum sustained town level, uncertainty interval or audibility outcome was validated.
Author review only; independent owner review and merge remain required.


## Workflow review follow-up

[Review findings and verification](../measurement-workflow-review.md) document the
owner-requested usability/bug review above the feature PRs. Commit `ba2890a` corrects mode
cancellation, preview identities, map-numbered selection and activity entry. No physical
model, background policy or stored measurement data changed. All 214 Python tests and 225
browser checks passed; desktop/narrow validation and preview screenshots were inspected.
Author review only; human review/merge remains required.
