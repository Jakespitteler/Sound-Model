# Sound-Model

A Python/FastAPI and plain JavaScript noise-scenario explorer with editable, combined-source
contour lines over the existing satellite map.

## Quick start

You need Python 3.13 and uv. Run from the project folder:

```sh
uv sync --frozen
uv run uvicorn src.main:app --host 127.0.0.1 --port 8767 --reload
```

Open <http://127.0.0.1:8767>. `--reload` restarts the server after code changes; panning or
zooming the map does not reload acoustic predictions. Imagery still needs internet access.

## Build a scenario

1. In **Scenario**, pick a starter machine under **Machines**, then place it on the map.
2. Add a receiver to see its coloured predicted dB(A) reading on the map and in the sidebar.
3. Open **Contours** to slide or type levels. They sort from highest to lowest; colours and a consistent
   line weight are automatic. Add/remove levels as needed. Contours cannot be dragged.
4. Drag machine/receiver markers to move them. Panning/zooming never recalculates the model.
5. Use **Greenbushes mine** for a wider area overview, or expand **Go to coordinates** for another site.

The eight starter types are **project-authored guesses**, not measured company fleet data.
In **Scenario**, expand **Machine data** to edit equipment and its assumption note.
Coordinates, source contributions and model settings are collapsed until needed.
The in-app **Estimate notes** page explains their origin and the blocked public-source research.
No claim is made that a particular model is owned or operated by Charles Hull or Talison.

The top-right **How loud is that?** guide contains light-hearted Australian/South West
pressure-level comparisons. These are illustrative, not sound powers or compliance criteria.
The same level palette colours contours, receiver numbers and the guide. Green is not a
compliance verdict. The guide collapses on narrow screens.

**Sessions are still in memory and are lost on reload.** Cloud cover is metadata without a
correction. [Task 010](docs/tasks/010-scenario-autosave.md) prioritises autosave/recovery;
[task 011](docs/tasks/011-simple-workflow.md) records the next simplicity/usability improvements.

This is an indicative free-field model; it cannot establish mine-noise inaudibility or compliance.
Numerical limits, API contracts and diagrams are in [ARCHITECURE.md](ARCHITECURE.md).

## Checks

```sh
uv run pytest
uv run ruff check .
uv run ruff format --check src tests
uv run pyright
```

The owner approved NumPy and ContourPy for compiled contour calculations. Run `uv sync --frozen`
after updating this branch to install the locked dependencies.

## Blank map / VS Code preview

Open the local address in an external Edge, Chrome or Firefox browser if the VS Code preview
has trouble loading it. Startup failures now show a message instead of a perpetual loading
indicator. Restart the backend after updating this branch and refresh the browser page.
If only imagery fails, check access to `server.arcgisonline.com`; calculations remain local.

See [the physics and startup audit](docs/physics-audit.md) for what was checked and the limits
of the model. Correct free-field arithmetic does not establish actual machinery inaudibility.

## Assessment roadmap and performance

The [due-diligence backlog](docs/tasks/README.md) prioritises assessment criteria, measured
source/background data, validated propagation, uncertainty, reporting and operating controls.
[Library options](docs/library-options.md) distinguish calculation speed from physical validity.
Machine sound power and contour thresholds accept 0–300 dB(A); the upper numeric bound is
not a realistic machinery default. The separate 200 km numerical domain guard still applies.

To benchmark the compiled contour implementation:

```sh
uv run python scripts/benchmark_contours.py
```
