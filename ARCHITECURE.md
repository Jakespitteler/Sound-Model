# Repository architecture and data flow

This is the current technical guide. The filename `ARCHITECURE.md` is retained for existing
links. Start at the [documentation index](docs/README.md) for user-facing explanations.

## System at a glance

```mermaid
flowchart LR
    Browser[Browser: HTML, CSS and JavaScript] -->|Local HTTP| API[FastAPI backend]
    API --> Physics[Scalar receiver model]
    API --> Contours[NumPy and ContourPy geometry]
    API --> Files[Local scenario JSON files]
    Browser -->|Satellite tiles only| Imagery[Esri imagery service]
```

The app uses Python 3.13+, uv, FastAPI, Pydantic and Uvicorn. The frontend uses plain modules
and bundled Leaflet; it has no build step. NumPy and ContourPy speed up evaluation/extraction;
they do not add missing propagation physics. Only imagery needs the external tile service.

## Where to look

| Area | Files | Responsibility |
| --- | --- | --- |
| HTTP and pages | `src/main.py`, `pages.py`, `assets.py` | Routes, server-assembled partials, deterministic asset MIME types |
| Validated inputs | `src/types.py` | Catalogue, source/receiver references, finite values and limits |
| Receiver calculation | `src/acoustics.py`, `scope.py` | Scalar spreading/energy sum, then display scope |
| Contour calculation | `src/contours.py`, `contour_engine.py` | Domain, sparse tiles, line extraction, stitching and per-level outcomes |
| Persistence | `src/scenario_files.py`, `scenario_routes.py` | Versioned schema, safe UUID filenames, atomic saves and listing |
| Frontend entry/state | `src/static/js/bootstrap.js`, `main.js`, `state.js` | Ordered startup, observable state and request orchestration |
| Requests/cache | `src/static/js/api.js` | Debounce, abort/version protection and geometry cache |
| Map/lines | `src/static/js/map-manager.js`, `contour-layer.js`, `local-area.js` | Imagery, markers, tooltip layout, geographic lines and halos |
| Forms/files | `src/static/js/ui-*.js`, `scenario-files.js`, `sidebar.js` | Catalogue, entities, thresholds, tabs and Save/Open |
| Shared appearance | `sound-style.js`, `sound-reference.js`, `sound-guide.js`, `illustrations.js` | Automatic colours, guide/default levels and original icons |
| HTML/styles | `src/templates/`, `src/static/css/` | Assembled partials and styles split by responsibility |
| Third-party assets | `src/static/vendor/leaflet/` | Bundled Leaflet 1.9.4 with provenance/licence |
| Verification | `tests/`, `scripts/benchmark_contours.py` | Numerical/API/persistence tests and repeatable benchmark |
| Agent guidance | `AGENTS.md`, `.agents/`, `scripts/check_agent_skills.py` | Project rules and pinned skill integrity |

## Which changes calculate sound?

```mermaid
flowchart TD
    Source[Source position or machine power changes] --> R[Receiver request lane]
    Source --> G[Contour request lane]
    Receiver[Receiver position changes] --> R
    Levels[Contour thresholds change] --> G
    G --> Cache{All current levels cached?}
    Cache -->|Yes| Lines[Render current lines]
    Cache -->|No| Contours[POST only missing levels]
    Contours --> Merge[Merge cached and fresh levels]
    Merge --> Lines
    R --> Predict[POST /api/predict]
    Predict --> Numbers[Update receiver readings]
    Camera[Pan, zoom or Fit local area] --> Reproject[Leaflet reprojects existing geometry]
    Style[Contrast, visibility or receiver name] --> Local[Update rendering locally]
```

`main.js` currently also refreshes the lanes for catalogue mutations and restores. Cloud
cover is metadata and adds no acoustic correction. Camera movement can load tiles and mark
a saved camera view dirty, but never starts acoustic requests. Changing a receiver leaves
contour geometry alone. Receiver names use a separate `receiver-name` notification: headings,
tooltips and accessible descriptions update in place, with no acoustic request or marker replacement.
Open receiver details and active name selection survive a pending reading response. Stale results are hidden during relevant pending requests; valid cached levels remain visible
while missing ones load.

