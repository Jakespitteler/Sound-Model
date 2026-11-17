# 021 — Store an optional user-defined acceptable level

Status: Ready to plan implementation.
Task creation explicitly requested by the owner on 17 November 2026.

## Problem and scope

Add one optional acceptable_level_db value to the saved scenario, within the existing 0–300 dB(A) numeric range, defaulting to unset. Keep old version-1 files readable. This is a user-selected reference, not an approved regulatory or audibility limit.

## Exclusions

No new framework, service, unapproved propagation engine or full assessment platform. These
briefs authorise planning of the requested POC features, not implementation within the
documentation PR. Keep future implementation in separate focused PRs.

## Acceptance

- [ ] Old saves without the field still load; unset remains unset instead of receiving an invented acceptable value.
- [ ] Set/unset values round-trip through Save/Open and recovery while invalid/non-finite values are rejected.
- [ ] The field does not change machine power or propagation physics; it is only a requested contour threshold.

## Verification

Check old-save compatibility, None/zero/300 boundaries, NaN/overflow rejection and valid round trips. Do not assign an acceptable dB value on the owner's behalf.

## Likely files

- `src/scenario_files.py`
- `tests/test_scenarios.py`

Record the chosen scope, commit, actual checks and remaining limits here when work proceeds.
