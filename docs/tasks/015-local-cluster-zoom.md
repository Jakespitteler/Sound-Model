# 015 — Fit the local group of machines and receivers

Status: Implemented; ready for review.
Task creation approved by the owner on 17 November 2026. Theme/dependencies: 009 / 011.

## Problem

The Greenbushes button is a fixed site overview. The owner wants a scenario view that does not zoom out to include separate test areas more than 10 km apart.

## Scope

Add a small Fit local area action using existing Leaflet. Fit only the active local group of source/receiver objects, with room for overlays and a sensible maximum zoom for one object. Keep the Greenbushes overview separate. The owner selected a maximum pairwise distance: every pair in the fitted group must be
within 10 km, inclusive. Anchor the group at the object nearest the current map centre,
regardless of selection, edits or placement history. This owner correction supersedes the
original selected/last-placed anchor policy. Consider candidates in increasing anchor distance with stable ID tie-breaking;
admit each only if it is within 10 km of every admitted object. This deterministic greedy
group need not find a mathematically largest group and must not chain distant groups together.
Grouping must never drop objects from acoustic calculation.

## Exclusions

No site database, cluster library, clustering of sound calculations or change to the 10 km receiver-display policy. Do not auto-fit after every edit or whenever predictions arrive.

## Acceptance

- [x] Every pair in the fitted group is at most 10 km apart; deterministic anchor/tie handling prevents chained neighbours from joining distant areas.
- [x] The current map centre chooses the local group even after editing or placing an object elsewhere; empty and single-object scenes have predictable behaviour and all objects remain in the scenario.
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

The original implementation was `2d1bc3a`; the owner subsequently requested camera-centred
fitting instead of selection/edit-history fitting. Current evidence is recorded below.

**Fit local area** uses the object nearest the current map centre as its anchor on every
click. Stable ID/collection ties keep results deterministic. Selection state, focus handlers,
last-placement tracking and amber anchor styling have been removed. The button is disabled
when empty, caps fit zoom at 16, and preserves overlay-aware padding. Every pair in the group
remains within 10 km; no object is removed from the acoustic scenario. No new dependency,
schema or model/display-scope change.

Verification on 17 November 2026:

- All **90 pytest tests** pass; Ruff lint/format, strict Pyright, skills integrity,
  offline lockfile and diff checks pass.
- The committed dependency-free browser regression page passes **22 checks**. Five new
  checks cover empty camera anchoring, nearest-object choice independent of list order,
  stable camera-distance ties and collection-qualified identity. The original 17 grouping,
  boundary, chain-prevention, immutable-input and overlay checks still pass.
- Chromium exercised two areas over 40 km apart. Starting near A fits A although B is last
  listed. Moving near B, then editing A through its sidebar, still fits B. Returning near A
  fits A after focusing B's details. Placing a new machine in B, then moving near A, fits A.
  Fitting and navigation generated **zero** prediction/contour requests. Receiver readings,
  contribution text and saved acoustic inputs remained unchanged during camera-only checks.
- Desktop (1440 px) and narrow (390 px) screenshots were captured and inspected with map
  controls visible. The action remains visible, and the narrow page has no horizontal
  overflow. No JavaScript page errors occurred.

Current session artifacts: `/workspace/artifacts/check_camera_fit.py`,
`local-fit-camera-desktop.png` and `local-fit-camera-mobile.png`. See the developer guide
for running `tests/browser/local-area.html` with Python's loopback HTTP server; it runs
separately from `pytest`. The original single-object zoom-16 check remains applicable.
Imagery was unavailable, so screenshots used the working plain-background map. Native Windows,
Firefox/Edge, screen readers and camera fitting across the longitude seam were not verified;
existing world-edge camera limits are unchanged. No independent review is claimed.

Next task: 017, reuse unchanged contours without sacrificing accuracy. It is not included here.
