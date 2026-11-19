# Field observations: record and compare only

[Task 031](tasks/031-site-measurement-pins.md) · [Model](model.md)

Measurements are recorded sound pressure, independent of source sound power and hypothetical
receivers. They never fit source emissions or change propagation, background or contours.
No measurements, meter capabilities or averaging conditions are invented.

## Saved record

Version-1 scenes accept `measurements`, defaulting to an empty list for older files. Up to
100 uniquely identified observations are supported, with existing ±85°/±180° coordinate
validation. A record requires a stable `id`, coordinates and a finite `level_db`.

Optional fields: `name`, `activity`, `meter`, `note`, `duration_s` (positive or unknown),
`metric` (`unknown`, `LAeq`, `LAmax`) and `test_kind` (`unknown`, `stationary`, `moving`,
`startup`). Zero/negative pressure levels are valid; unknown metric/duration is not zero.
LAmax is a maximum designation, never silently converted to a sustained average.

`source_id` may link a modeled machine. Its optional `source_context` snapshots the modeled
source ID/type, label, sound power, coordinates and operating-mode label when entered.
This is entered model context, not proof of where the real vehicle was during a test.
Deleting/moving a simulated machine cannot delete/move observations or rewrite that snapshot.
Historical source/type references may outlive the active scenario. Contradictory snapshot
and link IDs are rejected. Changing the linked source explicitly captures a new model setup;
editing an observed level or note does not silently refresh historical context.

Save/Open, validation and browser recovery retain accepted complete/partial records. An
unsubmitted draft lacking its required pressure is not a recorded observation. Ordinary
acoustic requests exclude measurement records; they are not extra sources or receivers.

## Read-only comparison endpoint

`POST /api/measurements/compare` accepts the existing scenario, at most 100 observations and
optional `source_modes` (bounded current operating labels). It returns independent states
keyed by observation ID. It reuses the existing scalar field and background display policy;
all active source energies are included, regardless of which machine an observation links.

| State | Meaning |
| --- | --- |
| `available` | Stationary/steady test, LAeq, known positive duration/activity, linked source and matching captured model setup; a current machinery-only estimate is supplied |
| `unsupported` | Moving/startup/unknown test, maximum/unknown metric, missing duration/activity or missing captured setup; observation stays recorded |
| `source_missing` | Link is absent or the source was removed; observation stays recorded |
| `source_changed` | Linked source position, type, label, power or operating-mode label changed; observation stays recorded |

Available comparisons are geometry estimates with eligible metadata, not validated test
compatibility. The operator must check that the emission/setup represents the recorded
activity. The observed reading includes background/other sound while the modeled value is
machinery alone. No signed “prediction error,” background subtraction, accuracy score,
calibrated source power or audibility verdict is produced. A matching text label does not
certify physical operating conditions.

A returned `point` retains the existing near-field and negligible-overall-increase states.
Unavailable/pending results are never shown as zero. Estimates describe the **current**
scenario, not predictions purportedly made when the physical measurement was taken.
Source moves/removal are limitations rather than a reason to discard field evidence.

## Verification

`tests/test_measurements.py` uses fictional data and independent intensity references to
check all-source energy addition, unchanged powers/results after observed-level edits,
unknown/moving/maximum cases, changed/missing context, operating labels, negligible results,
invalid/duplicate inputs, legacy defaults and save round-trips. No real site evidence is
supplied and no environmental propagation or instrument validation is claimed.
