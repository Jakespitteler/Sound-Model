# 010 — Keep scenarios when the page reloads

Status: in progress — explicit Save/Open implemented; autosave and portable recovery remain. Priority: P1 (next usability priority). Owner: unassigned.
Related: 007, reproducible assessment reports.

## Problem

Reloading currently loses the user's work. A report/export project is too broad to solve
this immediate usability problem quickly. Ship a focused persistence increment first.

## Proposed work

- Autosave machine types **including estimate/source notes**, source/receiver coordinates,
  contour thresholds and cloud metadata after accepted edits.
- Offer a clear saved/unsaved/error indicator, restore the last scenario on reopening, and
  provide a deliberate New scenario action with confirmation before discarding work.
- Decide with the owner between per-browser local storage and named backend scenario files;
  explain local-only/browser-reset behaviour, site confidentiality and backup requirements.
- Add a versioned JSON export/import as a portable backup. Validate all imports and support
  format migrations; never silently replace invalid data with a blank scenario.
- Test quota/write errors, corrupted data, browser refresh, app restart, multiple tabs,
  updates between schema versions, deletion and recovery. Preserve the previous good save.

## Acceptance

Create equipment, place machines/receivers, edit levels and notes, then reload and restart.
Every accepted value returns with stable IDs and provenance. Failed saves are visible and
recoverable. Export/import round-trips without losing notes. No new library is required by
this proposal; discuss a new storage technology before selecting one.

Implemented increment: named local JSON documents with source notes/kinds, view and contour
settings; Save/Open/new/copy actions, saved-URL reload restoration, dirty indicators, schema
validation and atomic replacement. Backend tests cover failed writes and corrupt files.
Remaining: autosave, export/import, migrations beyond version 1 and broader recovery workflows.
The UI explicitly distinguishes last-saved state from unsaved edits.
