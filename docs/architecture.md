# Architecture

Approved final stack: Python with FastAPI and Uvicorn; plain HTML, CSS and JavaScript;
Leaflet 1.9.4 for map interaction. The owner approved these technologies on 2026-11-16.
Node.js, TypeScript, Vite, Vitest, standalone HTML-only delivery and compiled-backend proposals
are superseded. Ask before selecting any additional third-party technology.

## Components

- `app/main.py`: FastAPI endpoints, validated request schemas, static frontend serving.
- `app/acoustics.py`: pure distance, spreading, energetic summation and receiver calculations.
- `app/static/app.js`: browser scenario state, catalogue editing, markers and map overlay.
- `app/static/index.html` and `style.css`: frontend structure and presentation.
- `app/static/vendor/leaflet`: bundled approved map library, licence and verified provenance.
- `run.py`: loopback-only Uvicorn launcher, optional automatic browser opening.
- `launch.py` and `Start Sound Model.bat`: project-local dependency setup and Windows launch.

## Data and APIs

The browser keeps types, source instances, receivers and cloud-cover metadata in memory.
Each type has an ID, name, LwA and provenance (`example` or `measured`). Sources reference a
type ID and coordinates. Receivers have coordinates. Removing referenced types is blocked.
There are no accounts, persistent scenarios or database. Reloading loses the current scenario.

`GET /api/health` reports readiness. `POST /api/predict` accepts the scenario plus optional map
bounds. It returns receiver contributions and a 48 × 48 Mercator-aligned grid of combined levels.
Input limits are 50 types, 100 sources and 20 receivers, with finite coordinates and levels.
Only static frontend files are exposed; repository files are not served. The local API is
stateless and makes no remote requests. Map tiles go directly from the browser to OSM.

## Rendering and provider boundary

Provider URL, attribution and zoom limits are centralised in `app.js`. Google/Apple may need
separate SDK adapters and additional approval. Source calculations do not depend on the map
provider. A tile outage is explicit and does not prevent coordinate input or receiver queries.
Map display supports latitudes from -85 to 85 degrees. Imagery near the dateline is clipped
to world bounds; distances themselves use the shorter great-circle separation.

Stale requests are aborted and obsolete results ignored. Grid overlays are removed while
updating or when requests fail. Receiver values are calculated directly, while the overlay
is sampled and visually interpolated; near sources, zoom in and use numerical receivers.

## Tradeoffs

Python fits the owner's existing installation. A project-local virtual environment isolates
Python dependencies. The simple frontend avoids a JavaScript build system. Grid calculations
run on the local backend, keeping browser presentation separate from the acoustic model.
For larger scenarios, measure latency before adding workers, caches, databases or dependencies.
