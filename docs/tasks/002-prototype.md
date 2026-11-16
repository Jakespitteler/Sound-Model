# 002 — Map and scenario prototype

State: review. Owner: Codex. Branch: agent/002-sound-prototype. Depends on 001.
The owner approved Python/FastAPI/Uvicorn, HTML/CSS/JavaScript, Leaflet and interim OSM tiles.
GitHub API access returned Forbidden; no PR has been opened. Human review and merge remain required.

## Implementation

- `app/acoustics.py`, `app/main.py`: baseline acoustic model, validation, grid and receiver API.
- `app/static/`: catalogue, draggable sources/receivers, numeric coordinate editing, map overlay,
  legend, cloud metadata, empty/error states, and visible model/data limitations.
- `run.py`, `launch.py`, `Start Sound Model.bat`: local server and project-local Windows setup.
- `tests/`: numerical and real HTTP checks; `scripts/package.py`: distributable source ZIP.

The branch contains the complete indicative prototype. Initial commits separate foundation,
backend and frontend work. Vendored Leaflet accounts for most of the initial frontend diff;
CSS formatting was subsequently expanded for maintainability. There is no PR stack yet.

## Acceptance evidence

| Criterion | Implementation | Evidence |
| --- | --- | --- |
| Create/edit/delete types and sources | app/static/app.js | Browser flow passed; references block unsafe type deletion |
| Moving sources changes combined level | app/static/app.js, app/acoustics.py | Pointer drag and coordinate edit passed; energetic sum tests |
| Distances and combination are correct for baseline | app/acoustics.py | Analytical expectations in tests/test_model.py |
| Overlay and receptors share model | app/main.py | Grid-centre equality test; numerical readings in browser |
| Empty and invalid inputs handled | app/main.py, app/static/app.js | Empty-source tests, non-finite HTTP regression, backend failure UI |
| Cloud coverage has no invented correction | app/main.py, app/static/app.js | Unit test and browser control check |
| Other locations work | app/static/app.js | Navigation and coordinate editing; dateline distance test |
| Attribution and map failures visible | app/static/app.js | Inspected screenshots and failure state; live tiles blocked |
| Assumptions/example provenance visible | app/static/index.html, app/static/app.js | Inspected desktop and narrow layouts |
| Free map use | docs/maps.md | Official OSM policy read; satellite remains deferred |

## Review and limits

Independent agent reviewed b9e08b1 and identified three issues. Fixes require Python 3.11+,
return safe HTTP 422 validation errors, and replace abandoned-stack documentation.
See docs/validation.md for check outcomes, packaging evidence and unverified Windows/live-map
behaviour. Do not mark done until the owner approves merge. No compliance claim is made.

Follow-up review: independent reviewer checked 8e21648d93a33b05ff3dc512aca45f7cf68a0b56,
reran all 15 tests and confirmed all findings resolved, with no remaining code-review blockers.
The owner explicitly requested publishing this work to a branch in Sound-Model on 2026-11-16.
