# 030 — Keep receiver names visible on the map

Status: Ready for implementation when selected.
Requested by the owner on 18 November 2026. Related: 013–014 (receiver names), 027 (sidebar),
029 (map deletion controls).

## Problem and baseline

The sidebar persistently shows names such as Town, Camp and Pool. Map badges show only an
R-number and pressure reading, so matching a location to the sidebar still requires hover
or focus. Show each receiver's identity on the map alongside its current reading at all
times while its marker is visible.

## Scope

Use the existing optional receiver name as a persistent label in or attached to its map
badge, rather than opening a separate floating tooltip for every receiver. Unnamed receivers
use the existing **Receiver N** fallback. Retain a compact R-number reference where useful
for matching repeated names to their sidebar entries; do not introduce another name field.
Keep the coloured pressure reading and units easy to scan. Names remain visible for pending,
no-source, unavailable and outside-scope states too, without requiring selection or hover.

Update labels immediately when names are edited or cleared. Keep them attached to their
own receiver during dragging, panning, zooming, prediction refreshes, undo/redo and Save/Open
or recovery. Renaming must update text without interrupting an active drag or editor.

Keep the layout compact with a readable background over satellite imagery. Wrap ordinary
names; constrain unusually long names without letting them cover a large area. If a long
name is shortened visually, the full name must remain available through keyboard focus and
hover, and in the accessible description. Do not automatically hide ordinary names at
lower zoom levels. Avoid adding multiple label cards to one receiver or widening every badge
to the maximum possible name length.

Test nearby receivers and labels near map edges. Maintain clear attachment to the correct
marker and keep drag, popup and Ctrl-× hit areas usable when task 029 is present. Preserve
the acceptable-level label's established foreground priority and contour readability.
Do not solve overlap by silently hiding names; document any unavoidable overlap for
coincident receivers rather than adding a clustering system.

## Exclusions and dependencies

No new service/library, rename editor, saved schema, calculation change, receiver clustering
or label-settings panel. Reuse the receiver label helper and existing name notifications.
This brief adds a task, not its implementation. Start from then-current main; account for
task 029 if merged. Announce task 030 by number and title before implementing it.

## Acceptance

- [ ] Named receivers visibly show their names and readings without hover/selection; unnamed ones show Receiver N. Names also remain visible with pending, empty, failed and outside-scope readings. Short names such as Town, Camp and Pool are fully readable; long Unicode and duplicate names remain identifiable without horizontal page overflow.
- [ ] Rename/clear, drag, pan/zoom, reading updates, undo/redo, Save/Open and recovery keep each name paired with the correct receiver. Name updates preserve active editor/drag behaviour and cause zero prediction, contour or contour-range requests; camera-only changes remain free of acoustic requests too.
- [ ] Desktop and 390 px screenshots show readable contrast and compact labels, including nearby receivers and map edges. Labels preserve drag/popup/deletion controls and acceptable-contour foreground priority; full names are available to keyboard users and accessible descriptions. No input data or physical/numerical result changes.

## Verification and likely files

Use a fictional Greenbushes-style scene with Town, Camp, Pool, an unnamed receiver, repeated
names and an 80-character Unicode name. Inspect the map with no hover open, then rename,
clear, drag and refresh readings. Count acoustic calls during naming and navigation; verify
stored names and restored identities after Save/Open and recovery. Exercise all reading
statuses, crowded markers, acceptable-line overlap, keyboard focus and task 029's controls
if available. Capture and inspect desktop/narrow screenshots with labels visible and a long
name focused. Run existing checks and add a focused browser regression without installing
a new dependency.

Likely files: `src/static/js/map-manager.js`, receiver-badge styles in
`src/static/css/contours.css`, and a browser regression. Read `receiverLabel` and the existing
`receiver-name` subscription before editing. Avoid marker replacement on a name-only update.
Record the implementation commit, checks, screenshots and remaining limits here when done.
