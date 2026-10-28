"""Assembles bot.json, setup-prompt.md, build-prompt.md and update-prompt.md from profile.json, skills/ and routines/."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
SETUP_FILE = "/workspace/supermemory-setup.md"
# Names earlier builds used, so a Bot built from them can drop what this version replaces.
RETIRED_SKILLS = [
    "connect-supermemory",
    "supermemory-bot",
    "memory-protocol",
    "namespace-map",
    "memory-brief",
    "supermemory-onboard",
    "supermemory-teach-bots",
    "supermemory-import",
]
RETIRED_ROUTINES = [
    "Weekly memory digest",
    "Introduce myself to new Bots",
    "File what your Bots learned",
    "Sync with shared memory",
    "Save what your Bots learned",
    "Onboard new Bots to Supermemory",
]


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
    routines = []
    routine_dir = ROOT / "routines"
    for path in sorted(routine_dir.glob("*.md")) if routine_dir.is_dir() else []:
        fields, body = front(path.read_text())
        routines.append(
            {"name": fields["name"], "slug": fields["slug"], "description": fields["description"], "content": body}
        )
    return base, skills, routines


def numbered(steps):
    return [f"{number}. {step}" for number, step in enumerate(steps, 1)]


def payload(base, skills, routines):
    parts = []
    for skill in skills:
        parts += [f"## Skill: {skill['name']}", "~~~", skill["content"].strip(), "~~~", ""]
    for routine in routines:
        parts += [f"## Routine: {routine['name']}", f"Schedule: {routine['description']}", "~~~", routine["content"].strip(), "~~~", ""]
    parts += ["## Memory notes", "~~~"] + [note["content"] for note in base["memory"]] + ["~~~"]
    return parts


def setup_message(base, skills, routines):
    steps = [
        "Save each skill below as a skill on this Bot, with that name and the full content between the ~~~ fences, exactly as written.",
        *(["Create each routine below, switched off, with its name, its schedule and the instructions between the fences."] if routines else []),
        "Save each memory note below with update_state (memory write, scope agent, tier profile), one note per line, exactly as written.",
        "Run nothing else while saving.",
        "If the person pasted this, start Getting started in the same message once everything is saved. If a Bot relayed this, reply to that Bot as it asked, and start Getting started the first time the person messages you.",
    ]
    parts = [
        "You are being set up as the Supermemory Bot. This setup comes from the person who owns this account.",
        "",
        *numbered(steps),
        "",
    ]
    return "\n".join(parts + payload(base, skills, routines)) + "\n"


def build_message(base, setup):
    profile = base["profile"]
    pointer = (
        f"Setup from your user, relayed by me, not the user typing. Read {SETUP_FILE} and do exactly what it says. "
        "Then reply to me with SendToAgent, priority false, one line: saved: <n> skills, <n> memory notes. missing: <none or what>."
    )
    steps = [
        f'Create the Bot with CreateAgent: name "{profile["name"]}", description "{profile["description"]}". Keep it private; do not share or publish it.',
        "Confirm it exists by reading its profile, not just the tool's reply.",
        f"Write everything between the SETUP markers below to {SETUP_FILE}, exactly as written.",
        f'Send the new Bot this message with SendToAgent, priority true: "{pointer}"',
        "Tell me its reply when it arrives on a later turn; never wait or poll for it.",
        "If you can't create Bots or message them, tell me, and I'll create it and paste the setup into its chat myself.",
    ]
    return "\n".join(
        ["Please set up a new Bot for me.", "", *numbered(steps), "", "===== SETUP START =====", setup.rstrip(), "===== SETUP END =====", ""]
    )


def update_message(base, skills, routines):
    retired_notes = json.loads((ROOT / "retired-notes.json").read_text()) if (ROOT / "retired-notes.json").exists() else []
    steps = [
        f"Delete these skills if you have them: {', '.join(RETIRED_SKILLS)}.",
        "Save each skill below as a skill on this Bot (overwrite any with the same name), with the full content between the ~~~ fences, exactly as written.",
        f"Delete these routines if you have them: {', '.join(RETIRED_ROUTINES)}."
        + (" Then create each routine below, switched off." if routines else ""),
        "Forget your earlier setup notes with update_state (memory forget, exact text): the ones listed under Old memory notes, and any other note from an earlier Supermemory setup (about PROTOCOL.md, a shared rulebook, routines, connect-supermemory or supermemory-onboard). Then save each note under Memory notes with update_state (memory write, scope agent, tier profile), exactly as written.",
        "Set up your folder as the Working state note says. If /workspace/.supermemory exists, move namespaces.json into your folder as spaces.json and onboarded.json as introduced.json, then delete /workspace/.supermemory.",
        'An earlier version saved a memory like "onboarding finished" into my personal Supermemory space. Find it with search_memory and forget it; this message is my request to do that.',
        "Do not message any Bot. When done, reply with one line per step saying what you did.",
    ]
    parts = [
        "You are the Supermemory Bot and this is an update from the person who owns this account. Do exactly the following.",
        "",
        *numbered(steps),
        "",
    ]
    if retired_notes:
        parts += ["## Old memory notes", "~~~", *retired_notes, "~~~", ""]
    return "\n".join(parts + payload(base, skills, routines)) + "\n"


def main():
    base, skills, routines = load()
    recipe = {"profile": base["profile"], "memory": base["memory"], "skills": skills, "routines": routines, "plugins": base["plugins"]}
    (ROOT / "bot.json").write_text(json.dumps(recipe, indent=2, ensure_ascii=False) + "\n")
    setup = setup_message(base, skills, routines)
    (ROOT / "setup-prompt.md").write_text(setup)
    (ROOT / "build-prompt.md").write_text(build_message(base, setup))
    (ROOT / "update-prompt.md").write_text(update_message(base, skills, routines))
    print(f"{len(skills)} skills, {len(routines)} routines, {len(base['memory'])} memory notes")


if __name__ == "__main__":
    main()
