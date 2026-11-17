# 022 — Show a special acceptable-level contour

Status: Implemented; ready for review after 021 and 025.
Task creation explicitly requested by the owner on 17 November 2026.

## Problem and scope

Add a compact optional acceptable-level control, editable by number and slider. Label its line clearly as Acceptable level — user-set, and distinguish it from ordinary contours without adding colour/style settings. Start unset. Reuse the same combined-source contour calculation.

## Exclusions

No new framework, service, unapproved propagation engine or full assessment platform. These
briefs authorise planning of the requested POC features, not implementation within the
documentation PR. Keep future implementation in separate focused PRs.

## Acceptance

- [x] A chosen level produces a clearly labelled special line; clearing it removes that reference and retains ordinary levels.
- [x] A matching ordinary threshold is calculated only once, with no duplicate geometry. The 25-unique-level budget includes the special level; no ordinary line is silently dropped.
- [x] A failed special contour reports its own reason while other levels remain visible; Save/Open/recovery preserve its setting and no compliance/inaudibility claim appears.

## Verification

Check unset, matching threshold, full level budget, failed special line, high contrast and Save/Open. Inspect open controls and line-label screenshots. Split any persistence/type integration exceeding roughly five implementation files into a follow-up slice before editing.

## Likely files

- `src/static/css/contours.css`
- `src/static/js/ui-contours.js`
- `src/static/js/contour-layer.js`
- `src/static/js/main.js`
- `src/templates/partials/contours-section.html`

Record the chosen scope, commit, actual checks and remaining limits here when work proceeds.

## Implementation and evidence

Implementation `0139534`, on `agent/acceptable-level-contour`, stacked above task 025
(`agent/acceptable-level-state`, PR #24) and task 021 (`agent/acceptable-level-contract`, PR #23).
Five runtime files change. No engine, propagation equation, dependency or default criterion changes.

The optional number starts blank and the slider disabled. Entering a value enables the slider;
Clear removes only the reference. The line uses the automatic pressure colour, a heavier dashed
stroke/halo and a distinct “Acceptable level — user-set” label. A matching ordinary threshold
uses one result and line setting, and clears back to the ordinary style without a new request.
Count/budget includes the special level. Failure text names the reference and its reason while
successful ordinary lines remain. A stale DOM row during ordinary removal is skipped until the
existing synchronous render finishes, allowing a full-budget scene to free a slot safely.

Verification on 17 November 2026:

- All **105 pytest tests** and Ruff lint/format, strict Pyright, pinned-skills integrity,
  offline lockfile and diff checks pass. The engine's existing accuracy/scope tests are unchanged.
- The committed plain-browser state page passes **24 checks** (including snapshot/restore,
  finite/unset/zero/range validation, shared/full/split budgets, rejected-edit preservation,
  retained IDs/catalogue notes and unchanged direct acoustic payloads). It initially failed
  against the missing default. The UI control was likewise absent in the parent slice.
- Actual Chromium checks verify matching 40 dB(A) with zero new requests, exact original
  geometry and unchanged SVG path count. A new 50 dB(A) reference requests only `[50]`;
  receiver readings remain equal and the criterion metadata never enters acoustic requests.
  Slider keyboard edits, Clear, Save/Open and populated recovery pass; recovery does not
  rewrite the named save. Clearing restores ordinary geometry exactly without a request.
- An injected special-level failure identifies the acceptable threshold/reason while ordinary
  40/60 dB(A) lines remain successful. Retry recovers that level. High contrast, hidden-overlay
  edits, the 25-level rejection, ordinary-row removal and successful reuse of its freed slot
  pass. No JavaScript page errors occurred.
- Desktop (1440 px), isolated-failure and narrow (390 px) screenshots were captured and
  inspected. The special label is readable without word-by-word shrink-wrapping; no horizontal
  page overflow occurred. Leaflet's normal removed-tooltip fade was allowed to settle before
  checking that only one special label remains.

Session artifacts in `/workspace/artifacts/`: `check_acceptable_level.py`,
`acceptable-level-desktop.png`, `acceptable-level-failure.png`, `acceptable-level-mobile.png`.
Imagery was unavailable, so screenshots verify the working plain-background state. Native
Windows, other browsers and screen readers were not tested. No independent review or
compliance/inaudibility validation is claimed. Human review and merge remain required.

Next queued task: 023, Ctrl-click repeat placement; not implemented here.