Each request lane debounces for 150 ms, aborts superseded browser fetches and uses a version
counter to reject stale responses, including the A→B→A cache race. Aborting a fetch does
**not** promise cancellation of work already running on the Python server.

The geometry cache holds at most **32 level entries**, evicting the least recently used.
Each key includes the expected API model (`full-space-point-source-v1`), 0.02 dB numerical
tolerance, threshold and every active source's position/power in original order. Multiplicity
and order matter: sources contribute independently, and the first longitude anchors the
numerical projection. Camera, visual style, receivers, unused catalogue entries, names and
cloud metadata do not change contour geometry. Future model/accuracy contract changes must
update the frontend cache contract as well as the backend; the cache is session-local and
clears on reload, not persisted in saved scenarios.

`main.js` snapshots cached levels for the current source signature, requests only missing
thresholds, then merges responses in current threshold order. Both `ok` and `empty` results
are reusable, even when another level fails. Failures and missing server results are not
cached, so Retry requests those levels again. HTTP failure marks only missing levels failed
and keeps unaffected cached lines. A response with a different model/tolerance clears the
cache and hides the incompatible geometry, with an explicit reload message.

Cached values are detached on store/read to prevent renderer mutations. Every edit goes
through the existing request lane, including all-cache hits: its abort/version guard rejects
late threshold/source responses before rendering **or** caching them. Pending renders contain
only current-signature cached levels; removed or old-source lines disappear immediately.
`equipment-metadata` edits update catalogue forms and map details locally, without either
acoustic lane. `toPayload()` strips notes, source references and operating modes; full save
snapshots retain them. The plain-text editor validates 500/200 Unicode codepoint limits and
escapes content. Version-1 legacy files default missing fields to empty strings.

No equation, extraction tolerance, sampling budget, scope policy or source contribution is
changed by this reuse.

## Calculation pipeline

The [model guide](docs/model.md) explains the equations and missing physics. Both scalar and
batched paths evaluate independent omnidirectional sources using great-circle horizontal
distances. Source distances below 1 m use a numerical limit. Energies combine logarithmically;
no coherent phase cancellation or numerical weather correction is applied.

For each requested contour level:

1. Build a conservative source-centred domain, unwrapping longitude around the first source
   so date-line neighbours stay local. The viewport is not an input.
2. Prune cells wholly above/below the threshold using conservative distance bounds.
3. Evaluate with NumPy in batches of up to 2,048 points against all sources. Refine crossing
   regions to a common depth, targeting 1/20 of the smallest relevant source radius with
   a minimum 0.05 m projected cell target.
4. Extract lines from sparse 8×8 tiles with ContourPy. Join endpoints using exact lattice
   identities, then refine crossings by vectorised bisection.
5. Convert to longitude/latitude and check the nearest-source display scope at vertices and
   segment midpoints. A level outside scope fails as a whole; it is not silently clipped.
6. Return that level's `ok`, `empty` or `failed` result and continue with the other levels.

The 0.02 dB tolerance is a target at line vertices, not uncertainty of environmental predictions.
Straight segments still approximate the field. Numerical guards include 640,000 charged cells
per level, a 200 km total-power domain radius and domains inside ±85° latitude. They do not
validate physical predictions over those distances. Do not omit real machines to force a result.

## Scope and display

`scope.py` hides a receiver's pressure and numeric contribution breakdown when its nearest
source is more than 10 km away, retaining status and nearest distance. A nearer receiver keeps
all contributions and warns if some paths are beyond 10 km. This owner-selected display policy
is neither a physical cutoff nor a validated range.

