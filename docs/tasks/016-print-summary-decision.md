# 016 — Decide whether a printable summary belongs in the POC

Status: Ready for an owner decision; no implementation authorised.
Task creation approved by the owner on 17 November 2026. Theme/dependencies: 007 (parked wider theme).

## Problem

The owner tentatively likes a printable screening summary but wants an explicit chance to remove it as scope creep.

## Scope

Present one small text/wireframe example and ask the owner to keep or remove it. A kept POC summary would contain scenario name, input powers/positions and estimate notes, receiver results, failed levels, model identifier and plain limitations. Record the decision in this file.

## Exclusions

Do not implement printing, install PDF/report libraries, produce regulatory pass/fail claims or create the implementation task until the owner decides. A formal reviewed assessment report remains outside the POC.

## Acceptance

- [ ] The owner records Keep or Remove with a short reason; no decision is inferred from silence.
- [ ] If Keep, agree the minimal contents and browser print approach before drafting a small implementation task.
- [ ] If Remove, mark the idea deferred and leave the application unchanged.

## Verification

Owner review is the evidence. Confirm that only this decision record changed and that no report/dependency was added. A mock-up must use fictional inputs and show screening limitations prominently.

## Likely implementation files

- `docs/tasks/016-print-summary-decision.md`

Use the existing stack. If the slice grows beyond roughly five implementation files, split
it before editing. Record completed checks and the commit here; do not mark it done from
intent alone. New dependencies and external data require separate owner approval.
