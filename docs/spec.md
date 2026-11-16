# Product specification

Status: indicative prototype implemented; satellite imagery and validated audibility assessment remain open.

## First prototype

A browser workspace opens near Greenbushes, Western Australia. Its centre is an approximate
navigation starting point, not a surveyed mine boundary or an assumed machine location.
Users can navigate to another location and place sources there.

A machine catalogue supports named types and multiple instances of each type. Users can
add and remove types, add and remove instances, and drag each instance on the map.
Reject non-finite coordinates, invalid latitudes, and invalid acoustic input. Do not silently
reinterpret sound pressure levels as sound power levels.

Display the energetic sum of contributions as a labelled noise overlay and show numerical
levels at selected receptor locations. Include units, scale, source-data provenance, and
model assumptions. Recalculate after source movement, edits, or removal. An empty scene
has no modelled source contribution; do not display it as a measured 0 dB environment.

Provide a cloud-cover input with an explicit indication that it currently records a scenario
condition and has no validated acoustic correction. Defer numerical meteorological effects.
Satellite imagery remains requested; the owner approved a temporary street-map prototype fallback.
Map attribution must remain visible and the provider must be replaceable.

## Implemented interaction decisions

- Source input is A-weighted sound power level (LwA), with example/measured provenance.
- Show example values only after explicit selection; never imply they describe actual mine equipment.
- Block deletion of a machine type while instances reference it, with a clear resolution action.
- Keep scenarios in browser memory initially; offer JSON import/export in a subsequent task.
- Use an adjustable display range and legend; values outside the range remain numerically available.

## Excluded from this prototype

Time simulation, accounts, offline map downloads, automatic equipment-data retrieval,
terrain diffraction, buildings, barriers, weather forecasting, and compliance certification.
Future environmental effects are tracked in the backlog rather than represented by arbitrary offsets.

## Acceptance criteria

1. A user can add two machine types, place multiple sources, drag them, and remove them.
2. Editing a type updates all its instances; deletion never leaves dangling references.
3. Single-source levels decrease with distance; multiple sources combine logarithmically.
4. Overlay and receptor readout agree within the documented grid approximation.
5. No-source and invalid-input cases have explicit, tested behaviour.
6. Clouds can be recorded; unsupported cloud corrections are never presented as calculated physics.
7. Another site can be modelled without modifying source code.
8. Map failure is visible, attribution is present, and numerical results remain accessible.
9. Example data and model limitations accompany results; no unsupported audible/inaudible verdict.
10. The selected map provider meets the approved zero-cost use and licensing requirements.
