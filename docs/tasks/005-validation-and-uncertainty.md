# 005 — Validate predictions and report uncertainty

Status: todo. Priority: P0. Owner: unassigned.
Dependencies: 002, 003, 004.

## Work

Compare predictions with independent measurements and an appropriate reference implementation. Keep model calibration cases separate from validation cases. Investigate discrepancies rather than adding an unexplained correction.

Run sensitivity analysis for source power, positions/heights, weather, terrain and ground assumptions. Record conservative credible scenarios and uncertainty ranges. Include time/duty-cycle and maximum-event handling only using agreed metrics; average and maximum sound levels cannot be interchanged.

## Acceptance evidence

A versioned validation report states measured/predicted differences, uncertainty, coverage and remaining limitations. Threshold comparisons show assumptions and uncertainty margins, with inconclusive outcomes where evidence is insufficient.
