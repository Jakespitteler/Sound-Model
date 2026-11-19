# 016 — Decide whether a printable summary belongs in the POC

Status: Complete — printing removed from the POC; no implementation.
Task creation approved by the owner on 17 November 2026. Theme/dependencies: 007 (parked wider theme).

## Problem

The owner tentatively likes a printable screening summary but wants an explicit chance to remove it as scope creep.

## Scope

Present one small text/wireframe example and ask the owner to keep or remove it. A kept POC summary would contain scenario name, input powers/positions and estimate notes, receiver results, failed levels, model identifier and plain limitations. Record the decision in this file.

## Exclusions

Do not implement printing, install PDF/report libraries, produce regulatory pass/fail claims or create the implementation task until the owner decides. A formal reviewed assessment report remains outside the POC.

## Acceptance

- [x] The owner records Keep or Remove with a short reason; no decision is inferred from silence.
- Not applicable: Keep was not selected; no implementation task will be created.
- [x] If Remove, mark the idea deferred and leave the application unchanged.

## Verification

Owner review is the evidence. Confirm that only this decision record changed and that no report/dependency was added. A mock-up must use fictional inputs and show screening limitations prominently.

## Likely implementation files

- `docs/tasks/016-print-summary-decision.md`

Use the existing stack. If the slice grows beyond roughly five implementation files, split
it before editing. Record completed checks and the commit here; do not mark it done from
intent alone. New dependencies and external data require separate owner approval.


## Reviewable example — 19 November 2026

The owner requested the next task after the model-feasibility review. All approved POC
implementation items are complete; this is the remaining print decision, not permission
to build a reporting feature. Base main: `5c90c88` (task 026 review merged).

Recommendation: **keep a minimal scenario snapshot only**, if a printable record would be
useful. Use the browser's existing Print / Save as PDF facilities; do not add a PDF library
or reporting service. If a printout is not useful for this POC, remove/defer it without
changing the application.

### Proposed first version

One **Print summary** action would open a simple printable HTML snapshot of the current
working scenario. Keep it to these contents:

- Scenario name, capture time, model identifier and whether edits are unsaved.
- Machine powers, placed coordinates and existing estimate/source/operating notes.
- Receiver names, coordinates and current results, including negligible/pending/unavailable
  states. Never present an old response as the result of newer inputs.
- Entered background and the user-set acceptable reference, both explicitly labelled.
- Contour thresholds/statuses and each failure reason, or an explicit “None” for failures.
- A short, prominent statement of model limitations.

Use the current accepted inputs and matching current results; capture them together so later
edits cannot change the open snapshot. This proposal adds no acoustic correction or new
calculation. Pending/failed results stay labelled. The snapshot need not match the last named
save: unsaved changes must be obvious. Allow additional pages for large scenarios rather than
silently dropping machines, receivers or notes to fit one page.

No satellite-map image in the first version, export/import, audit history, template designer,
regulatory verdict, automatic background assumption or claim of inaudibility. Browser print
layout needs verification on the supported desktop browser if the owner chooses Keep.

### Fictional text mock-up

This is a layout example, not an assessment of actual Greenbushes operations or measurements.
The displayed receiver values and line statuses were checked with the existing model using
the fictional inputs below. No report feature was implemented to generate it.

```text
SOUND-MODEL — SCENARIO SNAPSHOT
Fictional day shift | Current working copy: unsaved changes

SCREENING ESTIMATE ONLY
Not a measurement, compliance assessment or proof of inaudibility.

INPUTS
Background: 45 dB(A), assumed for this example
Acceptable reference: 50 dB(A), user-set; not a legal limit
Cloud cover: 0%, recorded only

Machine              LwA       Latitude     Longitude
1. Haul truck        120 dB(A) -33.86750     116.07647
Note: Fictional guessed emission; no manufacturer evidence.
Source reference / operating mode: not supplied.

RECEIVERS — MACHINERY CONTRIBUTION
Name    Latitude    Longitude    Result
Town    -33.86000   116.07647     50.6 dB(A)
Camp    -33.86750   115.80000     Negligible overall increase

Camp adds less than 0.1 dB to the entered background.
This does not establish that a distinctive sound cannot be heard.

CONTOURS
40 / 60 / 80 / 100 dB(A): calculated
Overall-increase boundary: +0.1 dB at 28.7 dB(A) machinery
Failed levels: none

MODEL AND LIMITS
full-space-point-source-v1 | Independent sources; geometry only
Terrain, barriers, ground and atmospheric effects are omitted.
Equipment and background values above are fictional assumptions.
```

An actual snapshot would add its capture time and retain all available equipment notes,
including those longer than this example. Power and receiver pressure are different
quantities; the result column excludes background. “Calculated” means geometry extraction
succeeded, not that environmental predictions are validated.

### Decision and verification

**Owner decision: pending.** No Keep/Remove choice or reason is inferred from “next task.”
If Keep, confirm that the minimal contents and ordinary browser print approach above are
sufficient before a bounded implementation task is drafted. If Remove, mark printing deferred.
The acceptance checkboxes remain open until that reply.

Only this decision record changed. No app code, dependency, saved scenario or report feature
was added. Read-only checks against the current model reproduced Town **50.584965 dB(A)**,
Camp's **negligible** state and the **28.672253 dB(A)** boundary; all five example contour
levels returned `ok`. Inputs were fictional and no scenario file was saved. `git diff --check` passed; the record contains no local links to validate. No UI screenshot is needed for this text
mock-up. Author review only; no independent reviewer.


## Owner decision — 19 November 2026

**Remove printing from the POC.** The owner explicitly requested removal and continuation
to the next task. No further reason was supplied. Printing and printable-summary work are
excluded from the POC; the example above remains historical decision context only. No
printing feature, PDF dependency or implementation task was added. This completes task 016.
