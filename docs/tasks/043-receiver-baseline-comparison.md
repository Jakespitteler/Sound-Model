# 043 — Compare baseline and current noise at receivers

Open **Compare with a baseline** in Receivers and capture the sources before adding,
moving or removing equipment. The table reports both predictions at the same current
receiver positions. It computes the difference before background screening so both
columns have the same basis. A missing source set has no finite dB reading or change.
The baseline is held in memory for the open scenario.

## Remaining field work

- Confirm the town listening points and operating conditions to compare.
- Collect representative machinery-on and background readings at comparable positions.
- Check the predictions with independent readings toward town.

## Candidate follow-up tasks

1. Pair operating and background readings from the same test location and show whether their averaging basis matches.
2. Compare two named saved scenarios so a baseline can be reused after reopening the app.
3. Add temporary source on/off controls to try shutdowns and alternate work layouts without repeatedly placing equipment.

The wider backlog tracks verified equipment data, propagation and independent validation.

## Verification

Chromium showed 42.7 dB(A) for the fitted area and 45.7 dB(A) after adding a truck.
Renaming the receiver updated the table label, and moving it recalculated both columns
at its new location. Clearing the baseline removed the comparison. The rehearsal
used synthetic readings and the fallback map. All 219 Python tests and 269 browser
checks passed, along with Ruff, formatting and Pyright.
