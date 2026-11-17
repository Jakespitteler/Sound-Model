# 013 — Allow optional receiver names in saved data

Status: Ready to plan implementation.
Task creation approved by the owner on 17 November 2026. Theme/dependencies: 011; prerequisite for 014.

## Problem

Receivers are identified by R1, R2 and so on. Add a backwards-compatible optional label so the next task can name listening locations.

## Scope

Add a bounded optional receiver name, maximum 80 characters, defaulting to an empty string. Reuse Receiver in prediction/save validation; keep version-1 saves readable and stable IDs unchanged. Duplicate display names are allowed because IDs carry identity.

## Exclusions

No receiver categories, assessment criteria, site address search or source naming. The name is metadata and has no acoustic effect.

## Acceptance

- [ ] Existing version-1 records without names still load and can be saved without losing coordinates, notes or IDs.
- [ ] Named receivers round-trip through local saves; overlong labels are rejected while ordinary Unicode labels are retained.
- [ ] Adding or changing a name leaves calculated receiver levels and contour geometry unchanged for identical acoustic inputs.

## Verification

Add focused request/save compatibility cases and an independent name-versus-no-name numeric comparison. Run tests/test_model.py, tests/test_scenarios.py and the documented Python checks.

## Likely implementation files

- `src/types.py`
- `tests/test_model.py`
- `tests/test_scenarios.py`

Use the existing stack. If the slice grows beyond roughly five implementation files, split
it before editing. Record completed checks and the commit here; do not mark it done from
intent alone. New dependencies and external data require separate owner approval.
