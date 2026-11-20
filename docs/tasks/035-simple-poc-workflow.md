# 035 — Simplify the POC workflow

Status: Implemented; ready for review above task 034.

## Owner request

Make the app clear to a first-time nontechnical user, remove unnecessary visible complexity,
and preserve the previously discussed functionality because the eventual use case is flexible.
The immediate trigger was an area fit blocked by mismatched activity labels that were difficult
to discover and correct.

## Design and scope

One main job per workspace: Machines, Measurements or Contours. Both model inputs lead to
Check a location. Measurements are a first-class path, not an advanced disclosure under the
machine catalogue. Keep one natural sidebar scroll area. Use the existing design tokens,
plain HTML/JS and existing map/calculation modules; no new technology or physics.

Guide fitting through Setup → Readings → Result. Present recorded activities as choices,
show every selected reading's activity and flag mismatches before calculation. Make editing
the original reading a direct action. Never silently relabel an observation or infer unknown
meter data. A unique recorded activity may be selected without inventing a new condition.

Keep specialist evidence, coordinates, cloud notes and diagnostics available in disclosures.
Keep original records, both fitting modes, controls for contours, save/recovery, catalogue and
frequency inputs. This is progressive disclosure, not loss of stored data or model capability.
The sound reference guide starts collapsed. No automatic calibration or new audibility claim.

## Acceptance

- [x] First-use controls expose both input paths and a listening-point action without navigating specialist settings; form edits survive workspace changes.
- [x] Area and machine estimates use three visible stages; mismatches have an early explanation and direct correction path; applying hands off to checking a location.
- [x] Existing calculation/data tests and browser regressions pass, with real-app checks and inspected desktop/narrow screenshots of the new flows.

## Verification — 20 November 2026

Runtime commits `ece5cc8` and `72dd589`. `workflow.js` owns workspace presentation/journey; existing controllers
continue to own observations, validation, prediction and persistence. No backend/schema changes.

- **214 pytest tests passed**. Ruff check/format, Pyright and 25-skill integrity passed.
- **243 browser checks** across 15 fixtures: new simple-workflow 17, fitting-workflow 19,
  measurement-fitting 18, measurements 18, sidebar-expanded 17, frequency-bands 14,
  equipment-metadata 6, sidebar-entities 15, background-boundary 15, receiver-map-names 17,
  map-deletion 21, repeat-placement 14, placement-history 23, acceptable-label-priority 13,
  contour-cache 16. Obsolete copy expectations updated to the new plain-language labels.
- Real Chromium workflows: initial machine path, visible measurement path, three-stage area
  fit without machines, unique activity selection, preview/apply/save with original readings
  retained, machine calibration preserving original catalogue data, no acoustic calls on
  workspace changes, early mismatched-activity warning, rejected Apply for incompatible tests,
  direct reading edit and marker-driven workspace reveal. No page errors or horizontal
  overflow at 390 px. Presentation does not create sources or guess background.
- Inspected [first use](../images/task-035/simple-first-use.png),
  [reading selection](../images/task-035/simple-choose-readings.png),
  [preview](../images/task-035/simple-result.png),
  [activity mismatch](../images/task-035/simple-mismatch-warning.png) and narrow layout.

Synthetic readings only; imagery unavailable/grid fallback. Author review, not independent
usability testing with new users. The equivalent-point model and its physical limitations
remain unchanged. Human review/merge required. No field accuracy or audibility validation.
