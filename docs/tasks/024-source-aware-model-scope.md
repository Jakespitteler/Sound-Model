# 024 — Replace distance-only scope with a defensible POC policy

Status: Ready for investigation; agree the policy before implementation.
Task creation explicitly requested by the owner on 17 November 2026.

## Problem and scope

The owner rejects a blanket 10 km audibility cutoff for receivers and contour lines. Review how to expose reasonable results while preventing distant geometry-only predictions being presented as credible hearing estimates. Separate computational safety, source/model plausibility and output confidence. Present the smallest defensible policy with its assumptions and test cases, then agree it with the owner before coding a new rule.

## Exclusions

No new framework, service, unapproved propagation engine or full assessment platform. These
briefs authorise planning of the requested POC features, not implementation within the
documentation PR. Keep future implementation in separate focused PRs.

## Acceptance

- [ ] A policy comparison covers an ordinary haul truck at about 300 km, a plausible louder-source/local case beyond 10 km, the same source at several distances, combined sources and contour failures. Distance alone cannot decide whether sound can be heard.
- [ ] Extreme 300 dB(A) LwA examples are flagged as outside the ordinary machinery/linear point-source model rather than treated as validated explosions. No invented absorption, background level, legal limit or arbitrary audibility threshold is introduced.
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
