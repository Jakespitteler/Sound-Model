# Developer guide

[Documentation index](README.md) · [Project rules](../AGENTS.md) · [Architecture](../ARCHITECURE.md)

## Local environment

The project uses Python 3.13+, uv and a browser. HTML/CSS/JavaScript are served directly;
there is no Node.js requirement or frontend build. Install the locked environment and start:

```sh
uv sync --frozen
uv run uvicorn src.main:app --host 127.0.0.1 --port 8767 --reload
```

Open <http://127.0.0.1:8767>. Health is at <http://127.0.0.1:8767/api/health>.
Keep the server bound to loopback for local use. The local scenario API has no authentication;
do not treat it as a deployment-ready shared service.

To select a data folder in Windows PowerShell before starting the server:

```powershell
$env:SOUND_MODEL_DATA_DIR = "C:\SoundModelData\scenarios"
uv run uvicorn src.main:app --host 127.0.0.1 --port 8767
```

On a POSIX shell:

```sh
SOUND_MODEL_DATA_DIR=/path/to/scenarios uv run uvicorn src.main:app --host 127.0.0.1 --port 8767
```

Use an existing writable folder/location. Files saved there are private project data, not
application source. Keep them out of commits and back them up separately.

## Checks

| Command | Purpose |
| --- | --- |
| `uv run pytest` | Numerical, API, assets, scope and persistence checks |
| `uv run ruff check .` | Python lint |
| `uv run ruff format --check src tests scripts` | Python formatting |
| `uv run pyright` | Strict typing for configured application/test paths |
| `uv run python scripts/check_agent_skills.py` | Pinned skill files, discovery metadata and reference integrity |
| `uv run python scripts/benchmark_contours.py` | Repeatable contour benchmark; timings depend on the machine |

Choose focused checks during work and run the applicable full checks before reporting completion.
The benchmark is a diagnostic, not a fixed performance promise. Historical test counts and
timings in dated records are not guarantees about the current checkout.

## Browser verification

For a UI change, test the actual interaction and capture the state that exposed the problem:
hover cards open, keyboard focus, selected popup, pending result, error or failed save.
An idle screenshot cannot establish that a hover layout is correct.

Use existing available browser tools. Adding a project dependency or service needs owner
approval. Inspect screenshots at desktop width and a narrow width. Count acoustic requests
when checking that panning, styling and tab changes do not recalculate sound. If imagery is
blocked for repeatable tests, say so; it does not verify live satellite availability or the
user's native Windows/VS Code environment.

### Contour cache regression page

The cache and request-lane checks run in an ordinary browser with no additional dependency.
From the repository root, start a temporary loopback server:

```sh
python -m http.server 8796 --bind 127.0.0.1
```

Open <http://127.0.0.1:8796/tests/browser/contour-cache.html> and wait for **PASS: 16 checks**.
Stop the temporary server afterwards. These checks run separately from `pytest`; they cover
exact reuse, source/model/tolerance signatures, failed/empty levels, the 32-entry LRU bound,
consumer isolation and request-version races. The race fixtures deliberately ignore abort
signals to verify that version checks protect against late responses on their own.

For app integration, also inspect a partial failure with successful lines still visible;
record requested thresholds, compare rendered coordinates with a fresh API response, and
check retries, source edits and panning. Model/accuracy mismatch must not combine incompatible
cached/fresh results. Keep environment-only browser instrumentation out of production code.

### Local-area algorithm regression page

The grouping/overlay tests use plain JavaScript and the installed browser, with no test
framework or additional dependency. From the repository root, run a temporary loopback server:

```sh
python -m http.server 8790 --bind 127.0.0.1
```

Open <http://127.0.0.1:8790/tests/browser/local-area.html>. It must report **PASS: 22 checks**;
failures also appear in the browser console. Stop the temporary server after checking.
These checks cover the inclusive boundary, chain prevention, deterministic ties, preserved
inputs and overlay space. They complement `pytest`; they do not run as part of it.
For the actual app, additionally check that the current camera overrides distant edits or
placements, empty/single scenes, two distant areas and zero `/api/predict` or `/api/contours` calls on fitting.

### Placement history regression page

