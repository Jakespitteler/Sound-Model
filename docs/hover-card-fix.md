# Hover card layout — 17 November 2026

The machine hover card was approximately 55 px wide and 208 px tall. Its wrapping content
shrank inside Leaflet's zero-width positioning pane; the previous browser checks verified
the text but did not assert or inspect the opened card's dimensions.

The card now uses `width: max-content` with a viewport-aware 260 px cap. Ordinary equipment
names and their power appear in an approximately 169 × 54 px card. Long unbroken names wrap
at the cap instead of overflowing. Above/below placement and horizontal adjustment keep
cards inside the map and minimise overlap with visible map controls, with an aligned arrow.
Opening details does not pan the camera or request predictions; panning dismisses them.

## Verification

Existing Chromium tooling checked **open** hover cards for a haul truck, drill and loader,
all four map edges, an 80-character unbroken name, placement beside the expanded guide,
and keyboard focus/Enter selection at a narrow viewport. Assertions checked card width,
height, map containment, text overflow and imagery-warning overlap. No JavaScript errors
or prediction requests occurred during inspection/panning. Screenshots of those open states
were captured and visually inspected. Imagery requests were deliberately blocked, allowing
the warning-overlap case to be checked reproducibly.

The existing suite passed all 73 tests; Ruff lint/format, strict Pyright and `git diff --check`
also passed. The three-machine/seven-receiver browser workflow still passed after the fix.

To review manually, run the app and hover/focus several machine icons. Pan so an icon is
near each map edge, then reopen its card. Check the full name and power remain readable,
including beside the sound guide and, when visible, the imagery warning. Enter/click should
show a single evidence popup; the tooltip should close. Repeat at a narrow viewport and
with an unusually long machine name.
