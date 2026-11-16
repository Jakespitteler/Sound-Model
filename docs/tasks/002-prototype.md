# 002 — Map and scenario prototype

State: in-progress. Owner: Codex. Branch: agent/002-sound-prototype. Depends on 001.

Owner approved the documented prototype on 2026-11-16 subject to no-admin installation.
GitHub PR inspection attempted; API returned Forbidden. Preserve local work and report this limitation.

## Prerequisites

Explicit approval for TypeScript, Vite, Leaflet, Vitest, source/scenario data representation,
and the chosen external map service. Confirm whether street maps are acceptable temporarily.
Verify current provider terms and necessary network access before connecting live tiles.

## Work

Create the minimal browser application, editable catalogue, draggable source instances,
receptors, noise overlay, legend, and cloud metadata control. Implement the reviewed baseline
model with explicit provenance and limits. Use the architecture boundaries and specification
acceptance criteria. Add the root check command and lockfile. Document startup and validate
actual browser interactions. Do not mark the satellite requirement complete with a street map.

Split coherent implementation PRs if needed to respect the starter's size guidance; keep
partial branches labelled and record the branch containing the full working prototype.

## Evidence

Provide analytical model tests, state tests, successful type check/build, and inspected browser
screenshots. Map terms and attribution require documentary evidence. No compliance verdict.
