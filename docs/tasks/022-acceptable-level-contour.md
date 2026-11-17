# 022 — Show a special acceptable-level contour

Status: Blocked until 021 and 025 are complete.
Task creation explicitly requested by the owner on 17 November 2026.

## Problem and scope

Add a compact optional acceptable-level control, editable by number and slider. Label its line clearly as Acceptable level — user-set, and distinguish it from ordinary contours without adding colour/style settings. Start unset. Reuse the same combined-source contour calculation.

## Exclusions

No new framework, service, unapproved propagation engine or full assessment platform. These
briefs authorise planning of the requested POC features, not implementation within the
documentation PR. Keep future implementation in separate focused PRs.

## Acceptance

- [ ] A chosen level produces a clearly labelled special line; clearing it removes that reference and retains ordinary levels.
- [ ] A matching ordinary threshold is calculated only once, with no duplicate geometry. The 25-unique-level budget includes the special level; no ordinary line is silently dropped.
- [ ] A failed special contour reports its own reason while other levels remain visible; Save/Open/recovery preserve its setting and no compliance/inaudibility claim appears.

## Verification

Check unset, matching threshold, full level budget, failed special line, high contrast and Save/Open. Inspect open controls and line-label screenshots. Split any persistence/type integration exceeding roughly five implementation files into a follow-up slice before editing.

## Likely files

- `src/static/css/contours.css`
- `src/static/js/ui-contours.js`
- `src/static/js/contour-layer.js`
- `src/static/js/main.js`
- `src/templates/partials/contours-section.html`

Record the chosen scope, commit, actual checks and remaining limits here when work proceeds.
