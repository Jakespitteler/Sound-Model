# 012 — Recover unsaved POC edits

Status: Ready to plan implementation.
Task creation approved by the owner on 17 November 2026. Theme/dependencies: 010.

## Problem

Explicit Save/Open works, but unsaved edits disappear on reload. Recover those edits without turning this POC into a document-management system.

## Scope

Keep one versioned browser recovery draft with its scenario identity and timestamp. Write it after accepted edits with a short debounce, separately from named backend saves. Offer Restore/Discard on reload instead of applying a draft silently. Validate the recovered document with the existing Pydantic scenario schema through a small non-writing API route before applying it.

## Exclusions

No portable import/export, recovery history, cloud sync, new database or automatic overwrite of named saves. Handle a missing saved scenario as recovered unsaved work. Explain that browser storage may be cleared and is not a backup.

## Acceptance

- [ ] Reload restores source/receiver positions, catalogue notes and contour settings only after Restore; Discard removes the draft and leaves the named save unchanged.
- [ ] Unavailable/quota-limited storage and invalid/unsupported drafts produce a clear recoverable message without replacing the current scene or a good save.
- [ ] Named-save identity and dirty state remain correct after recovery, Save, New and Open; drafts from a different scenario are not silently mixed in.

## Verification

Use isolated temporary save storage. Exercise Restore/Discard, quota/write rejection, an invalid reference, deleted backend save and two open tabs. Compare the named JSON file before/after recovery. Capture the restore prompt and failure state. Run the scenario/API tests and the full checks in docs/development.md.

## Likely implementation files

- `src/static/js/draft-recovery.js (new)`
- `src/static/js/main.js`
- `src/templates/index.html`
- `src/scenario_routes.py`
- `tests/test_scenarios.py`

Use the existing stack. If the slice grows beyond roughly five implementation files, split
it before editing. Record completed checks and the commit here; do not mark it done from
intent alone. New dependencies and external data require separate owner approval.
