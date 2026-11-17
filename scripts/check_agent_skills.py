"""Verify the project-local Agent Skills snapshot without extra dependencies."""

import hashlib
import json
import re
from pathlib import Path


def check_snapshot(root: Path) -> list[str]:
    """Check pinned files, skill discovery metadata and shared-reference paths.

    Args:
        root: Project-local .agents directory containing the snapshot and lock file.

    Returns:
        Human-readable failures; an empty list means the snapshot passed.
    """
    lock = json.loads((root / "agent-skills.lock.json").read_text(encoding="utf-8"))
    files: dict[str, str] = lock["files"]
    errors: list[str] = []
    actual = {str(path.relative_to(root)).replace("\\", "/") for path in (root / "skills").rglob("*") if path.is_file()}
    for directory in ("references", "agents", "docs"):
        actual.update(path.relative_to(root).as_posix() for path in (root / directory).rglob("*") if path.is_file())
    actual.add("LICENSE")
    if actual != set(files):
        errors.append(
            f"Snapshot file set differs: missing {sorted(set(files) - actual)}, extra {sorted(actual - set(files))}"
        )
    for relative, expected in files.items():
        path = root / relative
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            errors.append(f"Pinned file missing or modified: {relative}")
    skills = sorted((root / "skills").glob("*/SKILL.md"))
    if len(skills) != lock["skill_count"]:
        errors.append(f"Expected {lock['skill_count']} discoverable skills, found {len(skills)}")
    for skill in skills:
        text = skill.read_text(encoding="utf-8")
        frontmatter = text.split("---", 2)[1] if text.startswith("---\n") else ""
        if not re.search(rf"^name: {re.escape(skill.parent.name)}$", frontmatter, re.MULTILINE):
            errors.append(f"Skill name does not match its directory: {skill.parent.name}")
        if not re.search(r"^description: \S", frontmatter, re.MULTILINE):
            errors.append(f"Missing skill discovery description: {skill.parent.name}")
    for path in (root / "skills").rglob("*.md"):
        # Fenced examples may describe files to create, rather than supplied references.
        text = re.sub(
            r"^```[^\n]*\n.*?^```[^\n]*$", "", path.read_text(encoding="utf-8"), flags=re.MULTILINE | re.DOTALL
        )
        for relative in re.findall(r"(?<![\w./-])((?:\.\./)*references/[\w.-]+\.md)", text):
            if not (path.parent / relative).is_file():
                errors.append(f"Broken reference in {path.relative_to(root)}: {relative}")
    return errors


if __name__ == "__main__":
    try:
        failures = check_snapshot(Path(__file__).resolve().parents[1] / ".agents")
    except (OSError, ValueError, KeyError, TypeError) as error:
        failures = [f"Could not validate Agent Skills: {error}"]
    if failures:
        raise SystemExit("\n".join(failures))
    print("Agent Skills verified: pinned files, 25 discoverable skills and shared references.")
