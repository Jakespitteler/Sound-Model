# Map provider evaluation

## Current prototype

Leaflet 1.9.4 is bundled locally (BSD-2-Clause). Its npm registry archive SHA-512 was verified
before extracting the runtime and stylesheet; see its PROVENANCE.md and LICENSE.
The owner approved OpenStreetMap standard street tiles as a temporary fallback on 2026-11-16.
This is a free, best-effort service with usage conditions, not a guaranteed hosted map product.

The official policy was read from the OSM Operations Working Group's source repository:
https://raw.githubusercontent.com/openstreetmap/owg-website/master/policies/tiles.md
Published policy: https://operations.osmfoundation.org/policies/tiles/
Verified 2026-11-16. It permits ordinary interactive viewing subject to attribution, identification,
caching and request limits; availability may be withdrawn. It explicitly prohibits offline tile
archives, bulk downloads and automated headless panning to force tile rendering.

The app uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, visible OSM attribution, normal
browser User-Agent and Referer behaviour, and normal HTTP caching. It does not proxy, prefetch
whole regions, suppress referrers, or offer offline map downloads. For automated UI checks,
block external tile requests and test the explicit unavailable-map state.

## Network validation

Cloud requests to the policy website and live tile domain were blocked by the environment
network policy; official policy text was accessible on GitHub. Browser checks verified the
failure message and continued coordinate/model operation, not successful live tile rendering.
Cloud tile access requires `tile.openstreetmap.org` in environment network settings. A saved
network draft does not prove runtime access. The user's Windows network is separate.

## Satellite requirement, still open

Satellite imagery remains a requested future layer. No free high-resolution imagery service
has yet been licensed or integrated for this mine-related use. Public reachability alone does
not establish usage permission. Investigate WA imagery and global alternatives, checking
commercial use, coverage, resolution, attribution, credentials and cost before proposing one.
Ask the owner before choosing another external provider or SDK.

The renderer's provider definition is centralised in `app/static/app.js`; calculations are
independent of that provider. Apple or Google can require different adapters and approvals.
