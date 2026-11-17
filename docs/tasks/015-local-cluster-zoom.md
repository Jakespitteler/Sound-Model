# 015 — Fit the local group of machines and receivers

Status: Ready to plan implementation.
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

- [ ] Every pair in the fitted group is at most 10 km apart; deterministic anchor/tie handling prevents chained neighbours from joining distant areas.
- [ ] Selecting or last-placing an object chooses the active group; empty and single-object scenes have predictable behaviour and all objects remain in the scenario.
- [ ] Fitting changes only the camera: no prediction requests, moved coordinates, altered results or lost source contributions.

## Verification

Check empty, single-object, two distant groups, an object on the 10 km boundary, and a chain of neighbouring objects that could bridge distant groups. Count requests and compare coordinates. Inspect a fitted desktop screenshot with overlays open.

## Likely implementation files

- `src/static/js/map-manager.js`
- `src/static/js/main.js`
- `src/templates/partials/map-overlays.html`

Use the existing stack. If the slice grows beyond roughly five implementation files, split
it before editing. Record completed checks and the commit here; do not mark it done from
intent alone. New dependencies and external data require separate owner approval.
