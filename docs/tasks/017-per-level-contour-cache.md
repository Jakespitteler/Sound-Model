# 017 — Reuse unchanged contour levels without changing accuracy

Status: Implemented; ready for review.
Task creation approved by the owner on 17 November 2026. Theme/dependencies: 006.

## Problem

The current cache stores a complete response keyed by the full level list. Editing one threshold therefore misses that cache even when other levels are unchanged.

## Scope

Cache successful/empty geometry per level and complete source/power/model signature, with at most 32 cached level entries. Request only missing levels, merge them into the current response and preserve independent errors, retry and request-version protection. Record before/after request counts and timings.

## Exclusions

No change to equations, all-source energy contributions, extraction, vertex tolerance, cell budgets, scope checks or line simplification. Do not cache failed levels or introduce a new cache service.

## Acceptance

- [x] Editing one level reuses the unaffected levels; a moved/changed source invalidates affected geometry and an explicit retry recalculates failed levels.
- [x] Rendered coordinates for reused levels match their original successful response exactly; fresh calculations retain the existing 0.02 dB vertex target and scope behaviour.
- [x] A→B→A edits, pending source changes and mixed success/failure never display stale lines; cache size remains bounded and panning adds no acoustic calls.

## Verification

Capture requests and geometry for a fixed fictional scene before/after threshold and source edits. Compare cached coordinate arrays exactly and use the existing analytical contour tests for the engine. Report timings as observations; count avoided calculations rather than claiming universal speedups.

## Likely implementation files

- `src/static/js/api.js`
- `src/static/js/main.js`
- `docs/tasks/017-per-level-contour-cache.md`

Use the existing stack. If the slice grows beyond roughly five implementation files, split
it before editing. Record completed checks and the commit here; do not mark it done from
intent alone. New dependencies and external data require separate owner approval.

## Implementation and evidence

Implementation commit: `e216973`; retry-feedback fix: `c6f0d87` on `agent/per-level-contour-cache`. Only `api.js` and
`main.js` change runtime behaviour; no engine, equation, dependency or saved-schema change.

The 32-entry LRU stores individual `ok`/`empty` results under the expected model ID, numerical
tolerance, threshold and every active source position/power, preserving source order and
multiplicity. Reads/writes are detached so rendering cannot mutate cached coordinates.
Requests contain only missing levels; results merge in current threshold order. Failed levels
are never cached. Partial and HTTP failures retain unaffected current-source lines. Retry
recalculates missing/failed levels. Every edit, including a full cache hit, versions the lane
before render/cache writes. A mismatched response model/tolerance clears incompatible geometry
and asks for a reload; future API contract changes must update frontend and backend together.

Observed before/after on 17 November 2026, using the same fictional two-source scene with
80/60/40 dB(A) contours and changing 60 to 65:

| Case | Contour HTTP requests | Levels calculated | Edit-to-render observation |
| --- | --- | --- | --- |
| Previous complete-response cache | 1 | 3 | 0.2577 s |
| Per-level cache | 1 | 1 | 0.2296 s |
| Return to the already-cached 60 dB(A) threshold | 0 | 0 | Not timed |

This fixture avoided two level calculations, not an HTTP round trip. These single-run timings
include the unchanged 150 ms debounce and browser overhead; they are not a general speedup claim.
Unchanged rendered level objects matched their original response exactly. After moving a source,
all current levels were requested and every rendered coordinate matched a separate fresh
full API calculation exactly. The Python engine and its 0.02 dB vertex target remain unchanged.

Verification:

- **90 pytest tests** pass, including existing analytic/contour accuracy and scope checks.
  Ruff lint/format, strict Pyright, pinned-skills integrity, offline lockfile and diff checks pass.
- The committed dependency-free browser page `tests/browser/contour-cache.html` passes
  **16 checks**: exact reuse, empty/failure policy, positions/powers/all-source/order signatures,
  model/tolerance separation, irrelevant metadata, clone isolation, 32-entry LRU eviction,
  A→B→cached-A and pending source changes with deliberately abort-ignoring fake responses.
  The first reuse check failed against the old implementation before runtime code was changed.
- Actual Chromium UI/API checks cover one-level edits, all-cache hits, isolated level failure,
  HTTP 503 with unaffected lines, retry, mixed success/failure in one response, model mismatch,
  source movement and late A→B→A responses. A retry after mixed results requested only the
  failed 40 dB(A) level. Panning added no acoustic requests; no JavaScript page errors occurred.
- Inspected screenshots with the failed-level reason and successful contours visible at
  1440 px, plus a 390 px layout. Imagery was unavailable; the functioning plain-background
  state was checked. No native Windows, Firefox/Edge or screen-reader verification is claimed.

Session artifacts under `/workspace/artifacts/`: `check_contour_cache.py`,
`cache-before.json`, `cache-after.json`, `cache-partial-failure-desktop.png` and
`cache-contours-mobile.png`. The developer guide explains the plain-browser regression page;
it runs separately from `pytest` and requires no additional app/test dependency.
The full browser workflow and repository checks passed again after merging current `main`
(including task 015). A reproduced stale “Retrying…” message now clears when the contour
result completes. No independent review or environmental-model validation is claimed.

Next queued implementation task: 018, placement undo/redo. Task 027 separately records the
owner-requested sidebar rework; neither is implemented here.
