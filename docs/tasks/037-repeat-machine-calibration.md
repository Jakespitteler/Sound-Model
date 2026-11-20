# 037 — Recalibrate a machine from its recorded readings

In **Meter readings**, choose **One machine, using meter readings**, select the original activity
and reuse your fit and check readings. This works after saving and reopening the scenario.
The app checks the recorded machine, position and operating setup, using the catalogue
history saved with the machine's prior calibration.

Each application creates a derived catalogue entry for the selected machine and retains
the readings and the previous fit. Readings recorded against an earlier catalogue entry
can be used alongside later readings for the same setup. Choose at least one separate
location to check the estimate each time.

The Chromium check applied two repeat calibrations after reopening the save. The original
readings and placed-machine ID survived both applications. The Python regression also
checks mixed catalogue versions and rejects changed machine positions and operating modes.
216 Python tests, 254 browser checks, Ruff and Pyright passed.
