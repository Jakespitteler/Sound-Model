# 020 — Edit source reference and operating mode

Status: Blocked until 019 is complete.
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

- [ ] A user can enter, edit and clear both fields without losing the original note, source power or type identity.
- [ ] Values survive Save/Open and, if recovery exists, recovery; old unlabelled records still show a usable editor.
- [ ] Blank or populated metadata has identical acoustic payloads/results; references are rendered as text, not trusted HTML or auto-fetched URLs.

## Verification

Exercise blank/new/existing records, long text, markup-like input and Save/Open. Compare the actual prediction/contour payloads before/after editing metadata. Inspect a screenshot with the equipment editor open.

## Likely implementation files

- `src/static/js/ui-catalogue.js`
- `src/templates/partials/catalogue-section.html`
- `src/static/js/state.js`
- `src/static/js/types.js`

Keep each slice within roughly five implementation files; split it if necessary rather than
adding unrelated work. Record the resulting commit, checks and limitations in this brief.
