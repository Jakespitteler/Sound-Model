# 036 — Use machines and estimates together

Start with machines, field readings or both. Previewing an estimate leaves the current
map intact. On Apply, the selected workflow determines which sources contribute.

| Field situation | What happens on the map |
| --- | --- |
| A whole area was measured | Replace every placed source with one area estimate at the chosen centre |
| Another truck will run alongside that activity | Place the truck afterward to see the combined sound at town |
| A test isolated one machine | Calibrate only that placement. The machine can still be moved for a what-if scenario |

The area has a fixed position and cannot be placed again from the catalogue. Build a new
estimate to change the centre. Drag a meter pin to correct its location, including while
entering a new reading. Saved readings, listening points and catalogue entries survive an
area replacement. Applied fits retain their evidence when a pin moves.

[Area replacement preview](../images/task-036/coverage.png) · [Result with an additional truck](../images/task-036/scenario.png)

Verified with 215 Python tests and 15 Chromium fixtures. The end-to-end check applied an
area over two sources, placed a separate truck, dragged a recorded pin and reopened the
saved scenario. The independent energy sum matched the receiver prediction. Screenshots
use synthetic readings and the fallback map.
