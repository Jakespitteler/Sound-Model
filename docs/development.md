# Development workflow

## Prerequisites

Python **3.11+**. No Node.js or global pip packages. FastAPI and Uvicorn are the approved
backend technologies; requirements.txt pins the resolved Python dependency versions.
Leaflet is bundled with its BSD licence and archive verification record.

Use `/workspace/Sound-Model` in this cloud workspace. Cloud tasks are already isolated:
use the existing checkout and do not create a worktree unless explicitly requested.
Preserve existing work; follow AGENTS.md for task branches and human merge approval.
Current implementation branch: `agent/002-sound-prototype`.

## Install and run

Windows users can double-click `Start Sound Model.bat`; launch.py creates a local virtual
environment, installs pinned requirements and opens the browser when the backend responds.
It requires internet for the first install. Keep its terminal open while using the app.
Alternatively, from the project directory:

```bat
py -3 launch.py
```

On Linux/macOS or in the cloud:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install --cache-dir .venv/pip-cache -r requirements.txt
.venv/bin/python run.py --no-browser
```

The backend binds to `127.0.0.1:8765`. Use `--port 8766` if needed. `--no-browser` avoids
opening a browser on headless machines. The Windows batch launcher has been inspected;
native Windows execution is not available in this cloud environment.

## Root check command

```sh
.venv/bin/python -m unittest discover -s tests -v
```

Windows equivalent:

```bat
.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Tests cover independent acoustic expectations, validation and real HTTP requests against a
temporary Uvicorn process. Also run `.venv/bin/python -m pip check` and `git diff --check`.
No frontend build or code-generation step is required.

Browser validation uses the cloud's existing Chromium/automation tooling, not an additional
project dependency. Check adding/editing/removing types and instances, marker dragging,
receiver readings, cloud metadata, tile errors, backend failure and narrow-screen layout.
Block external tile requests in automated tests: OSM forbids headless tile harvesting.
Use ordinary interactive map viewing for any actual map-service verification.

## Packaging

`python3 scripts/package.py` creates `/workspace/artifacts/Sound-Model-Windows.zip` in this
workspace (or use `--output PATH` elsewhere). The ZIP includes application source, bundled
Leaflet, documentation, tests and launchers, but not .venv, credentials, Git metadata or caches.
The source package still requires the user's existing Python 3.11+ and first-install internet.

Installation and startup instructions can be saved to the environment draft. Saving does not
publish or apply network rules. Do not publish without the owner's instruction.
