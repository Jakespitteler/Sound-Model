# Due-diligence work order

Goal: assess and manage the risk that machinery operating in a new area disrupts nearby town receptors, with traceable evidence and appropriate review. The app should support an honest assessment, not seek a predetermined inaudibility conclusion.

Tasks are proposals, not approval of new dependencies, datasets, thresholds or regulatory claims.
P0 establishes assessment credibility; P1 improves delivery/operating decisions; P2 improves usability.

| Task | Priority | State |
| --- | --- | --- |
| [001 — Agree the assessment basis and town receptors](001-assessment-basis.md) | P0 | todo |
| [002 — Collect traceable equipment sound-power data](002-equipment-evidence.md) | P0 | todo |
| [003 — Measure background noise and relevant weather](003-background-and-weather.md) | P0 | todo |
| [004 — Select and validate a suitable propagation engine](004-propagation-engine.md) | P0 | todo |
| [005 — Validate predictions and report uncertainty](005-validation-and-uncertainty.md) | P0 | todo |
| [006 — Make contour calculation faster and more robust](006-contour-performance.md) | P1 | in progress: first compiled optimisation complete |
| [007 — Save reproducible scenarios and evidence reports](007-scenarios-and-audit-trail.md) | P1 | todo |
| [008 — Compare practical mitigation and operating controls](008-mitigation-and-operations.md) | P1 | todo |
| [009 — Improve map reliability and scenario editing](009-map-and-editor-usability.md) | P2 | todo |
| [010 — Scenario autosave and recovery](010-scenario-autosave.md) | P1 | todo |
| [011 — Simple scenario workflow](011-simple-workflow.md) | P2 | todo |

Start assessment scoping and equipment/measurement planning alongside software work. Faster contour calculations do not compensate for missing propagation physics or evidence.


Persistence is still planned: current scenarios are lost on reload. Task 010 targets that
immediate problem before the wider reporting work in 007.
