# Documentation

Start with the guide that matches your question. The pages below describe current behaviour;
dated change records explain how the project reached it.

| I want to… | Read |
| --- | --- |
| Start the app | [Project README](../README.md#start-the-app) |
| Place machines, read results and keep my work | [User guide](user-guide.md) |
| Understand the calculations and their limits | [Sound model](model.md) |
| Find modules, data flows and API boundaries | [Architecture](../ARCHITECURE.md) |
| Run checks or troubleshoot startup | [Developer guide](development.md) |
| Review the proposed replacement for the distance-only display rule | [Scope policy review — decision pending](scope-policy-review.md) |
| Choose an approved POC task | [Task backlog](tasks/README.md) |
| Use or update the installed agent skills | [Agent Skills integration](../.agents/README.md) |
| Check use permissions | [Project licence](../LICENSE) and [third-party notices](../THIRD_PARTY_NOTICES.md) |

## Current capabilities and gaps

| Available now | Still missing |
| --- | --- |
| Combined independent-source contours; separate failure reporting | Validated terrain, barriers, ground, absorption and weather propagation |
| Numbered equipment icons, receiver readings and high contrast | Site-reviewed assessment criteria and measured source/background evidence |
| Named Save/Open and optional restoration of a browser recovery draft | Portable import/export, recovery history and multi-user conflict handling |
| Typed API, numerical tests and pinned agent workflows | Validation of real mine-to-town predictions against independent measurements |

This is a POC, not an environmental-assessment platform. Missing capabilities are not
commitments. Only the owner-approved small slices in the backlog are active candidates;
export/import and broader assessment work are not being added to the POC.

## Historical change records

These records preserve their original scope, measurements and limitations. Their test counts
are results from those changes, not a live count of today's suite. Do not use an old feature
list as the current specification.

| Record | What it explains |
| --- | --- |
| [Initial contour work](contour-task.md) | Early implementation, including controls later removed |
| [Physics and startup audit](physics-audit.md) | Equation checks and reproduced JavaScript/MIME startup failures |
| [Library investigation](library-options.md) | Approved optimisation, historical timings and unapproved engine candidates |
| [Simpler editor](simple-ui-change.md) | Preset guesses, desktop tabs and removal of contour dragging |
| [Scope and saves](scopes-and-saves.md) | Per-level failures, 10 km display policy and explicit persistence |
| [Hover correction](hover-card-fix.md) | Tooltip sizing, placement and open-state screenshot checks |

The vendored `.agents/` material is upstream guidance, kept unchanged. Generic examples there
must be adapted to this project's approved stack and do not override project rules.
