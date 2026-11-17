# 014 — Show and edit optional receiver names

Status: Implemented; ready for review. Stacked on task 013 / PR #12; merge that dependency first.
Task creation approved by the owner on 17 November 2026. Theme/dependencies: 013.

## Problem

Let the owner identify a listening location as Town boundary or House 1 without crowding the map.

## Scope

Add an optional name field in the existing receiver details. Use the name in the sidebar and accessible/hover details, preserving the compact R-number and numeric map badge. Clearing the name restores the existing Receiver N wording. Preserve names through Save/Open and recovery.

## Exclusions

No permanent large map labels, renamed machine types or new naming dialog. Avoid introducing a new input framework. Keyboard text editing must remain natural.

## Acceptance

- [x] A named and an unnamed receiver can coexist, and clearing a name restores the fallback without changing IDs or positions.
- [x] A name survives Save/Open and, if recovery is present, recovery; long names wrap without obscuring the numeric badge or controls.
- [x] Name-only edits do not send contour requests or alter predicted sound; focus/hover and narrow-screen layouts remain readable.

## Verification

Exercise add/edit/clear, duplicate labels, long Unicode text, Save/Open and keyboard operation. Count acoustic requests on a label-only edit. Inspect screenshots with the details editor and tooltip open at desktop and narrow widths.

## Likely implementation files

- `src/static/js/state.js`
- `src/static/js/ui-entities.js`
- `src/static/js/map-manager.js`
- `src/static/js/types.js`
- `src/static/js/main.js`

Use the existing stack. If the slice grows beyond roughly five implementation files, split
it before editing. Record completed checks and the commit here; do not mark it done from
intent alone. New dependencies and external data require separate owner approval.

## Implementation and evidence

Implementation commit: `a286b68` on `agent/receiver-name-editor`.

The existing receiver details contain a single optional name input. Accepted labels update
headings, hover text and accessible descriptions locally; R-number badges and pressure values
stay compact. Empty/whitespace-only input restores the fallback. Duplicate names are allowed.
The 80-character limit counts Unicode codepoints; an oversized paste is explicitly rejected
and the previous accepted label is retained. No schema, dependency or acoustic change.

Verification on 17 November 2026:

- All 90 pytest tests pass. Ruff lint/format, strict Pyright, pinned-skills integrity,
  offline lockfile validation and `git diff --check` pass.
- Chromium with the environment's existing Playwright runner exercised named/unnamed
  coexistence, clearing, duplicate labels, literal HTML, 80 Unicode characters and invalid
  oversized paste. IDs, coordinates and readings remained unchanged. Request counting found
  **zero** `/api/predict` or `/api/contours` calls for label-only edits.
- Real UI Save/Open and browser-draft Restore preserved names; backend files were isolated
  under `/tmp/sound-model-name-editor`. A delayed prediction response during typing preserved
  focus, caret position and the open editor. No JavaScript page errors occurred.
- Inspected screenshots with the name editor and hover/focus card open at 1440 and 320 px;
  also checked the 768 px layout. Long text wraps without horizontal page overflow or hiding
  controls/readings. A resize regression was fixed by refitting already-open tooltips;
  bounding-box assertions confirm the card stays inside the map and clear of the tile warning.

Session evidence: `/workspace/artifacts/check_receiver_names.py`,
`receiver-names-desktop.png`, and `receiver-names-long-{1440,768,320}.png` in that directory.
These are environment artifacts, not required application dependencies. Satellite imagery
was unavailable, so visual checks used the app's working plain-background state. No claim
of screen-reader, Firefox/Edge or independent review coverage is made.

Next task: 015, local cluster fit. It is a larger navigation feature and is not included here.
