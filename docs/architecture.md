# Architecture proposal

Status: proposed; implementation approval pending.

Use a browser-only TypeScript application built by Vite, with Leaflet for map interaction
and Vitest for numerical and state tests. No server, account service, or API credentials are
required for the proposed street-map prototype. This keeps hosting and data handling simple.
A backend can be considered later if shared scenarios or private datasets are required.

## Boundaries

- `src/model/`: pure calculations, units, coordinates, input validation, and assumptions.
- `src/scenario/`: machine types, source instances, receptors, and cloud-cover metadata.
- `src/map/`: Leaflet adapter, provider configuration, source dragging, and overlay rendering.
- `src/ui/`: catalogue, scenario controls, receptor results, legend, and explanatory text.

These are proposed paths; application files have not been created.

Separate the calculation model from map rendering. A provider descriptor contains the tile
URL, attribution, zoom limits, and terms reference. Do not scatter provider URLs through UI
code. Google or Apple may require separate adapters, credentials, licences, and cost approval;
provider independence does not promise those SDKs are interchangeable tile URLs.

A machine type has a stable ID, name, LwA, and provenance. A source references a type ID and
geographic position. A receptor has a position. Cloud cover is scenario metadata. Version the
scenario format before export is implemented. No machine data is transmitted to a backend.
External tile providers receive tile requests that reveal the viewed area.

## Alternatives and tradeoffs

Plain JavaScript reduces build tooling but loses compile-time checks for scenario data.
React adds a UI dependency that is not necessary for the first small editor.
MapLibre is a plausible later choice for vector maps or richer rendering; Leaflet suits the
initial draggable markers and raster overlay. Large source counts may require a worker and
adaptive grid; measure performance before adding those mechanisms.
