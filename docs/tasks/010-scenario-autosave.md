# 010 — Keep scenarios when the page reloads

> **Existing theme brief.** See the [backlog](README.md) for current status and approvals.
> Select a small remaining scope with the owner before treating this as an agent task.

Status: in progress — explicit Save/Open implemented; autosave and portable recovery remain. Priority: P1. Owner: unassigned.
Related: 007, reproducible assessment reports.

## Problem

Explicit Save/Open already preserves named scenarios, and saved URLs restore the last saved
version. Unsaved edits are still lost on reload. This theme covers possible further recovery
work; it is not approval to implement autosave or portable backups.

## Proposed work

- Autosave machine types **including estimate/source notes**, source/receiver coordinates,
  contour thresholds and cloud metadata after accepted edits.
- Offer a clear saved/unsaved/error indicator, restore the last scenario on reopening, and
  provide a deliberate New scenario action with confirmation before discarding work.
- Keep the implemented named backend scenario files. Any additional recovery storage needs
  an explicit design decision covering confidentiality, stale drafts and backup requirements.
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
