# Tools for the field pilot

## 044 Pair operating and background readings

Link a machinery-off reading from the operating reading’s editor. The app checks LAeq,
steady test basis, known matching duration, locations within 5 m and a gap of at least
3 dB. These are checks on the entered information. Site conditions, machine state and meter
setup still need confirmation. The link persists in the scenario. Fitting and screening
use the user-entered scenario background.

## 045 Compare saved scenarios

Open the proposed scenario. Under **Receivers → Compare with a baseline**, choose **Use
saved scenario** and select the baseline. Both sides use the current scenario’s receivers
and the active sources from their respective configurations. Selecting the baseline loads
its saved source layout without replacing the working scenario.

## 046 Toggle sources on and off

Switch a machine or applied area on or off in its map popup or Machines row. Off sources
stay placed and are excluded from contours, receiver predictions and model evidence.
The switch is undoable and its state is saved with the scenario.

## Verification

220 Python tests and 276 browser checks passed, along with Ruff, formatting and Pyright.
In Chromium, comparing two saved scenes with synthetic data showed a 3.0 dB increase
from a second truck. Switching it off brought the difference to 0.0 dB. The editor flagged
a background pair with different averaging durations. The link and off state survived saving
and reopening. The rehearsal used the fallback map.
