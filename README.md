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

## Contour editing

- Choose **Try example** or enter machine types and place sources on the map.
- Contours show the **combined energetic noise** from all machines, not phase cancellation.
- Add/remove levels (up to 25), set each dB(A) threshold, colour, width, style and visibility.
- Drag a line or its labelled handle to set its threshold from the combined level at the
  drop point. Shape is recalculated from the model, not stretched by hand.
- Drag machines to update the combined contours. Receiver-only edits update readings without
  rebuilding the contours. Styling/visibility changes do not contact the backend.
- Sessions are in memory and are lost on reload. Cloud cover is recorded without a correction.

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
