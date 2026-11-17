# 021 — Store an optional user-defined acceptable level

Status: Implemented; ready for review.
Task creation explicitly requested by the owner on 17 November 2026.

## Problem and scope

Add one optional acceptable_level_db value to the saved scenario, within the existing 0–300 dB(A) numeric range, defaulting to unset. Keep old version-1 files readable. This is a user-selected reference, not an approved regulatory or audibility limit.

## Exclusions

No new framework, service, unapproved propagation engine or full assessment platform. These
briefs authorise planning of the requested POC features, not implementation within the
documentation PR. Keep future implementation in separate focused PRs.

## Acceptance

- [x] Old saves without the field still load; unset remains unset instead of receiving an invented acceptable value.
- [x] Set/unset values round-trip through Save/Open and recovery while invalid/non-finite values are rejected.
- [x] The field does not change machine power or propagation physics; it is only a requested contour threshold.

## Verification

Check old-save compatibility, None/zero/300 boundaries, NaN/overflow rejection and valid round trips. Do not assign an acceptable dB value on the owner's behalf.

## Likely files

- `src/scenario_files.py`
- `tests/test_scenarios.py`

Record the chosen scope, commit, actual checks and remaining limits here when work proceeds.

## Evidence

Implementation: `9b087ba` with strict-typing fix `e42ba7a`; [PR #23](https://github.com/Jakespitteler/Sound-Model/pull/23).

The optional strict numeric field defaults to `None`, retains version 1 and is bounded to
0–300. Saved-document validation also enforces 25 unique ordinary/special thresholds, sharing
a slot when equal. Legacy raw-file tests prove omitted values remain unset without rewriting
the file. New API cases cover None/zero/300/fractional values, Save/Open/recovery validation,
NaN/infinity/bool/string/out-of-range rejection with unchanged saved records, and the union
budget boundary. Five cases failed before implementation. All 105 Python tests, Ruff and
strict Pyright pass. No UI, default criterion, propagation change or dependency is added.
