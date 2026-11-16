# Shared project rules

These rules apply to every coding agent. The repository is shared memory; another agent cannot see this chat.

## Start here

Read in order: AGENTS.md, docs/intake.md, docs/spec.md, docs/architecture.md, docs/decisions.md,
docs/development.md, then the current task and its dependencies. Read docs/no-admin.md for restricted laptops.
If the project is not yet defined, follow prompts/start-project.md. Do not choose a stack or write application
code before discovery and approval. Do not mistake an unanswered question for approval.

## Decisions and explanation

- The human owns product decisions. Ask about material gaps instead of guessing; batch related questions.
- Before implementation, explain the files to change, evidence, alternatives, tradeoffs and verification.
- New dependencies, data-model changes, public interfaces and external services need explicit human approval.
  Existing recorded approval remains valid; do not ask again unless the proposal materially changes.
- Record approved choices, date, approver and rationale in docs/decisions.md. Never claim approval by inference.
- If code conflicts with the specification, identify the conflict and ask before choosing a different behaviour.
- Diagnose causes before proposing workarounds. Explain limitations and obtain approval for compromises.

## Work sequence

1. Select the next todo task from docs/tasks/README.md unless the human directs otherwise.
2. Inspect repository status and open PRs; preserve other people's work. Claim the task by setting in-progress,
   owner and branch, then commit the claim before application changes. Use an agent/task-id-short-name branch.
   If a host imposes a branch name, record it. Never commit on the default branch.
3. Send the concrete plan and resolve outstanding product/API/data/dependency approvals before building.
4. Stay in scope. Record unrelated findings briefly in task notes. Use separate worktrees for concurrent work.
5. Keep PRs around 400 handwritten changed lines. Split larger tasks into coherent, tested stacked PRs and
   record the stack. Stack dependent work on its dependency; keep independent work based on the default branch.
   Explain which branch runs the complete app. Intermediate branches must be clearly labelled if incomplete.
6. Run the root check command in docs/development.md, resolve failures, inspect the diff and review every
   acceptance criterion. For UI changes, inspect screenshots at the approved viewport sizes and attach them
   to the PR, not git. Give file and test evidence for each criterion in the PR description.
7. Set review and open the PR. Have an agent that did not author the change review it before human review.
   A failed or incomplete review is not approval. The human performs final review and merges.
8. Only after the human says they are happy to merge, make a final commit setting done. Never merge yourself.
