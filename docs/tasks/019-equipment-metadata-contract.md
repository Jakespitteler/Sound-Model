# 019 — Optional equipment metadata in saved records

Status: Ready to plan implementation.
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

- [ ] Old saves load without loss and the two optional fields round-trip through Save/Open.
- [ ] Overlong metadata is rejected; source references remain plain text and do not fetch files or websites.
- [ ] Metadata stays out of acoustic requests and changing it cannot alter power, pressure, contours or data provenance automatically.

## Verification

Add old-save and Unicode round-trip cases, field-length boundaries and a metadata-versus-no-metadata comparison. Run the scenario tests and documented Python checks.

## Likely implementation files

- `src/scenario_files.py`
- `tests/test_scenarios.py`

Keep each slice within roughly five implementation files; split it if necessary rather than
adding unrelated work. Record the resulting commit, checks and limitations in this brief.
