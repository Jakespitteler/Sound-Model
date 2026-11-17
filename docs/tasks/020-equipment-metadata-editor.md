# 020 — Edit source reference and operating mode

Status: Implemented; ready for review after 019.
Task creation approved by the owner on 17 November 2026; 020 depends on 019.

## Problem

The owner approved only two optional fields for this POC, so a short reference and operating
condition can accompany a guessed or measured level without building an evidence platform.

## Scope

Add the two optional plain-text fields to the collapsed equipment editor, with clear labels and short examples such as Manufacturer sheet section 4 and Loaded / travelling. Preserve them through catalogue edits, Save/Open and recovery. Keep the existing note available; do not show permanent new map labels.

## Exclusions

No attachments, document scraping, uncertainty fields, approval workflow, assessment engine
or automatic claim that an entry is measured. No new libraries. This does not improve the
underlying physics or replace actual equipment data.

## Acceptance

- [x] A user can enter, edit and clear both fields without losing the original note, source power or type identity.
- [x] Values survive Save/Open and, if recovery exists, recovery; old unlabelled records still show a usable editor.
- [x] Blank or populated metadata has identical acoustic payloads/results; references are rendered as text, not trusted HTML or auto-fetched URLs.

## Verification

Exercise blank/new/existing records, long text, markup-like input and Save/Open. Compare the actual prediction/contour payloads before/after editing metadata. Inspect a screenshot with the equipment editor open.

## Likely implementation files

- `src/static/js/ui-catalogue.js`
- `src/templates/partials/catalogue-section.html`
- `src/static/js/state.js`
- `src/static/js/types.js`

Keep each slice within roughly five implementation files; split it if necessary rather than
adding unrelated work. Record the resulting commit, checks and limitations in this brief.

## Evidence

Four JavaScript modules change: collapsed equipment forms, state notification, orchestration
and shared JSDoc types. New optional fields use examples and Unicode-aware 500/200 limits.
Metadata-only saves update local catalogue/map details and recovery without sound requests;
name, power and provenance changes still use the existing acoustic path. Full snapshots retain
the fields while `toPayload()` excludes them. Notes/use/kind and type identity remain intact.

All 93 Python tests and documented lint/format/type/skills/lockfile checks pass. The plain-browser
`tests/browser/equipment-metadata.html` checks six state/payload behaviours. Real Chromium
checks covered blank legacy/preset and newly added custom types, edit/clear, astral Unicode at
the limit, overlong input rejection, literal markup, unchanged note/power, zero metadata-only
sound requests, identical actual prediction payloads, Save/Open and populated draft recovery.
Named backend files remained unchanged during recovery. No reference URLs were fetched and
no JavaScript page errors occurred.

Desktop and narrow screenshots with the editor open were inspected, and persistent Undo/Redo
stayed fixed while the sidebar scrolled. Session artifacts: `/workspace/artifacts/check_equipment_metadata.py`,
`equipment-metadata-desktop.png` and `equipment-metadata-mobile.png`. Imagery was unavailable;
native Windows, other browsers and screen readers were not tested. No new dependency, physics
change or independent review is claimed. This PR stacks above task 019's contract, itself above
the persistent-history-controls fix and task 018. Human review and merge remain required.