The optional `acceptable_level_db` defaults to null in version-1 saves and browser state.
It is excluded from direct receiver requests: only its numeric threshold joins the deduplicated
contour-level union. Backend and browser enforce 25 unique levels including this value.
`lineSettings()` emits one setting per unique level and flags a shared ordinary/reference level
as special. Changing/clearing the reference uses the contour lane, including cache-only style
changes for matching levels; it never updates source powers or receiver pressures.

The reference is a heavier dashed line in the automatic level colour, with a distinct label
“Acceptable level — user-set”. Its label remains visible even for a small ring. High contrast
adds a matching dashed halo. The slider stays disabled only until a useful source-based interval is available; it can
set an initially unset criterion by dragging. Range updates do not change the numeric criterion. Per-level error reporting identifies the reference and preserves other
lines. Ordinary-row removal tolerates the notification-before-DOM-update phase. Save snapshots
and draft recovery retain the optional value; neither classification nor legal/audibility
assessment is introduced.

Default contours and the guide share `sound-reference.js`: 30/40/60/80/100 dB(A). Thresholds
sort descending; colour and a solid 2.5 px line weight are automatic. A separate lower pane
provides optional white halos. Contour labels sit below object badges. Contours cannot be dragged.

Machine icons show category and number; hover/focus exposes name and LwA, while selection
opens the evidence note. Tooltip width is intrinsic with a 260 px cap. Measured placement
chooses above/below and shifts sideways to minimise overlap with controls while respecting map
edges. Open tooltips are refitted after a map resize. Panning dismisses transient cards. Receiver badges retain pressure and units: 84×34 px
for numbers, 112×34 px for status text. Both marker types remain anchored at their coordinates.

### Local-area navigation

`local-area.js` computes a camera group independently of acoustic state. Each Fit action
chooses the object geographically nearest the current map centre, with stable ID/collection
ties (a source and a receiver may share an ID). It reads the centre afresh on every click;
selection, focus, placement and edit history do not determine the group. There is no saved
or transient anchor state to restore.

Candidates sort by anchor distance, then ID and collection using JavaScript string ordering.
The greedy group accepts a candidate only when it is within 10,000 m of every existing member
(mean Earth radius 6,371,008.8 m; 1 µm floating-point boundary allowance). It is deterministic,
not a maximum-clique search. This camera rule does not filter acoustic sources or change the
separate receiver display policy. It never fits automatically on edits or arriving predictions.

The button is disabled without objects. `fitBounds` caps zoom at 16 and reserves a rectangle
clear of currently visible overlays: candidate horizontal spans are tested against merged
vertical obstacle intervals and the largest free rectangle is used, with a central fallback
when the controls cover the map. Fit closes a selected popup, changes the camera and marks
that view dirty for Save/recovery; it sends no acoustic request. Grouping is derived for the camera only, not stored as additional saved inputs.

The eight preset types are project-authored guesses. `/machine-estimates` documents their origin.
Fresh scenes and the Greenbushes button use `DEFAULT_VIEW` (−33.8675, 116.07647, zoom 14).
Saved camera views take precedence. The main grid fills the viewport with no branding header. The humorous
guide compares pressure levels and does not supply emissions or approved assessment thresholds.

## Placement history

`ScenarioStore` keeps at most 50 completed add/move/remove commands for sources and receivers.
A command records collection, before/after entity, list index and action label. Move replay
changes only coordinates, retaining later receiver labels and current catalogue power. Removal
captures the current entity so a later redo/undo also retains metadata edited after placement.
Restored entities keep their IDs and original list positions. No-op moves consume no entry.

Replay transfers commands between undo/redo stacks without recording a new action. New
placement edits clear redo. Source commands notify `geometry`; receiver commands notify only
`receivers`, reusing existing cache/request version guards. Save/recovery revision tracking
therefore sees ordinary accepted edits; no named file is written automatically. History is
excluded from both the API payload and recovery/save snapshots. Open/New/recovery and demo
replacement clear it. Deleting an unused catalogue type clears both stacks; deletion of an
in-use type is guarded in the store as well as the UI.

