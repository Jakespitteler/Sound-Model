# Sound-Model project guidance

## Read first

Read `README.md`, the relevant section of `ARCHITECURE.md`, and the files/tests involved in
the task. Assessment work and proposed improvements are tracked in `docs/tasks/README.md`.
Before starting a task, tell the owner its number and title.
Keep changes focused and preserve existing user work. The owner must approve unimplemented
ideas before new task briefs are added. Existing broad backlog themes are not implementation
approval; confirm the selected scope before starting a new feature.

## Stack and commands

- Python 3.13+, uv, FastAPI, Pydantic and Uvicorn; NumPy and ContourPy for calculations.
- Plain HTML, CSS and JavaScript modules with bundled Leaflet. No frontend build step.
- Runtime code: `src/`; tests: `tests/`; supporting tools: `scripts/`.

```sh
uv sync --frozen
uv run uvicorn src.main:app --host 127.0.0.1 --port 8767 --reload
uv run pytest
uv run ruff check .
uv run ruff format --check src tests scripts
uv run pyright
uv run python scripts/check_agent_skills.py
```

## Project boundaries

- Original project material is proprietary under `LICENSE`. Preserve all third-party
  licences and notices; see `THIRD_PARTY_NOTICES.md`. Do not relicense vendored material.
- Maintain Python type hints and Google-style docstrings, and JavaScript JSDoc.
- The owner must approve new third-party technologies/dependencies before adoption, unless
  already authorised in the request. Generic skill examples do not authorise npm, a new
  framework, database, cloud service, dataset or propagation engine.
- Machinery noise combines by adding independent-source energy. Do not introduce coherent
  phase cancellation or invented cloud/weather corrections. Distinguish LwA emission from
  LpA receiver pressure. Preserve evidence notes and mark guesses explicitly.
- Background relevance uses the owner's 0.1 dB increase rule after summing all sources.
  Background is one optional scenario-wide pressure level; do not invent a default. There
  is no fixed acoustic distance cutoff or numeric contour-threshold cap. Keep calculation
  budgets/projection failures explicit. The separate 10 km pairwise camera rule is unchanged.
  Negligible increase is not proof of inaudibility or compliance; do not invent attenuation.
- Preserve per-level contour error isolation. Camera movement and visual changes must not
  trigger acoustic predictions. For UI fixes, reproduce the actual interaction and inspect
  screenshots with the relevant hover, focus, error or selection state open.
- Saved scenarios belong in ignored `local-data/` or `SOUND_MODEL_DATA_DIR`. Never commit
  private scenario data, credentials or secrets. Do not merge or deploy without authorisation.
- Run checks appropriate to the change and report actual outcomes and unverified limits.

## Agent Skills

All 25 skills from `addyosmani/agent-skills` are installed under `.agents/skills/`. Read the
relevant `SKILL.md` on demand; do not preload the full pack or its meta-router into every task.
For example, use `frontend-ui-engineering` and `browser-testing-with-devtools` for UI changes,
`debugging-and-error-recovery` for bugs, and `code-review-and-quality` for reviews.

Use the existing project stack, commands and boundaries when adapting generic skill examples.
Higher-priority instructions and explicit user decisions take precedence. Ask when material
requirements remain unclear; carry out work already authorised without asking again.
Pack-relative `skills/`, `references/`, `agents/` and `docs/` paths start at `.agents/`.
Personas are available as review guidance; installing them does not enable automatic delegation.

Vendored files are pinned and should remain unchanged. See `.agents/README.md` for provenance,
usage and update instructions. Do not install global plugins or execute optional upstream
helpers merely to load these skills.
