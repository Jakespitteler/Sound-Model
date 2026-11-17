# 018 — Undo and redo machine and receiver placement edits

Status: Implemented; ready for review.
Task creation approved by the owner on 17 November 2026. Theme/dependencies: 011; coordinate with 012 recovery.

## Problem

Accidental moves or removals currently require manual reconstruction. Add a small bounded history for source/receiver placement.

## Scope

Support undo/redo of add, move and remove for placed machines and receivers. Commit one history entry per completed drag or coordinate change, not each pointer frame. Clear redo after a new edit; cap history at 50 entries. Reset history on New/Open and clear it on untracked catalogue changes that would invalidate references.

## Exclusions

No persistent history, collaborative editing, undo across opened scenarios or history of camera movements. Do not intercept native Ctrl/Cmd+Z inside form fields or content-editable text.

## Acceptance

- [x] Undo/redo restores the exact source/receiver IDs and coordinates, preserves valid type references and does not mutate a previously saved file automatically.
- [x] One drag is one action; a new action clears redo; disabled empty-history controls and the 50-entry cap behave predictably.
- [x] Undo/redo refreshes the appropriate calculation lane, marks the scene unsaved and is captured by recovery if present; panning and typing in text fields retain their existing behaviour.

## Verification

Exercise add/move/delete sequences, drag versus typed coordinates, type deletion, New/Open boundaries and pending requests. Save, undo, reload and confirm that explicit Save semantics remain intact. Inspect toolbar/focus states at desktop width.

## Likely implementation files

- `src/static/js/state.js`
- `src/static/js/main.js`
- `src/templates/index.html`
- `src/static/css/sidebar-simple.css`
- `src/static/js/scenario-files.js`

Use the existing stack. If the slice grows beyond roughly five implementation files, split
it before editing. Record completed checks and the commit here; do not mark it done from
intent alone. New dependencies and external data require separate owner approval.

## Implementation and evidence

Implementation commit: `ed90164` on `agent/placement-undo-redo`, based on `main` after task 017.
Four runtime files changed; no new dependency, backend, model or saved-schema change.

Undo/Redo below Save/Open supports source/receiver add, move and remove. Commands retain
IDs and list positions; moves replay only coordinates so later receiver names and current
catalogue powers survive. Removing an entity captures its current metadata for later replay.
One drag-end or coordinate submission creates one action; no-op moves create none. There
are at most 50 commands, and a new placement edit clears redo. Open/New/recovery and demo
replacement reset history. Deleting an unused type clears both stacks; in-use type deletion
is guarded in the store. Other catalogue edits retain valid placement history.

Source actions notify the existing geometry lane; receiver actions notify only receivers.
Undo/redo therefore updates working-scene revision/recovery normally, without writing a
named save. History itself is excluded from saved documents, request payloads and recovery.
Buttons disable on empty stacks. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y work outside inputs,
editable content and dialogs; native field editing keeps its normal undo behaviour.

Verification on 17 November 2026:

- **90 pytest tests** pass; Ruff lint/format, strict Pyright, pinned-skills integrity,
  offline lockfile validation and diff checks pass.
- The committed plain-browser page `tests/browser/placement-history.html` passes **23 checks**
  covering exact records, moves/removals, branching redo, name retention, list order, current
  catalogue power, receiver-only notifications, no-ops, deleted/used type safety, the 50-action
  cap and restore/demo boundaries. Before implementation it failed because `undo` did not exist.
- Actual Chromium interactions exercised placement, a 12-frame pointer drag producing exactly
  one action, typed receiver coordinates, buttons and Ctrl+Z/Shift+Z/Y, native text undo,
  reversible receiver removal, Save then undo, reload/recovery, Open and New. Backend records
  remained exactly unchanged until explicit Save. Recovery restored IDs/positions with empty
  history. Receiver moves/undo sent only receiver requests; panning sent no acoustic requests.
- Undo during a deliberately delayed contour response left the source and its lines removed
  after the late response. No JavaScript page errors occurred. Desktop (1440 px) keyboard-focus
  and narrow (390 px) disabled-control screenshots were captured and inspected, with no
  horizontal page overflow.

Session artifacts: `/workspace/artifacts/check_history.py`, `history-desktop.png` and
`history-mobile.png`. The developer guide explains the dependency-free regression page;
it runs separately from `pytest`. Satellite imagery was unavailable, so visual checks used
the working plain-background map. Native Windows, macOS shortcuts, Firefox/Edge and screen
readers were not tested. No independent review is claimed.

Next queued task: 019, optional equipment metadata contract. Sidebar rework remains task 027;
neither is implemented here.
