# Development workflow

## Current state

Repository: `/workspace/Sound-Model`. The supplied environment has Python 3 and Git.
There is no application, dependency manifest, lockfile, server, or test suite yet.
This setup adds project documents only. No acoustic or browser behaviour has been validated.

Cloud tasks already run in isolated environments. Use the existing checkout; do not create
a worktree unless the owner explicitly requests one. Preserve pre-existing work.
The environment currently uses the branch `work`; inspect the current branch before commits.
Use a task branch for future implementation and never commit on the default branch.

## Foundation check

Run from `/workspace/Sound-Model`:

```sh
git diff --check
git status --short
```

Additionally verify relative documentation links and compare recovered starter files to the
provided attachment. These checks establish document integrity only, not application readiness.

## Proposed application commands

After dependency approval and creation of package scripts, use a pinned lockfile and `npm ci`.
The intended root check command is `npm run check`, aggregating type checking, unit tests,
and production build. It does not exist yet and must not be reported as passed.
The proposed dev command is `npm run dev -- --host 0.0.0.0`. Confirm startup through a real
page request and browser interaction, not only a listening port.

Test source arithmetic, distance boundaries, input validation, shared catalogue updates,
source removal, and empty scenes. Inspect the rendered overlay and drag behaviour in a browser.
Record exact commands, outcomes, and untested limitations in the task and PR.

## Environment persistence

The previous environment was published. Do not republish or reapply prior setup changes.
Once a working application exists, save tested installation/startup instructions if authorised
by the active environment task. File creation alone does not publish an environment.
