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

### Local-area algorithm regression page

The grouping/overlay tests use plain JavaScript and the installed browser, with no test
framework or additional dependency. From the repository root, run a temporary loopback server:

```sh
python -m http.server 8790 --bind 127.0.0.1
```

Open <http://127.0.0.1:8790/tests/browser/local-area.html>. It must report **PASS: 17 checks**;
failures also appear in the browser console. Stop the temporary server after checking.
These checks cover the inclusive boundary, chain prevention, deterministic ties, preserved
inputs and overlay space. They complement `pytest`; they do not run as part of it.
For the actual app, additionally check marker/sidebar selection, last placement, empty/single
scenes, two distant areas and zero `/api/predict` or `/api/contours` calls on fitting.

## Making changes

Read the selected task and relevant modules first. Keep type hints, Google-style Python
docstrings and JavaScript JSDoc. Preserve source notes, stable IDs and saved data. Do not
modify the pinned upstream files under `.agents/`; use its integration guide for updates.

The owner reviews new unimplemented ideas before they become tasks. A task proposal does
not approve a new library, dataset, propagation model or regulatory threshold. Record the
commit, verification results and remaining limits when handing work to another agent.

Original project material is proprietary; retain the [third-party notices](../THIRD_PARTY_NOTICES.md).
