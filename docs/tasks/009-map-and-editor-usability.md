# 009 — Improve map reliability and scenario editing

> **Existing theme brief.** See the [backlog](README.md) for current status and approvals.
> Select a small remaining scope with the owner before treating this as an agent task.

Status: theme — baseline partly implemented; remaining scope needs owner selection. Priority: P2. Owner: unassigned.
Dependencies: owner approval for new providers/services.

## Work

Startup diagnostics and offline/slow-imagery notices are implemented. Potential follow-ups
include imagery retry and a licensed, owner-approved fallback provider. Preserve attribution and document imagery date, resolution and coordinate precision. Do not treat satellite imagery as a survey.

Improve source/receptor naming, search, numeric editing, keyboard/touch controls, undo/redo, autosave, scenario duplication, accessible contour palettes and explicit model/data-status summaries. Consider receiver-table export and site boundary/terrain import after format/data decisions.

## Acceptance evidence

Test embedded and external browsers, blocked/slow imagery, narrow screens and keyboard editing. Map failures do not block numeric results. Saves/undo preserve source IDs and provenance; no unapproved provider or dependency is introduced.
