# 011 — A simple, confident scenario workflow

Status: todo. Priority: P2. Owner: unassigned.
Depends on: feedback on the simplified editor; coordinate task 010 for persistence.

## Principles

Optimise the common path: choose a machine → place it → place a receiver → read its level.
Use progressive disclosure for evidence and advanced controls. Avoid adding settings just
because they can be added. Keep numerical output and provenance readable alongside colour.

## Follow-up ideas to evaluate

- Observe a new user setting up a scenario without instructions. Note wrong clicks, unclear
  terms and time to the first receiver reading; prioritise three concrete improvements.
- Let users name receivers (e.g. a house or road) and instances without renaming the shared
  machine type. Add a compact source contribution breakdown on receiver selection.
- Add undo/redo and duplicate machine; make cancellation and accidental deletion recoverable.
- Consider one selected-machine editor rather than many expanded forms. Show the selected
  marker and its sidebar entry together. Keep input focus when results update.
- Offer an explicit Fit scenario action separately from the Greenbushes overview. Validate
  the overview against a surveyed/approved site extent before treating it as a mine boundary.
- Test colour distinction/contrast, keyboard-only operation, touch targets, screen-reader
  receiver announcements, and the compact sound guide on phones. Colours never mean
  compliance unless actual reviewed criteria have been supplied.
- Keep the humorous guide secondary. Its approximate pressure levels must not be mistaken
  for equipment sound power or measurement evidence.

## Acceptance

Agree the smallest improvement set with the owner, then demonstrate the common workflow at
phone and desktop widths. No added control without a clear user need. Capture screenshots,
record accessibility and user-feedback findings, and preserve source notes and physics limits.

## Implemented baseline in this change

Automatic level colours/fixed line weight, descending slider/number contour rows, no contour
dragging, receiver-level badges, a broader Greenbushes overview, a collapsed equipment editor
with explicit guess notes, and a collapsible South West/mining sound guide.

The owner then prioritised desktop use and fewer sidebar items. Implemented two focused
Scenario/Contours tabs, compact entity cards and progressively disclosed equipment/model
settings. Follow-up usability testing should assess tab discoverability and how well users
find the equipment evidence notes without reintroducing a crowded sidebar.
