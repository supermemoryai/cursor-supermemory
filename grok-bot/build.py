"""Assembles setup-prompt.md from profile.json and skills/."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent


def front(text):
    match = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    meta, body = match.group(1), match.group(2).strip()
    fields, key = {}, None
    for line in meta.splitlines():
        if re.match(r"^\w[\w-]*:", line):
            key, value = line.split(":", 1)
            fields[key] = value.strip().lstrip(">-").strip()
        elif key:
            fields[key] = (fields[key] + " " + line.strip()).strip()
    return fields, body


def load():
    base = json.loads((ROOT / "profile.json").read_text())
    skills = []
    for path in sorted((ROOT / "skills").glob("*/SKILL.md")):
        text = path.read_text()
        fields, _ = front(text)
        skills.append({"name": fields["name"], "description": fields["description"], "content": text})
    return base, skills


def numbered(steps):
    return [f"{number}. {step}" for number, step in enumerate(steps, 1)]


def payload(base, skills):
    parts = []
    for skill in skills:
        parts += [f"## Skill: {skill['name']}", "~~~", skill["content"].strip(), "~~~", ""]
    parts += ["## Memory notes", "~~~"] + [note["content"] for note in base["memory"]] + ["~~~"]
    return parts


def setup_message(base, skills):
    steps = [
        "Save each skill below as a skill on this Bot (overwrite any with the same name), with that name and the full content between the ~~~ fences, exactly as written.",
        "Save each memory note below with update_state (memory write, scope agent, tier profile), one note per line, exactly as written.",
        "Run nothing else while saving.",
        "Once everything is saved, start Connect Supermemory in the same message.",
    ]
    parts = [
        "You are being set up as the Supermemory Bot. This setup comes from the person who owns this account.",
        "",
        *numbered(steps),
        "",
    ]
    return "\n".join(parts + payload(base, skills)) + "\n"


def main():
    base, skills = load()
    (ROOT / "setup-prompt.md").write_text(setup_message(base, skills))
    print(f"{len(skills)} skills, {len(base['memory'])} memory notes")


if __name__ == "__main__":
    main()
