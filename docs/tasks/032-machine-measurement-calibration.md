# 032 — Calibrate a machine from measurements

Status: Backend implemented; explicit preview/apply editor follows in the stacked UI slice.
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

- [ ] Users can record isolation, select fit/check roles and preview background-corrected results.
- [ ] Unknown/mixed/maximum/moving/background-dominated or changed-context readings show explicit reasons and cannot silently influence a machine fit.
- [ ] Applying affects one instance; original catalogue and readings persist through Save/Open/recovery. Pending/stale previews cannot apply.
- [ ] Independent numeric references, browser interactions and inspected screenshots support the implementation; limits are documented.

See the [shared fitting contract](../measurement-fitting.md). Calibration estimates one
full-space effective emission; it does not establish measured sound power or town audibility.
