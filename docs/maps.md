# Map provider evaluation

## Requirements

Zero payment for the intended mine-related use, satellite imagery where available, visible
attribution, draggable sources, and support for locations outside Greenbushes. Distinguish
an open-source map renderer from permission to use a hosted imagery service.

## Proposed first step

Leaflet is an open-source renderer. OpenStreetMap standard tiles provide street mapping,
not satellite imagery. They are a proposed prototype fallback only, pending approval and
verification of the current tile usage policy. Do not bulk download or promise offline access.

Free high-resolution satellite imagery suitable for mine-scale analysis is unresolved.
Do not assume that a publicly reachable Esri, Google, Apple, or Landgate endpoint is licensed
for this use, or that a provider's free tier permits commercial use without an account.
Investigate Western Australian public imagery and global alternatives before selecting one.

## Verification status, 2026-11-16

Attempts to read Leaflet, OSM tile-policy, Landgate imagery, and ArcGIS metadata through the
current network proxy returned HTTP 403 tunnel errors. This establishes a network access
limitation, not the providers' current pricing, licensing, or service availability.
No map service has been connected and no free satellite licence has been verified.

References to check when accessible:

- https://leafletjs.com/
- https://operations.osmfoundation.org/policies/tiles/
- https://www.landgate.wa.gov.au/location-data-and-services/imagery/

Only request network additions for the provider actually selected, preserving existing rules.
Save terms references, attribution, allowed usage, resolution, coverage, costs, and verification
date before approval. An imagery outage must not silently invalidate calculated receptor values.
