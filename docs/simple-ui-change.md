# Simpler scenario editor — 17 November 2026

The owner authorised guessed starter levels when public research was unavailable. Requests
to Charles Hull, Talison and FHWA still returned proxy HTTP 403 on this date. Accordingly all
eight presets are project-authored guesses, dated and labelled; no number is attributed to an
unread public document or presented as a confirmed company fleet/specification.

The catalogue contains representative haul truck, excavator, loader, dozer, grader, water
cart, blast-hole drill and crusher/screening categories (112–120 dB(A) LwA). Per-type notes
and the in-app /machine-estimates page explain origin and limitations. Notes remain editable
and are excluded from the numeric API payload without being lost from browser state.

Simplicity decisions:

- Remove contour dragging, handles and all manual colour/weight/style controls.
- Pair one slider and numeric input per threshold; preview locally, commit on release/change.
- Sort descending by dB and derive a stable colour from absolute pressure level. Use a single
  solid 2.5 px line weight. Colours are not approved noise limits or compliance verdicts.
- Show each receiver's dB(A) on its draggable badge and match the sidebar number colour.
  Never keep stale numeric readings through pending/failure states; empty scenes show No sources.
- Fit a broad Greenbushes overview (approximate -33.94/116.015 to -33.825/116.14), not a surveyed
  mine boundary. Keep camera changes independent from acoustic requests.
- Collapse the equipment editor and coordinate form by default, making placement prominent.
- Add a collapsible top-right approximate sound-pressure guide with Australian/mining humour.
  It is not evidence, a machine sound-power dataset or an exposure/compliance table.

Task 010 defines autosave/recovery as the next focused persistence increment. Task 011 records
further workflow research and small improvements. Saving is deliberately still planned, not
claimed implemented; the visible reload-loss notice remains.

## Desktop-focused refinement

After reviewing the first layout, the owner requested a simpler left sidebar with fewer
things visible at once. The default Scenario tab now contains only machine placement,
compact placed-machine cards and receiver readings. Contour editing has a separate tab.
The equipment library, coordinate editing, contribution breakdown and model/cloud settings
are disclosed only when opened. The large introduction was replaced with a compact title
and a brief screening/reload-loss notice. The sidebar is 340 px at normal desktop widths
(350 px on large screens), leaving more space for the map.

Tabs preserve mounted form values, support arrow/Home/End keys, and do not trigger acoustic
requests. The map and receiver badges remain visible while switching workspaces.

## Verification

- `uv run pytest`: 63 passed. Ruff lint/format and strict Pyright passed; no dependencies changed.
- Existing Chromium browser tooling exercised eight preset types, per-type notes/editing,
  metadata exclusion from acoustic requests, paired slider/number input, sorting, duplicate
  rejection, add/remove levels, source dragging and receiver numeric/colour updates.
- Contour paths are noninteractive and have no drag handles. Panning, zooming, fitting the
  overview and tab changes made no acoustic requests. The configured overview bounds fit
  after interrupting navigation, with zoom animation disabled for deterministic controls.
- Receiver pending/failure/empty states, retry and source deletion were exercised. Source and
  sidebar numbers match in colour/value; there are no JavaScript exceptions.
- Scenario/Contours tabs preserve controls, support keyboard navigation and keep advanced
  settings collapsed. Desktop and narrow-layout screenshots were captured and inspected.
- Imagery requests were blocked during browser automation. Live satellite access and actual
  site-boundary coverage were not validated; the bounds are intentionally an approximate view.
- Autosave remains a task. No claim is made that reloading preserves data.
