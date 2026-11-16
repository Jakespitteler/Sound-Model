# Validation evidence — 2026-11-16

## Passed

- `.venv/bin/python -m unittest discover -s tests -v`: **15 tests passed**, including nine
  numerical/validation tests and six real HTTP tests against a temporary Uvicorn server.
- `.venv/bin/python -m pip check`: no broken dependencies.
- Browser interactions in the cloud's existing Chromium: examples, source placement,
  catalogue creation/editing, deletion guards, coordinate editing, actual pointer dragging,
  receiver recalculation, removal/empty scenes, arbitrary site navigation, cloud metadata,
  safe rendering of names, and explicit backend-failure behaviour. No page exceptions.
- Desktop (1440 × 1000) and narrow (390 × 844) screenshots captured and inspected.
  Narrow layout has no horizontal document overflow. Screenshots are artifacts, not Git files.
- A clean extracted ZIP created its own Python environment, installed the pinned dependencies,
  started the app and answered a representative prediction with 48.0861899 dB(A).
- Restarting the package reused its environment without another dependency installation.
- All pinned package artifacts downloaded for Windows x64 / CPython 3.11. This establishes
  wheel availability, not native Windows runtime compatibility.
- Leaflet archive SHA-512 matched registry integrity before extraction.

## Independent review

A separate agent reviewed b9e08b15e21c32efd58402355fe636e6b2231f6a, including ce08f92.
It found an incorrect Python minimum, non-finite-input HTTP 500s, and stale stack documentation.
These have been corrected: require Python 3.11+, sanitize validation responses and cover them
with HTTP regression tests, and document the actual FastAPI/plain-JavaScript architecture.
A follow-up review of the fixes is recorded in the task when complete. Human review is still required.

## Limits and unrun checks

- No native Windows machine is available here. The `.bat` launcher was inspected, and the
  underlying Python bootstrap was exercised on Linux. Python 3.11+ is required on Windows.
- Live OSM tiles were blocked by the cloud network policy. Browser checks establish correct
  failure handling and interaction/calculation behaviour, not successful imagery rendering.
  Subsequent automated runs explicitly block tiles to respect OSM's anti-harvesting policy.
- Satellite imagery is not implemented. Free licensing and provider approval remain open.
- Acoustic tests validate arithmetic against documented assumptions, not actual mine noise.
  Cloud cover has no numerical correction; measured machine data has not been supplied.
- Scenarios are in-memory and are lost on reload; save/export is deferred.
- GitHub API access returned Forbidden, preventing PR inspection/creation. Work is local on
  `agent/002-sound-prototype`. No PR has been opened or merged.
- Cloud install/start instructions and a `tile.openstreetmap.org` rule were saved to the draft;
  they have not been published or shown to change runtime networking.
