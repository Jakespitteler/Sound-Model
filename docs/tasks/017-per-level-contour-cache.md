# 017 — Reuse unchanged contour levels without changing accuracy

Status: Ready to plan implementation.
Task creation approved by the owner on 17 November 2026. Theme/dependencies: 006.

## Problem

The current cache stores a complete response keyed by the full level list. Editing one threshold therefore misses that cache even when other levels are unchanged.

## Scope

Cache successful/empty geometry per level and complete source/power/model signature, with at most 32 cached level entries. Request only missing levels, merge them into the current response and preserve independent errors, retry and request-version protection. Record before/after request counts and timings.

## Exclusions

No change to equations, all-source energy contributions, extraction, vertex tolerance, cell budgets, scope checks or line simplification. Do not cache failed levels or introduce a new cache service.

## Acceptance

- [ ] Editing one level reuses the unaffected levels; a moved/changed source invalidates affected geometry and an explicit retry recalculates failed levels.
- [ ] Rendered coordinates for reused levels match their original successful response exactly; fresh calculations retain the existing 0.02 dB vertex target and scope behaviour.
- [ ] A→B→A edits, pending source changes and mixed success/failure never display stale lines; cache size remains bounded and panning adds no acoustic calls.

## Verification

Capture requests and geometry for a fixed fictional scene before/after threshold and source edits. Compare cached coordinate arrays exactly and use the existing analytical contour tests for the engine. Report timings as observations; count avoided calculations rather than claiming universal speedups.

## Likely implementation files

- `src/static/js/api.js`
- `src/static/js/main.js`
- `docs/tasks/017-per-level-contour-cache.md`

Use the existing stack. If the slice grows beyond roughly five implementation files, split
it before editing. Record completed checks and the commit here; do not mark it done from
intent alone. New dependencies and external data require separate owner approval.