Using Python's temporary loopback HTTP server from the repository root, open
`/tests/browser/placement-history.html` and expect **PASS: 23 checks**. It uses plain browser
modules, no additional test dependency. Checks cover exact identities/coordinates, list order,
metadata, correct notification lane, no-op moves, branching redo, type-reference safety,
50-action bounds and scenario replacement. It runs separately from `pytest`.
For real UI verification also exercise a drag, typed coordinates, buttons/keyboard shortcuts,
native text undo, pending calculations and Save/Open/New/recovery. Inspect keyboard focus
and disabled toolbar controls in desktop and narrow screenshots.

### Acceptable-level regression page

Serve the repository on a temporary loopback HTTP server and open
`tests/browser/acceptable-level.html`. Expect **PASS: 24 checks** for unset/zero/boundaries,
invalid values, shared/full/split budget cases, intact rejected edits, saved snapshots,
legacy restore, IDs/notes and unchanged receiver payloads. It requires no test dependency
and runs separately from `pytest`. In the app also check matching threshold reuse, slider/Clear,
Save/Open/recovery, a failed reference beside successful lines, hidden/high-contrast rendering,
and removing an ordinary row to free a budget slot. Inspect desktop and narrow screenshots.

### Contour interaction regressions

The plain-browser pages `tests/browser/acceptable-label-priority.html` and
`tests/browser/explicit-contour.html` check foreground paint order (10 cases) and exact typed
thresholds/budget rejection (13 cases). Serve the repository on loopback with Python, open
those pages and expect PASS. They use bundled Leaflet/native modules without a new dependency.
The label fixture deliberately overlaps a machine marker and ordinary/reference labels.

For the scenario slider, backend tests verify analytic bounds and actual endpoint/midpoint
contours. UI checks must use a real mouse drag from unset and existing criteria, source power
changes without criterion clamping, source-only range caching, unavailable/retry states,
and desktop/narrow screenshots. Five range checks were added to the Python suite (110 total).
For Add contour, verify focus before typing, no data change until Enter/Add, duplicates/zero,
Escape/Cancel, and an actual API request containing only the chosen new threshold.

## Making changes

Read the selected task and relevant modules first. Keep type hints, Google-style Python
docstrings and JavaScript JSDoc. Preserve source notes, stable IDs and saved data. Do not
modify the pinned upstream files under `.agents/`; use its integration guide for updates.

The owner reviews new unimplemented ideas before they become tasks. A task proposal does
not approve a new library, dataset, propagation model or regulatory threshold. Record the
commit, verification results and remaining limits when handing work to another agent.

Original project material is proprietary; retain the [third-party notices](../THIRD_PARTY_NOTICES.md).


## Compact sidebar checks

Serve the repository root with `python -m http.server 8796 --bind 127.0.0.1`, then open
<http://127.0.0.1:8796/tests/browser/sidebar-entities.html>. Expect **PASS: 15 checks**
covering compact results, literal names, drafts, disclosures, warnings and keyboard tabs.
This fixture does not replace full-app checks. Task 027 records desktop workflow counts,
Save/Open/recovery checks, presentation-only request counts and inspected screenshots.


## Address search checks

`uv run pytest tests/test_geocoding.py -q` runs 20 offline provider/API checks. No test needs
an API key or live service. Serve the repository root as above, then open
`/tests/browser/address-search.html`; expect **PASS: 19 checks** for query debouncing,
selection, stale responses, literal labels, bounds validation and dismissal.

For full-app checks, intercept `/api/geocode` with controlled suggestions/failures, choose
results using keyboard and mouse, and inspect saved camera values. Count prediction,
contour and range calls during search: all must remain unchanged. Task 028 records the
actual browser integration and live-service checks. Never use private site addresses
or machinery/receiver data for provider probes.


## Map deletion checks

With the repository-root static server running, open `/tests/browser/map-deletion.html`.
Expect **PASS: 21 checks**. It exercises actual Leaflet/store bindings, popup and Ctrl
actions, stale controls, history, keyboard activation, held-key resets and edge layout.
Also rerun repeat-placement (14 checks) and placement-history (23 checks) after changes
to map interactions. Task 029 records full-app request counts, Save/recovery and screenshots.

Playwright normally emulates an always-focused page. To check real tab-switch resets,
disable Chromium focus emulation through the existing CDP session before changing tabs;
otherwise a background tab may still report itself visible/focused during automation.
