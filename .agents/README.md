# Agent Skills for Sound-Model

Project-local installation of [Addy Osmani's Agent Skills](https://github.com/addyosmani/agent-skills).
All **25 skills**, their bundled support files, **7 shared references** and **4 review personas**
are checked in, with the original relative layout. The personas are reference material here;
this installation does not register host-specific subagents, slash commands or hooks.

## Provenance

- Source revision: [`39b723ceebf81474d0557c1fecd01eddab585563`](https://github.com/addyosmani/agent-skills/tree/39b723ceebf81474d0557c1fecd01eddab585563)
- Upstream version: **0.6.16**; integrated 17 November 2026.
- Upstream files are copied unchanged. Their SHA-256 digests are recorded in
  [agent-skills.lock.json](agent-skills.lock.json).
- [LICENSE](LICENSE) is upstream's MIT licence for these vendored files, including its copyright
  notice. It does not change the application project's licensing.

## Use

Start a new Codex session in this checkout after pulling the change so it can discover
`.agents/skills/<name>/SKILL.md`. Ask it to use a skill by name, for example:

- "Use frontend-ui-engineering and browser-testing-with-devtools to fix this map layout."
- "Use debugging-and-error-recovery to investigate this failure."
- "Use code-review-and-quality to review this branch."

Codex loads relevant skills on demand. Root [AGENTS.md](../AGENTS.md) supplies the project context;
the meta-skill is installed but is not preloaded. Other agents can read the same Markdown or
use their own project-local discovery mechanism. No global plugin configuration is changed.
`/spec`, `/build` and other Claude plugin commands are not installed by this copy.

| Path | Contents |
| --- | --- |
| `skills/` | 25 discoverable skills, plus each skill's own references/helpers |
| `references/` | Shared definition of done, testing, security, performance and other checklists |
| `agents/` | Optional specialist review personas |
| `docs/agents.md` | Upstream explanation of the personas and orchestration |

Upstream pack-relative paths begin at `.agents/`, not the application root. For example,
`../../references/definition-of-done.md` in a skill resolves to `.agents/references/`.
Tools and generic JavaScript/React examples are guidance; use Sound-Model's approved stack
and checks. Nothing here requires Node.js or a package install to discover/read the skills.
Some optional upstream helpers require Bash or Node.js; leave them unused unless needed
and approved. Application dependencies, runtime behaviour and physics are unaffected.

## Verify and update

Run from the project root:

```sh
uv run python scripts/check_agent_skills.py
```

The checker verifies the pinned files, discovery metadata and shared-reference paths using
only Python's standard library. LF attributes preserve the pinned hashes on Windows.

For an update, clone the upstream repository into a temporary directory, select and record
an exact commit, and review its diff and licence. Replace only the files owned by the manifest
with that revision's `skills/`, `references/`, `agents/`, `docs/agents.md` and `LICENSE`.
Remove obsolete manifest-owned files, preserve local integration files and project rules,
then regenerate the manifest's revision, version, count and SHA-256 hashes from that checkout.
Run the checker, inspect relative links, review the change and commit it together.
Updates are explicit; there is no network fetch or auto-update on application startup.
