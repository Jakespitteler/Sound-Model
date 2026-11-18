# 024 — Replace distance-only scope with a defensible POC policy

Status: Investigation complete; proposed policy awaiting owner decision.
Task creation explicitly requested by the owner on 17 November 2026.

## Problem and scope

The owner rejects a blanket 10 km audibility cutoff for receivers and contour lines. Review how to expose reasonable results while preventing distant geometry-only predictions being presented as credible hearing estimates. Separate computational safety, source/model plausibility and output confidence. Present the smallest defensible policy with its assumptions and test cases, then agree it with the owner before coding a new rule.

## Exclusions

No new framework, service, unapproved propagation engine or full assessment platform. These
briefs authorise planning of the requested POC features, not implementation within the
documentation PR. Keep future implementation in separate focused PRs.

## Acceptance

- [x] A policy comparison covers an ordinary haul truck at about 300 km, a plausible louder-source/local case beyond 10 km, the same source at several distances, combined sources and contour failures. Distance alone cannot decide whether sound can be heard.
- [x] Extreme 300 dB(A) LwA examples are flagged as outside the ordinary machinery/linear point-source model rather than treated as validated explosions. No invented absorption, background level, legal limit or arbitrary audibility threshold is introduced.
- [ ] The agreed policy specifies numeric/warning/withheld states consistently for receivers and lines, retaining independent contour errors, all-source combination and real compute limits. It does not alter the separate 10 km pairwise navigation-cluster rule.

## Verification

First reproduce current outputs with analytical references and document where the model cannot answer audibility. Use traceable sources for any proposed physics; new libraries or propagation engines require owner approval. After a policy is agreed, write small implementation/validation slices. Do not merely remove all guards or replace 10 km with another arbitrary distance.

## Likely files

- `docs/model.md`
- `src/scope.py (review)`
- `src/contours.py (review)`
- `tests/test_scope.py (review)`
- `docs/tasks/024-source-aware-model-scope.md`

Record the chosen scope, commit, actual checks and remaining limits here when work proceeds.


## Investigation — 18 November 2026

Read the [policy review](../scope-policy-review.md) for reproduced examples, alternatives,
proposed receiver/line/slider states, validation cases and a flow diagram. Investigation commit:
`2161e84`. Baseline main: `29ae47f` (task 030 merged). No application behaviour or dependencies changed.

The current guard hides a 130 dB(A) source at 10,001 m despite a change of less than
0.001 dB from 10,000 m, while permitting 300 dB(A) source contours inside 10 km. Removing
only the contour guard would leave the slider's distance-derived lower bound unchanged.
The review recommends qualified geometry estimates without hard distance suppression,
retained compute guards and a separate unsupported-input treatment for the 300 dB(A) stress
case. It does not propose a new audibility threshold or a general validated source-power cap.

Two owner choices remain: whether distant geometry arithmetic should appear with an explicit
qualification, and whether the known extreme input should be withheld or shown with an
unsupported-input warning. No agreement is inferred from this investigation or its PR.
Acceptance item 3 remains open until the owner chooses. No follow-up task has been added.

Evidence: independent intensity-reference calculations matched `source_level` in 21 cases;
real baseline calls reproduced the distance discontinuity, mixed-source totals, per-level
scope/domain failures and the slider bounds. OSHA's free-field and power/pressure guidance
was read; unavailable NPL/WA references are documented in the review and not relied upon.
`uv run pytest tests/test_scope.py tests/test_contour_range.py tests/test_contours.py -q`:
**35 passed**. Documentation links and whitespace checks passed. No UI change was made,
so no new screenshots were needed. See the review for reproducible commands and limits.
