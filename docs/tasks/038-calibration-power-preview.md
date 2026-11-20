# 038 — Compare current and proposed sound power

A successful machine calibration preview shows its current and proposed sound power
in dB(A) LwA. The current value comes from the selected machine at preview time. After
applying a calibration, the next preview uses that updated value.

The held-back meter readings remain visible beneath the power comparison. Area previews
show their estimated power under calculation details. Editing the scenario clears the
previous comparison until a fresh preview is ready.

Chromium showed 120.0 dB(A) LwA current and 110.0 proposed before applying the first
calibration. Reopening the saved scenario showed 110.0 as the current power. Desktop
and 390 px screenshots were inspected using synthetic readings. The full Python suite
and browser fixtures passed.
