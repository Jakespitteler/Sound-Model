# 014 — Show and edit optional receiver names

Status: Blocked until 013 is complete.
Task creation approved by the owner on 17 November 2026. Theme/dependencies: 013.

## Problem

Let the owner identify a listening location as Town boundary or House 1 without crowding the map.

## Scope

Add an optional name field in the existing receiver details. Use the name in the sidebar and accessible/hover details, preserving the compact R-number and numeric map badge. Clearing the name restores the existing Receiver N wording. Preserve names through Save/Open and recovery.

## Exclusions

No permanent large map labels, renamed machine types or new naming dialog. Avoid introducing a new input framework. Keyboard text editing must remain natural.

## Acceptance

- [ ] A named and an unnamed receiver can coexist, and clearing a name restores the fallback without changing IDs or positions.
- [ ] A name survives Save/Open and, if recovery is present, recovery; long names wrap without obscuring the numeric badge or controls.
- [ ] Name-only edits do not send contour requests or alter predicted sound; focus/hover and narrow-screen layouts remain readable.

## Verification

Exercise add/edit/clear, duplicate labels, long Unicode text, Save/Open and keyboard operation. Count acoustic requests on a label-only edit. Inspect screenshots with the details editor and tooltip open at desktop and narrow widths.

## Likely implementation files

- `src/static/js/state.js`
- `src/static/js/ui-entities.js`
- `src/static/js/map-manager.js`
- `src/static/js/types.js`
- `src/static/js/main.js`

Use the existing stack. If the slice grows beyond roughly five implementation files, split
it before editing. Record completed checks and the commit here; do not mark it done from
intent alone. New dependencies and external data require separate owner approval.
