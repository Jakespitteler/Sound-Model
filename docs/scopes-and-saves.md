# Partial contours, model scope and saved scenarios — 17 November 2026

The owner requested independent contour errors, defaults matching the guide, removal of the
lower key, a physics explanation and an About page. They explicitly chose hiding receiver
numbers beyond 10 km from all sources after being told that this is a screening policy,
not a physical cutoff. No atmospheric absorption or other new physics was fabricated.

- Default levels and the illustrated guide share one definition: 30/40/60/80/100 dB(A).
- Each contour has a calculated, empty or failed outcome. Other levels survive any individual
  budget/domain/scope failure. Row status and a map alert identify the affected dB levels.
- Entire lines outside the 10 km nearest-source scope are not displayed. No silent clipping.
- Receiver extrapolations beyond scope contain no pressure number, including in the detailed
  breakdown. Local negative levels remain mathematically valid and are not clamped to zero.
- The repeated inverse-square calculation was checked in metres against a linear-energy
  reference. At approximately 213.57 km, one 120 dB(A) LwA source gives 2.42 dB(A) in the
  simplified equation; it is not evidence of hearing mining machinery in Perth.
- A high-contrast white-halo toggle affects rendering only. Automatic level colours remain.
- Objects have original illustrative SVG categories, names and LwA power labels. Receiver
  pressure badges are distinct. Clicking a source explains its power and evidence note.
- The sound guide uses illustrated cards, not measured equipment data. The lower legend and
  status boxes were removed; status is in the toolbar. `/about` explains the model and limits.

The owner subsequently requested explicit saves. Save/Open preserve named version-1 records
in local backend files, including notes, type kinds and view settings. Reloading a saved URL
restores its last saved version. A dirty indicator does not claim autosave; failed writes do
not mark edits as saved. Copy/new operations retain existing saved files. Data is ignored by
Git and is not published with application source. No new third-party technology was added.

Validation: numerical and HTTP tests cover Perth/scope, negative values, partial levels,
reference formulas, saved round trips, invalid schema/reference rejection, atomic-write
failure, damaged-file listing, safe identifiers and About content. Existing Chromium tooling
checks the combined user flow, source badge labels/icons, guide/default agreement, contrast
without requests, independent error rendering, save/reload/open/update and dirty/error states.

Verified: **73 pytest tests passed**, Ruff lint/format checks passed and strict Pyright returned
zero errors. Desktop and narrow-screen Chromium flows completed without JavaScript exceptions.
Save-error simulation retained dirty edits and retry succeeded; replacing a save kept one ID.
Satellite tile requests were deliberately blocked in browser tests to exercise the offline
message; live imagery availability was not verified by those checks. Screenshots were inspected.