Persistent map buttons expose the next action through their titles. Keyboard handlers ignore
inputs, selects, textareas, editable content, IME composition and open dialogs. Camera, contour,
name and catalogue power edits are outside placement history and keep their existing behaviour.

Ctrl-click source placement passes through the same `addSource` history/calculation path.
After an accepted click, `MapManager` resumes source mode with a UI-only notification if
Control was held and fewer than 100 sources exist. The final ordinary click, cancellation,
undo/redo and the 100th source leave placement inactive. Modifier state is read from the
click event, so releasing Control or changing windows cannot leave a latched repeat flag.
Receiver placement remains single-use.

## Save/Open contract

```mermaid
sequenceDiagram
    actor User
    participant UI as scenario-files.js
    participant API as scenario_routes.py
    participant Disk as scenario_files.py
    User->>UI: Save current scenario
    UI->>API: POST new or PUT selected UUID
    API->>API: Validate version, limits and references
    API->>Disk: Write temporary file, flush and fsync
    Disk->>Disk: Atomically replace destination
    Disk-->>API: Persisted record
    API-->>UI: UUID, name, timestamp and document
    UI->>UI: Update saved URL and saved revision
```

Receivers accept optional `name` metadata (up to 80 characters, empty by default). Duplicate
labels are allowed; receiver IDs still identify results. Existing version-1 files without names
load without being rewritten. Explicitly saving normalises the default field. Naming has no
effect on receiver calculations or contour geometry. The optional editor lives in receiver details;
sidebar headings and hover/focus descriptions use the name, while map badges keep R-numbers.
Accepted edits update locally as the user types; whitespace is trimmed when leaving the field.
Overlong text is rejected explicitly, retaining the previous accepted label.

Version-1 documents include catalogue notes/kinds, sources, receivers, levels, cloud metadata,
view, contrast and visibility. They do not contain imagery or calculated results. Names are
labels; server-generated UUIDs determine filenames. Data lives under ignored
`local-data/scenarios/` unless `SOUND_MODEL_DATA_DIR` overrides it.

Atomic replacement preserves an existing save on a failed write. Unreadable files are counted
without blocking readable saves. Browser revision tracking leaves edits dirty if made during
an in-flight save. Saved URLs restore the last saved version. A separate version-1 localStorage
recovery envelope contains inputs, saved identity, timestamp and a per-tab writer token.
`draft-recovery.js` observes the Save/Open lifecycle, debounces accepted edits for 200 ms,
and flushes on page exit. Restore/Discard is explicit. Restore validates through the non-writing
`POST /api/scenarios/validate` route, checks saved identity, then marks the working scene dirty.
A missing save becomes new unsaved work. Named files are never written by recovery.

Storage events and ownership checks pause competing tabs. A restore captures the exact reviewed
envelope and rejects a changed candidate after async validation. This is a single best-effort
browser draft, not a transactional multi-user system, backup or recovery history. Clearing
browser data, unavailable storage or edits before the debounce/browser disk flush can prevent recovery. Portable
import/export, cloud sync, audit history and named-save conflict protection are not implemented.

## HTTP API

| Method and path | Result |
| --- | --- |
| GET `/`, `/index.html` | Assembled HTML shell and partials |
| GET `/about`, `/machine-estimates` | Current model explanation and preset notes |
| GET `/js/*`, `/css/*`, `/vendor/*` | Files under `src/static/` only |
| GET `/api/health` | Readiness and model ID |
| POST `/api/predict` | Validated `Scenario` → receiver results keyed by ID |
| POST `/api/contours` | `Scenario` plus `levels` → independent per-level results |
| GET `/api/scenarios` | Saved metadata and unreadable-file count |
| POST `/api/scenarios/validate` | Validate a `ScenarioDocument` without file reads/writes |
| POST `/api/scenarios` | Name/document → new record; HTTP 201 |
| GET `/api/scenarios/{UUID}` | Saved record; HTTP 404 if missing |
| PUT `/api/scenarios/{UUID}` | Validated replacement of an existing record |

