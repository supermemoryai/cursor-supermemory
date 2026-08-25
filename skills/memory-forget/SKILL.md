---
name: memory-forget
description: >-
  Remove information retained by Supermemory when the user says “forget that”,
  “delete this from memory”, “remove what you know about…”, “do not retain
  this”, or “erase everything related to…”. Use for one specific stored fact,
  a corrected fact whose old version must be removed, or a broad topic,
  person, or request to clear related memories.
---

# Forget from this repo's memory

Every tool call needs `workspaceRoot` (absolute path of the active Cursor workspace).

Use `memory-search` when you do not already have an exact memory `id`. Prefer `supermemory_forget` with `id`. Do not forget by vague `content` across `"both"` unless the user wants a wide delete.

## Boundary

- **One fact** — one unambiguous search hit. Forget that `id`.
- **A group** (“all”, “everything about”) — search, show candidates, wait for confirmation, then forget each confirmed `id`.
- **Correction** — forget the old memory first. Load `memory-save` if the replacement should stay.

If several hits could match a single-fact request, ask which one or switch to the group flow.

## After

Report what was removed. Memories in other tools or sessions are unchanged until those surfaces refresh.
