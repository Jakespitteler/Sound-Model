# Contour editor task

State: review. Owner: Codex. Branch: agent/contour-lines.
Base: walk-back at 33202ad8f37614c7055a43f137fa93789f03db27.

The owner requested combined independent-machine noise contours, editable level count,
decibels, colour, width, style and visibility, including dragging a contour to set its
threshold. Shapes remain computed from combined source energy. No coherent wave model.
Panning/zooming must not trigger acoustic requests. Preserve uv, type hints and Google-style
docstrings. Split frontend responsibilities and document structure/flow in ARCHITECURE.md.
No new third-party libraries. Keep the existing satellite provider.

Plan: typed source-centred contour calculation with analytical/numerical tests; modular
browser state/API/map/UI code; independently refreshed receiver readings and local styling;
architecture diagrams and uv commands; browser request-count/drag/error tests; verify merge
with latest main, then push this branch for human review. Inspect Gemini's ZIP for useful
ideas without accepting its unrequested coherent model, missed contours or stale UI state.

GitHub PR inspection attempted: API returned Forbidden. Git fetch/push are available.

## Implementation and validation

- Combined contour geometry is independent of camera bounds, with adaptive sampling,
  conservative pruning and exact grid-edge stitching. No coherent phase mode was added.
- Editable count (0–25), thresholds, colour, width, solid/dashed/dotted style, visibility,
  and actual line/label dragging are implemented. Receiver requests use a separate lane.
- Split JavaScript, CSS and server-assembled HTML partials; documented modules, physics,
  HTTP contracts, invalidation and drag flow with diagrams in ARCHITECURE.md.
- Preserved uv.lock and all existing dependencies, Python typing and Google-style docstrings;
  frontend helpers carry JSDoc annotations. Removed only the obsolete root main.py entry
  from Pyright's include list; strict type checking remains enabled.

Checks passed:

- `uv sync --frozen` using the existing uv lockfile.
- `uv run pytest`: **53 passed** (contour geometry, analytical radii, combined-source topology,
  date-line neighbours, input/domain limits, direct receiver predictions and HTTP/static routes).
- `uv run ruff check .`, `uv run ruff format --check src tests`, `uv run pyright` and
  `git diff --check`: passed; Pyright reports zero errors/warnings.
- Existing cloud Chromium browser: no JS exceptions; source/receiver/catalogue edits,
  contour styling/count/threshold edits, duplicate rejection, removal, empty states,
  direct SVG-line drag and labelled-handle drag, calculation failure/retry all passed.
- Request counting confirms no acoustic requests for camera movement, visibility or styling,
  and no contour requests for receiver-only edits. A cached A→B→A sequence rejects the
  stale B response. Identical-input retry after an error succeeds.
- Desktop 1440×1000 and narrow 390×844 screenshots captured and inspected; no horizontal
  document overflow. Imagery requests were blocked during automated checks, preserving the
  existing provider without depending on external tiles. Live imagery wasn't revalidated.
- A representative 20-source/four-level calculation completed in approximately 2.15 seconds
  on this cloud instance; this is an observation, not a performance guarantee.
- `git merge-tree --write-tree origin/main HEAD` passed with no conflicts; main remains
  an ancestor of this branch. No merge into main was performed.

Screenshots are artifacts outside Git. GitHub GraphQL/API access still returns Forbidden,
so PR creation is unavailable here. Publish the implementation branch through Git push and
provide a main-targeting comparison link. The source branch is based on walk-back, as requested.
Numerical safety limits and unchanged model limitations are documented in ARCHITECURE.md.

## Follow-up: physics and blank-map audit

See physics-audit.md. Reproduced missing-randomUUID and wrong-JavaScript-MIME startup
failures matching the reported symptoms; deterministic asset MIME types, a secure-context-free
ID helper and visible ordered bootstrap now address them. Physics helpers are shared, the
exact-maximum contour boundary bug is fixed, and 56 numerical/HTTP tests pass.

## Follow-up: due diligence, numeric limits and approved optimisation

Owner requested a 300 dB ceiling, an explanation of complexity errors and an assessment/app
improvement backlog. Machine power and contour thresholds now allow 0–300; geographic
longitude bounds remain ±180. Added nine prioritised tasks in tasks/README.md.

The owner explicitly approved NumPy and ContourPy on 2026-11-16. The compiled batched/tiled
engine produced a 6.83× median benchmark speed-up with matching reference geometry counts;
vertex errors and closure are checked independently. A measured mixed-power case justified
raising the bounded budget from 160,000 to 640,000 cells without coarsening the accuracy target.
62 tests and browser flows pass. See library-options.md for evidence and remaining work.
