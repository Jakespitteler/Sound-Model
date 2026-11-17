# 019 — Optional equipment metadata in saved records

Status: Implemented; ready for review.
Task creation approved by the owner on 17 November 2026; 020 depends on 019.

## Problem

The owner approved only two optional fields for this POC, so a short reference and operating
condition can accompany a guessed or measured level without building an evidence platform.

## Scope

Extend SavedMachine with optional source_reference (up to 500 characters) and operating_mode (up to 200 characters), both defaulting to empty strings. They are plain text metadata. Preserve the existing estimate/source note, use description, provenance and source power. Existing version-1 documents without the fields remain readable.

## Exclusions

No attachments, document scraping, uncertainty fields, approval workflow, assessment engine
or automatic claim that an entry is measured. No new libraries. This does not improve the
underlying physics or replace actual equipment data.

## Acceptance

- [x] Old saves load without loss and the two optional fields round-trip through Save/Open.
- [x] Overlong metadata is rejected; source references remain plain text and do not fetch files or websites.
- [x] Metadata stays out of acoustic requests and changing it cannot alter power, pressure, contours or data provenance automatically.

## Verification

Add old-save and Unicode round-trip cases, field-length boundaries and a metadata-versus-no-metadata comparison. Run the scenario tests and documented Python checks.

## Likely implementation files

- `src/scenario_files.py`
- `tests/test_scenarios.py`

Keep each slice within roughly five implementation files; split it if necessary rather than
adding unrelated work. Record the resulting commit, checks and limitations in this brief.

## Evidence

`SavedMachine` now defaults both fields to empty strings without changing version 1.
Existing raw-file read/resave coverage proves defaulting does not rewrite files or lose
notes/use/kind/power/provenance. New API cases cover 500/200-character Unicode values,
Save/Open/recovery validation, overlong/null/non-string rejection without replacing a save,
plain markup-like references and equal stripped acoustic payloads/predictions/contours.

All 93 pytest tests, Ruff lint and strict Pyright pass. Three new cases failed before the
schema change. Runtime changes are confined to `scenario_files.py`; no dependency or physics
change. Stacked above the persistent-history-controls fix; task 020 supplies the editor in
its own PR. No UI implementation or independent review is claimed by this contract slice.
