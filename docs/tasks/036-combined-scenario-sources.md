# 036 — Use machines and estimates together

A first-time user can build a scenario from machines, field readings or both, then check
the combined sound at town. The Scenario tab offers both starting points. Applying an
estimate brings the user back to their listening points.

| Field situation | What happens on the map |
| --- | --- |
| The meter picked up the loader and crusher together | A single area estimate replaces their selected placements |
| A separate truck was absent during that test | Keep the truck to predict it operating alongside the area |
| Tests isolated one specific machine | Apply its calibrated power to that placement |

The user classifies each existing source before applying an area. The app cannot infer
coverage from distance or identify individual machines in a mixed recording. An incomplete
choice leaves the scenario untouched. The saved estimate retains the original inputs,
check readings and recorded source selections.

Verification covers mixed, all, none and incomplete coverage, original evidence, save/open
and independent-source summation at a town receiver. The screenshots use fictional data.

[Source choices](../images/task-036/coverage.png) · [Combined listening result](../images/task-036/scenario.png)

Verified with 215 Python tests, 15 Chromium fixtures, Ruff and Pyright. In the end-to-end
test a separate truck contributed 34.68 dB(A) at a town point and the loading area
contributed 33.23 dB(A). The combined 37.02 dB(A) matched an independently computed
energy sum. Browser checks exercised machine-only, area-only and mixed scenarios,
incomplete coverage, and saving and reopening the mixed result. Screenshots were inspected
on desktop and at 390 px. Imagery was unavailable during capture.
