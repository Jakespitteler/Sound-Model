# 039 — Rehearse the field workflow

The rehearsal started with a new scenario. In Chromium, three stationary 60-second
LAeq readings were entered using the measurement editor. They shared the activity
**Steady crushing and loading** and an illustrative background of 34 dB(A).

| Distance from area centre | Total meter reading | Role |
| --- | --- | --- |
| 500 m | 50.14 dB(A) | Build estimate |
| 900 m | 45.26 dB(A) | Build estimate |
| 1,500 m | 42.37 dB(A) | Check prediction |

The area radius was 200 m. After reviewing the held-back reading, the area estimate
was applied. A listening point showed 42.7 dB(A) from the modelled area. The saved
scenario reopened with all three meter readings and the area estimate. The rehearsal
used synthetic readings and the fallback map.

The form used to require typing the activity for each reading. It now offers distinct
activity labels from saved readings in the scenario. Each new reading starts blank so
the operator can choose a matching activity or enter a new one. The field guide now
uses the labels from the app.

The Python suite (216 tests) and Chromium fixtures (259 checks) passed, along with
Ruff and Pyright. The focused activity field was inspected in Chromium.
