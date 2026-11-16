# Repository architecture and data flow

This is the architecture document requested as `ARCHITECURE.md`. The application remains
Python 3.13+, uv, FastAPI, Pydantic and Uvicorn, with plain HTML/CSS/JavaScript and bundled
Leaflet. No application dependencies were added for contours or frontend modularisation.

## Structure

```text
Sound-Model/
├── pyproject.toml                 dependency groups, lint and strict type configuration
├── uv.lock                        reproducible dependency versions (unchanged)
├── src/
│   ├── main.py                    HTTP routes, validation errors, static serving
│   ├── types.py                   typed request/domain/response models
│   ├── acoustics.py               existing great-circle distance and energetic addition
│   ├── contours.py                adaptive level-line calculation and stitching
│   ├── assets.py                  deterministic JS/CSS media types across platforms
│   ├── pages.py                   HTML shell + partial assembly (standard library)
│   ├── templates/
│   │   ├── index.html             page layout, assets and model explanation
│   │   └── partials/              header, catalogue, sources, contours, receivers, map
│   └── static/
│       ├── js/
│       │   ├── bootstrap.js       ordered Leaflet/module loading and visible startup errors
│       │   ├── main.js            event orchestration, receiver/geometry request lanes
│       │   ├── state.js           scenario mutations and explicit change reasons
│       │   ├── api.js             JSON requests, cancellation and geometry cache
│       │   ├── map-manager.js     existing imagery provider, entity markers, placement
│       │   ├── contour-layer.js   geographic polylines and threshold dragging
│       │   ├── ui-catalogue.js    machine type forms and cloud metadata
│       │   ├── ui-entities.js     source/receiver cards and coordinate forms
│       │   ├── ui-contours.js     threshold/style/count controls and legend
│       │   ├── types.js           shared JSDoc domain definitions
│       │   └── utils.js           DOM lookup, escaping, IDs and formatting
│       ├── css/                   tokens, base, layout, sidebar, map, contours, responsive
│       └── vendor/leaflet/        existing library, licence and provenance
├── tests/
│   ├── test_model.py              unchanged acoustic expectations and validation
│   ├── test_contours.py           analytical radii, topology and contour API checks
│   └── test_http.py               HTML/assets, prediction and sanitised validation errors
└── docs/contour-task.md            task scope, decisions and verification record
```

## Request and rendering flow

```mermaid
flowchart TD
    Browser[Existing browser] -->|GET /| Page[pages.py: assemble HTML partials]
    Page --> Modules[Native JavaScript modules + local CSS]
    Modules --> State[state.js: in-memory scenario]
    State -->|source / type / threshold edit| GeometryLane[api.js: geometry request lane]
    GeometryLane --> Cache{Successful source + level geometry cached?}
    Cache -->|yes| Lines[contour-layer.js: render with current styles]
    Cache -->|no: POST /api/contours| API[main.py + types.py: validation]
    API --> Adaptive[contours.py: source-centred adaptive marching squares]
    Adaptive -->|connected longitude / latitude lines| Lines
    State -->|source / type / receiver edit| ReceiverLane[api.js: separate receiver lane]
    ReceiverLane -->|POST /api/predict| Physics[acoustics.py: direct receiver levels]
    Physics --> Readings[ui-entities.js: readings and source breakdown]
    State -->|colour / width / dash / visibility| Lines
    Camera[Map pan / zoom] --> Leaflet[Leaflet reprojects existing geographic lines]
    Leaflet -->|ordinary imagery requests only| Tiles[Existing Esri satellite service]
```

Source changes update lines and receiver values. Receiver changes only update readings.
Colour, width, line style, per-level visibility and the global display toggle are local.
Cloud cover remains recorded metadata without an invented correction. No camera bounds are
sent to either endpoint, and no camera handler starts predictions. New satellite tiles may
still load when browsing another area: that is separate from acoustic computation.

Each request lane snapshots its payload, debounces edits, aborts previous fetches and rejects
out-of-date responses by version. Returning to cached geometry also invalidates an in-flight
request, preventing the A→B→A race found in the reference attempt. Source/threshold updates
hide old contours until current results are available. Failures clear stale geometry, report
the server message and offer Retry. Receiver failures do not destroy valid contours.
The geometry cache is session-local and limited to 12 results; reload discards the scenario.

## Combined noise and contour calculation

The physics remain the `walk-back` independent point-source model:

```text
Lp_i = LwA_i − 20 log10(max(1 m, distance_i)) − 10 log10(4π)
Lp_total = 10 log10(Σ 10^(Lp_i / 10))
```

A contour is a line where **the combined level** equals the selected threshold. Nearby sources
therefore produce merged outer contours and separate inner lobes; they are not separate circles
drawn without regard to other machines. This is energetic combination, not coherent phase
cancellation. The directional lobes in the example image also depend on physical conditions
not modelled here; this change does not introduce wind, barriers or source directivity.

For each threshold:

