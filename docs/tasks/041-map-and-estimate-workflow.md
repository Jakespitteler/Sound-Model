# 041 — Map controls and measurement workflow

- Named meter pins use the map popup and Control quick-delete controls.
- A draft area has a draggable centre. Moving it clears the prior preview. Applied areas
  stay fixed at the fitted centre.
- Fit confidence reports held-back agreement and sensitivity to background. Additional
  machines participate in combined contours and receiver predictions. They need their
  own evidence.
- Machines, meter readings and receivers have separate workspaces. Meter readings can
  be viewed by test category. A walkthrough explains both ways to start a scenario.
- Cloud cover was removed from the interface. Older save files can still carry that
  field for compatibility. Background, contour levels and optional octave bands remain
  available because they support the prediction or its interpretation.

## Possible additions for a field pilot

1. Show the change at named receivers when comparing a baseline shift with an extra machine.
2. Flag listening points beyond the distances covered by held-back measurements.
3. Help the operator record comparable background and operating runs at the same location.

Field feedback can establish which of these would help the most.

## Verification

Chromium verified dragging the draft centre, previewing confidence, saving and reopening,
deleting a named pin, and switching reading categories. With synthetic inputs, adding the
truck changed the contours and raised the test receiver result from 42.7 to 45.7 dB(A).
The tests used the fallback map. Python, browser fixtures, Ruff and Pyright passed.
