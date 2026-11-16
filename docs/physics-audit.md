# Physics and startup audit — 2026-11-16

## Conclusion and scope

Reviewed `src/acoustics.py`, `src/contours.py`, request/response schemas, HTTP routes, frontend
state/cache invalidation, source and receiver controls, contour dragging and result labels.
The baseline arithmetic is consistent with the stated independent, omnidirectional,
full-space point-source model. This is **not** a validation of actual mine-to-town noise,
regulatory compliance or inaudibility. No unapproved environmental correction was introduced.

## Physical equations and units

For an isotropic point source, intensity is `I = W / (4 pi r²)`. Under the usual free-field
reference-impedance approximation, sound pressure level follows:

```text
LpA = LwA − 20 log10(r / 1 m) − 10 log10(4 pi)
```

`LwA` is A-weighted sound power referenced to 1 pW. `LpA` is A-weighted sound pressure
referenced to 20 micropascals. The two are different quantities: an equipment pressure reading
cannot be entered as sound power without an appropriate measurement geometry/conversion.
The constant assumes conventional reference conditions, not a calculation of air density
and sound speed for actual site weather.

For mutually incoherent machines, time-averaged squared pressures add:

```text
LpA_total = 10 log10(sum(10 ** (LpA_i / 10)))
```

This correctly gives +3.0103 dB for two equal independent sources, and -6.0206 dB when
distance doubles for one source. A-weighted levels can be added this way when their metric,
operating/time basis and receiver location are consistent. With frequency-independent
geometric spreading, the same attenuation can apply to each band before A-weighted addition.
No phase cancellation or wind-shaped lobes can be inferred from these broadband inputs.

Both direct receiver evaluation and contour sampling now call the same `source_level` and
`combine` helpers. Tests independently derive expected intensity from linear power / distance²,
instead of only comparing the two implementations. Stable logarithmic normalisation handles
very different source levels without overflow. Empty scenes return None, not 0 dB ambient noise.

## Spatial and numerical treatment

- Distance is spherical great-circle horizontal separation using the IUGG mean Earth radius.
  It handles nearby sources across the date line. It does **not** represent a measured 3D
  propagation path or source/receiver heights. At a local site this is a horizontal-distance
  approximation; its use at great range is not a physical atmospheric propagation model.
- Source distances below 1 m are clamped for numerical display and explicitly flagged at
  receivers. This is not valid near-field acoustics. Do not interpret clamped values as
  measurements or resolved near-field contours. Exactly attainable maximum levels now retain
  their boundary rather than being incorrectly discarded by the contour upper-bound test.
- Contours use the combined field, not superimposed single-machine circles. Tests verify
  joined outer contours, separate inner lobes, increased colocated-source radius, compact
  rings in wide domains, closure and individual vertex levels.
- Conservative cell bounds follow the spherical triangle inequality. Mercator distances
  overestimate surface distance, allowing safe pruning. Tests sample cell bounds at the
  equator, Greenbushes latitude and 70° latitude with mixed source powers.
- The 0.02 dB tolerance concerns sampled line vertices only. Straight segments approximate
  the continuous field; this tolerance is **not** prediction uncertainty for actual noise.
- The 200 km radius and cell budget are computational guardrails, not a range over which
  this simplified model is physically validated. Oversized/polar/complex domains return
  an error rather than silently clipping. Styling, receivers and camera movement do not
  change the computed source domain.
- Dropping a contour samples the current combined field at that point and rounds its
  threshold to 0.1 dB. Source edits invalidate pending drops. Near-field, duplicate and
  out-of-range drops are rejected. This changes a level, not the physical shape by hand.

## Missing site physics and data

The model currently assumes directivity factor Q=1 into full space. Reflective ground,
hemispherical radiation, equipment directionality and installation effects can change levels;
for example, ideal hemispherical radiation of the same total power gives +3.01 dB relative
to full-space spreading. That must not be inserted as a universal mine-site correction.

Also absent: source/receiver heights, frequency spectra, atmospheric absorption, temperature
and wind profiles/refraction, terrain, pit shielding, buildings/barriers, ground impedance,
operating duty cycles, background noise, tonal/impulsive character and uncertainty estimates.
Cloud cover is recorded but does not determine these parameters. Arbitrary cloud-to-dB
multipliers would not repair those omissions.

A defensible site assessment needs validated sound-power data and operating conditions,
appropriate geometry and propagation methodology, background measurements, meteorological
conditions and measurement comparison. None of the arithmetic checks establishes that a
machine will be inaudible or that a regulatory limit is met.

## Blank map investigation and fixes

The reported VS Code view at `http://127.0.0.1:8767/` lacked both Leaflet controls and the
initial contour legend. Those are created before remote imagery succeeds, so that screenshot
is consistent with JavaScript not completing startup; it does not alone identify the cause.

Two matching failures were reproduced in Chromium:

1. Disabling `crypto.randomUUID` threw before map construction, leaving the screenshot's
   blank grid and loading message. Session IDs now use a simple unique counter/time prefix;
   these IDs are bookkeeping, not credentials, and require no secure-context API.
2. Serving JavaScript modules as `text/plain` stopped the browser executing the application.
   Windows MIME registry settings can produce this. `assets.py` now serves deterministic JS
   and CSS content types. An HTTP regression test deliberately corrupts host MIME settings.

A classic bootstrap script now loads bundled Leaflet before importing the application and
reports failed imports/startup visibly. Slow imagery also gets a bounded timeout message.
The existing Esri imagery provider is preserved; no substitute provider/library was selected.

Browser tests confirm working map controls, example contours and legend with randomUUID
absent and Leaflet deliberately delayed, and an actionable message for a blocked module.
Automated imagery requests are blocked intentionally. A separate live request to the existing
imagery service returned a cloud-proxy HTTP 403; actual imagery access from the user's Windows
network/VS Code remains unverified. If scripts work but tiles fail, network/service access
is a separate problem. Try the same local address in an external Edge/Chrome/Firefox browser
and read the visible error rather than relying on an indefinite loading indicator.

## Verification

`uv run pytest`: **56 passed**. Ruff lint/format and strict Pyright checks passed.
The browser regression flows cover normal scenario editing/dragging, camera request counts,
error/retry handling, no-randomUUID startup, delayed Leaflet, failed module imports, and stale
response rejection. Native Windows and the user's particular VS Code webview are unavailable
here, so their execution is not claimed as verified.
