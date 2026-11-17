# 018 — Undo and redo machine and receiver placement edits

Status: Ready to plan implementation.
Task creation approved by the owner on 17 November 2026. Theme/dependencies: 011; coordinate with 012 recovery.

## Problem

Accidental moves or removals currently require manual reconstruction. Add a small bounded history for source/receiver placement.

## Scope

Support undo/redo of add, move and remove for placed machines and receivers. Commit one history entry per completed drag or coordinate change, not each pointer frame. Clear redo after a new edit; cap history at 50 entries. Reset history on New/Open and clear it on untracked catalogue changes that would invalidate references.

## Exclusions

No persistent history, collaborative editing, undo across opened scenarios or history of camera movements. Do not intercept native Ctrl/Cmd+Z inside form fields or content-editable text.

## Acceptance

- [ ] Undo/redo restores the exact source/receiver IDs and coordinates, preserves valid type references and does not mutate a previously saved file automatically.
- [ ] One drag is one action; a new action clears redo; disabled empty-history controls and the 50-entry cap behave predictably.
- [ ] Undo/redo refreshes the appropriate calculation lane, marks the scene unsaved and is captured by recovery if present; panning and typing in text fields retain their existing behaviour.

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
