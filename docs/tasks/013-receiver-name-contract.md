# 013 — Allow optional receiver names in saved data

Status: Implemented; ready for review on `agent/receiver-name-contract`.
Task creation approved by the owner on 17 November 2026. Theme/dependencies: 011; prerequisite for 014.

## Problem

Receivers are identified by R1, R2 and so on. Add a backwards-compatible optional label so the next task can name listening locations.

## Scope

Add a bounded optional receiver name, maximum 80 characters, defaulting to an empty string. Reuse Receiver in prediction/save validation; keep version-1 saves readable and stable IDs unchanged. Duplicate display names are allowed because IDs carry identity.

## Exclusions

No receiver categories, assessment criteria, site address search or source naming. The name is metadata and has no acoustic effect.

## Acceptance

- [x] Existing version-1 records without names still load and can be saved without losing coordinates, notes or IDs.
- [x] Named receivers round-trip through local saves; overlong labels are rejected while ordinary Unicode labels are retained.
- [x] Adding or changing a name leaves calculated receiver levels and contour geometry unchanged for identical acoustic inputs.

## Verification

Add focused request/save compatibility cases and an independent name-versus-no-name numeric comparison. Run tests/test_model.py, tests/test_scenarios.py and the documented Python checks.

## Likely implementation files

- `src/types.py`
- `tests/test_model.py`
- `tests/test_scenarios.py`

Use the existing stack. If the slice grows beyond roughly five implementation files, split
it before editing. Record completed checks and the commit here; do not mark it done from
intent alone. New dependencies and external data require separate owner approval.

## Verification — 17 November 2026

Receiver.name is optional metadata with an empty-string default and an 80-character limit.
The existing schema is reused for prediction, version-1 saves and recovery validation.
No acoustic code, frontend editor, dependency or save-version change was needed.

The initial contract tests failed before the field existed. The completed suite has **90
passing tests**, including raw legacy-file reads without disk mutation, explicit resave,
Unicode/duplicate labels, invalid-update preservation and identical named/unnamed geometry.
A receiver prediction was also checked against an independent linear-energy reference.
Removing the length constraint caused the boundary test to fail; the constraint was restored.
Ruff lint/format, strict Pyright, skill integrity and offline lockfile checks passed.

This prepares task 014; names are not yet editable or displayed in the current frontend.
