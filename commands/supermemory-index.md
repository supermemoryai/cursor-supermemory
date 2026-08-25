---
name: supermemory-index
description: Index this codebase into Supermemory as durable project knowledge
---

Explore this repo and save a compact project-memory set. This is a batch index, not a reason to save every incidental finding mid-task.

Every `supermemory_add` call needs `workspaceRoot` (absolute path of the active Cursor workspace) and `container: "project"`.

1. Detect the stack from manifests (`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, etc.).
2. Read README, entry points, and how to build/test.
3. Map architecture: key directories, data flow, important modules.
4. Note conventions: naming, tests, errors, config.
5. Skip `node_modules`, lockfiles, generated output, and secrets.

Save a few dense memories (not one giant dump): stack, architecture, conventions, “where important logic lives”. One subject per `supermemory_add`. Follow `memory-save` compose rules (~180 words max for project state).

Confirm: "Codebase indexed — [N] memories saved about [project name]."
