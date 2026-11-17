# 015 — Fit the local group of machines and receivers

Status: Implemented; ready for review.
Task creation approved by the owner on 17 November 2026. Theme/dependencies: 009 / 011.

## Problem

The Greenbushes button is a fixed site overview. The owner wants a scenario view that does not zoom out to include separate test areas more than 10 km apart.

## Scope

Add a small Fit local area action using existing Leaflet. Fit only the active local group of source/receiver objects, with room for overlays and a sensible maximum zoom for one object. Keep the Greenbushes overview separate. The owner selected a maximum pairwise distance: every pair in the fitted group must be
within 10 km, inclusive. Anchor the group at the selected object, falling back to the last
placed object. Consider candidates in increasing anchor distance with stable ID tie-breaking;
admit each only if it is within 10 km of every admitted object. This deterministic greedy
group need not find a mathematically largest group and must not chain distant groups together.
Grouping must never drop objects from acoustic calculation.

## Exclusions

No site database, cluster library, clustering of sound calculations or change to the 10 km receiver-display policy. Do not auto-fit after every edit or whenever predictions arrive.

## Acceptance

- [x] Every pair in the fitted group is at most 10 km apart; deterministic anchor/tie handling prevents chained neighbours from joining distant areas.
- [x] Selecting or last-placing an object chooses the active group; empty and single-object scenes have predictable behaviour and all objects remain in the scenario.
- [x] Fitting changes only the camera: no prediction requests, moved coordinates, altered results or lost source contributions.

## Verification

Check empty, single-object, two distant groups, an object on the 10 km boundary, and a chain of neighbouring objects that could bridge distant groups. Count requests and compare coordinates. Inspect a fitted desktop screenshot with overlays open.

## Likely implementation files

- `src/static/js/map-manager.js`
- `src/static/js/main.js`
- `src/templates/partials/map-overlays.html`

Use the existing stack. If the slice grows beyond roughly five implementation files, split
it before editing. Record completed checks and the commit here; do not mark it done from
intent alone. New dependencies and external data require separate owner approval.

## Implementation and evidence

Implementation commit: `2d1bc3a` on `agent/fit-local-area`, based on `main` after PR #13.

**Fit local area** is a single lower-right map action. Click/focus/drag a marker or focus its
sidebar details to select an anchor; an amber outline identifies it. Placement selects the
new object. The active identity includes the collection, so a source and receiver may share
an ID. Selected/last-placed state is transient; Open/New/recovery clears it. On a loaded file
without a selection, the last listed receiver (otherwise source) is the deterministic fallback.

The button is disabled when empty, leaves an empty camera unchanged, and caps fit zoom at 16.
The group sorts candidates by anchor distance and stable ID/collection, then checks every
admitted pair. Distances use the model's mean Earth radius with a 1 µm roundoff allowance at
10,000 m. It does not seek a largest clique. Overlay-aware padding reserves space around
visible controls. Fit closes a popup and changes the camera only; ordinary camera Save/recovery
tracking remains intact. No new dependency, acoustic filtering or model/display-scope change.

Verification on 17 November 2026:

- All **90 pytest tests** pass; Ruff lint/format, strict Pyright, pinned-skills integrity,
  offline lockfile and diff checks pass.
- The committed, dependency-free browser regression page
  [`tests/browser/local-area.html`](../../tests/browser/local-area.html) passes **17 checks**:
  empty/single groups, independent equatorial reference distance, inclusive 10 km boundary,
  exclusion 1 mm beyond it, chain prevention, stable ID ties across input order, distant
  anchor, collection-qualified IDs, date-line distance, pairwise bounds, immutable inputs,
  overlay clearance, marker margins and covered-map fallback.
- Chromium exercised the real app: two test areas over 40 km apart, restored-file fallback,
  marker click and keyboard focus, sidebar focus, last placement, empty/single scenes, a
  single-object zoom of 16, and Save after camera navigation. Saved acoustic inputs retained
  every object, ID, position, type, threshold and cloud value; receiver readings stayed equal.
  Request counting found **zero** prediction/contour requests for selection/fitting/navigation.
- Desktop (1440 px) and narrow (390 px) screenshots were captured and inspected. The desktop
  fit keeps both local objects clear of the open guide, coordinate form, imagery warning,
  fit action and Leaflet controls. Selected source highlighting was checked by computed style.
  The narrow view has no horizontal page overflow and the fit action remains visible.
  No JavaScript page errors occurred.

Session artifacts: `/workspace/artifacts/check_local_fit.py`, `local-fit-desktop.png` and
`local-fit-mobile.png`. See the developer guide for running the committed regression page
with Python's loopback HTTP server and an ordinary browser; it is separate from `pytest`.
Imagery was unavailable, so screenshots used the working plain-background map. Native Windows,
Firefox/Edge, screen-reader behaviour and camera fitting across the longitude seam were not
verified. Existing world-edge camera limits are unchanged. No independent review is claimed.

Next task: 017, reuse unchanged contours without sacrificing accuracy. It is not included here.
