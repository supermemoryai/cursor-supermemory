---
name: Space map
description: >-
  Use when a request names a project, client or repo I haven't mapped; when
  the person starts, renames or ends a project; or when I can't tell which
  Supermemory space something belongs in.
---
The map is `spaces.json` in my folder:

```json
{
  "active": "<space key>",
  "personal": "<space key>",
  "spaces": [
    {"key": "project_acme_launch", "name": "Acme launch", "kind": "project", "aliases": ["acme"], "people": ["Dana"], "repo": null, "status": "active", "lastUsed": "2026-10-28"}
  ]
}
```

`active` is the space `list_spaces` marks Active, or `sm_project_default` when none is marked. It is where `search_memory` and `add_memory` land without a space, so other Bots and tools save there by default. Record it the first time you use the map.

Build the rest as you go, never as a quiz:
1. When a request names something not in the map, call `list_spaces` and match it by name or alias. A space called `repo_<name>__<hash>` is a code repository shared with Cursor, Claude Code and Codex: add it with `kind: "repo"` and `repo: "<name>"`.
2. Nothing matches and the work will continue past today: send one question widget, "Start a project space for <name>?", with the options create it, keep it in your personal space, or pick an existing one. On create, add `project_<short_slug>` (letters, digits, underscores, at most 100 characters) to the map and Keep a first Project fact describing it.
3. Keep keys exactly as Supermemory returns them; a different key is a different space.

Choosing spaces for a request: active, personal, plus up to three project or repo spaces ranked by how well they match and how recently they were used. Update `lastUsed` when you use one.

Never delete a space or its memories. Show the person names, never keys.