Invalid input uses HTTP 422 with sanitised error details; raw input/context is omitted.
A valid contour request returns HTTP 200 even if individual levels fail. File failures use
HTTP 500 with a user-readable message. Unknown fields, duplicate IDs, broken type references
and non-finite values are rejected. Limits are 50 types, 100 sources, 20 receivers and
25 unique levels; power/threshold inputs allow 0–300 dB(A). The numeric ceiling is not a
realistic machinery specification. Coordinates use latitude ±85° and longitude ±180°.

Interactive Swagger/ReDoc and OpenAPI routes are disabled. There is no authentication for
this local API. Only `src/static` is mounted; source, templates and private scenario files
are not public static assets. See the [developer guide](docs/development.md) for commands,
verification and startup troubleshooting. Historical audits are indexed in [docs](docs/README.md).

## Practical slider range

`POST /api/contour-range` takes source inputs only. `contour_range.py` uses total sound-power
spreading at the existing 10 km scope distance for a conservative lower candidate, and the
combined field evaluated at source centres for a conservative peak candidate. It rounds
inward to 0.1 dB with a 0.05 dB margin and verifies endpoints through unchanged `build_contours`.
A failed low endpoint is narrowed toward the verified upper endpoint with at most 12 bisections.
No interval is invented when unavailable. This is a useful checked interval, not the maximal
feasible range or a guarantee that every intermediate extraction avoids numerical guards.
Numeric entry retains 0–300, all per-level errors and the existing display policy.

The browser uses a separately versioned request lane and an eight-signature session cache.
Only source-signature changes request a range; panning, threshold edits and metadata changes
do not. Pending/failed ranges disable the slider with a reason, and transient HTTP failures
expose Retry. Ordinary, acceptable and draft sliders share this interval. Source changes
preserve entered numbers even outside new slider bounds. Endpoint probes do not alter equations, saved inputs, geometry tolerances or budgets.

## Contour label priority and explicit entry

The acceptable label has an opaque background in pane `acceptable-labels` (675), above
ordinary contour labels (450), markers (600) and transient tooltips (650), while opened
popups and controls keep their higher interaction layers. Label priority is independent of
threshold ordering, high contrast, zoom and hide/show; labels stay pointer-transparent.

Add contour opens a draft of the existing slider-and-number row, focusing its numeric field.
Draft dragging previews a number without changing state. Enter commits once; Escape or ×
cancels without notifying state. `addContour(requestedLevel)` validates the
exact submitted value and combined level budget, rejecting rather than replacing it. The
no-argument helper retains its previous programmatic fallback; the UI always passes a number.


## Desktop scenario workspace

`sidebar-simple.css` gives the desktop sidebar a responsive 380–480 px width, retaining
more than half the map at the supported desktop sizes. The header stays outside the
scrolling lists. The Scenario panel divides remaining height between machine and receiver
sections; each list scrolls independently beneath its placement controls. Contours has its
own scroll area. At 650 px and below the layout returns to normal document flow.

`EntitiesUI` uses native details/summary rows: machine type and LwA, or receiver name and
LpA/status, remain visible while editors and removal controls are collapsed. Near-source
and distant-source flags remain in the summary; expanded rows retain the full explanation.
Receiver contributions have a separate disclosure so they do not separate names from
coordinates. State and calculation lanes are unchanged.

`sidebar.js` hides existing workspace panels rather than replacing them. Machine data and
Model info share advanced-settings space; opening one closes the other without removing
form nodes or committing drafts. Disclosure, tab selection and list scrolling do not notify
the acoustic store or request predictions.

```mermaid
flowchart TD
    Header[Save / Open and workspace tabs] --> Scenario[Scenario workspace]
    Header --> Contours[Scrollable contour editor]
    Scenario --> Machines[Machine placement controls + scrolling compact rows]
    Scenario --> Receivers[Receiver placement controls + scrolling readings]
    Scenario --> Settings[Machine data or Model info]
    Machines --> Editor[Expand only the object being edited]
    Receivers --> Editor
```