1. Compute a conservative domain from all source powers and positions, without consulting the
   viewport. Unwrap longitudes around the first source to keep a dateline-neighbouring pair local.
2. Use a quadtree to reject cells definitely wholly above or below the threshold. The spherical
   triangle inequality bounds distances from a cell centre; Mercator half-diagonals safely
   overestimate surface separation. This also discovers small rings that a coarse grid misses.
3. Refine potential crossings to one common depth based on the smallest relevant single-source
   radius. Marching Squares extracts edge segments; actual centre values resolve saddle cells.
4. Bisect crossing edges to a target **0.02 dB vertex error**, then stitch by exact grid-edge
   identity. No decimal-coordinate rounding is needed to guess which segments join.
5. Return connected polylines, including explicit closed rings, in longitude/latitude order.
   Leaflet reprojects those geographic lines during navigation without requesting more geometry.

The vertex tolerance is numerical, **not an environmental prediction accuracy claim**. Straight
segments between vertices approximate the continuous field. Cells target at most 1/20 of the
smallest relevant source radius (minimum target 0.05 m). Fields that exceed the safe 160,000-cell
budget **per threshold** return an explicit 422 error instead of truncating results. Levels whose
combined-power propagation radius exceeds 200 km, or whose domain reaches ±85° latitude, also
return an explanation. Increase the threshold or narrow the scenario to reduce complexity.
A level above the possible maximum, no sources, or no levels produces empty geometry, not an error.
Up to 100 sources, 50 machine types, 20 receivers and 25 unique levels are supported by validation;
complex combinations can hit numerical safety limits before those counts.

## Editing and dragging

```mermaid
sequenceDiagram
    actor User
    participant Map as contour-layer.js
    participant UI as main.js / state.js
    participant API as /api/predict
    participant Contours as /api/contours
    User->>Map: Drag a line or its labelled handle
    Map->>UI: Contour ID and drop coordinates
    UI->>API: Current sources + one temporary receiver at the drop
    API-->>UI: Combined level at that location
    UI->>UI: Round to 0.1 dB, validate unique threshold
    UI->>Contours: New thresholds with current sources
    Contours-->>Map: Recomputed geographic level lines
```

Dragging chooses a **decibel threshold**, not an arbitrary hand-drawn shape. The level's colour,
width, style and ID survive. Source edits or another drag invalidate a pending drop response.
Near-field drops (within 1 m), duplicate thresholds and out-of-range values are rejected clearly.
Desktop users can drag the line itself; its labelled draggable marker also supports touch.
Numeric controls provide the keyboard alternative. Contours cannot be used to delete or move
machine sources accidentally; source/receiver markers retain their separate interactions.

## HTTP boundaries

| Endpoint | Request | Response / responsibility |
| --- | --- | --- |
| GET `/` or `/index.html` | none | Assembled HTML; partials aren't fetched asynchronously |
| GET `/js/*`, `/css/*`, `/vendor/*` | static path | Local frontend assets only |
| GET `/api/health` | none | Server readiness and model ID |
| POST `/api/predict` | `Scenario` | Receiver results keyed by ID, provenance and cloud metadata |
| POST `/api/contours` | `ContourRequest` (`Scenario` plus `levels`) | Connected geographic lines per threshold, tolerance and model ID |

The previous `bounds`/heatmap `grid` API is removed; both endpoints reject unknown fields.
Styles never enter acoustic input. Pydantic rejects duplicate IDs, broken source references,
non-finite numbers and invalid ranges. Validation errors omit raw input/context so NaN/Infinity
never cause error-response serialisation failures. Only `src/static` is mounted for assets;
Python source, templates, lockfiles and repository metadata are not served as static files.

## Development and limits

```sh
uv sync --frozen
uv run uvicorn src.main:app --host 127.0.0.1 --port 8767
uv run pytest
uv run ruff check .
uv run ruff format --check src tests
uv run pyright
```

Keep Python annotations and Google-style `Args`, `Returns` and `Raises` docstrings on changed
public helpers; browser modules use JSDoc parameter/return annotations and shared domain typedefs.
No JavaScript bundler, UI framework, contour package or extra Python dependency is required.

The reference ZIP informed the module split, but the coherent-wave mode was excluded as the
owner requested. The adaptive contour algorithm replaces its coarse source-domain grid and
rounded-coordinate stitching. Style changes and receiver requests have separate invalidation.

Model limitations remain: no ground reflection, terrain, diffraction, atmospheric absorption,
refraction or validated cloud effect. This prototype does not establish machinery inaudibility
or compliance. Existing provider attribution and satellite URLs are preserved; no new provider
has been selected. Browser regression checks block external imagery, testing geometry and
interaction independently of remote service/network availability.

## Physics and browser startup audit

See [the audit](docs/physics-audit.md) for equations, physical limits, contour regression
checks and the reported VS Code blank-map investigation. Bootstrap failures are visible;
script/style media types do not depend on Windows registry settings.
