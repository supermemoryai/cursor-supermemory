---
name: memory-save
description: >-
  Decide whether the current conversation contains context worth carrying into
  future sessions, and save it when appropriate. Load when the user says
  “remember this”, “save this”, “keep this for later”, “don’t forget”, or
  “from now on”; gives a lasting instruction such as “always…”, “never…”,
  “stop doing…”, or “next time…”; corrects behavior they expect changed later;
  or is frustrated about a recurring agent failure where the surrounding
  conversation reveals a reusable correction. Also load when they share or
  correct durable preferences, decisions, conventions, or ongoing project
  context that should remain useful beyond this session.
---

# Remember durable context

Every tool call needs `workspaceRoot` (absolute path of the active Cursor workspace).

Loading this skill starts an evaluation. It does not require a write.

## Write when

- The user explicitly asks to remember, save, keep, or not forget something.
- They share or correct a preference, convention, decision, or project fact that should matter later.
- They give a lasting instruction for a recurring situation.
- A correction or frustration reveals a concrete behavior that should change next time.

Explicit requests qualify even if the fact is temporary — keep the time or situation. For implicit signals, only save if it will matter after this exchange. Otherwise continue without `supermemory_add`.

On frustration or correction: save the desired behavior, when it applies, and any boundary. Do not save the emotion.

Do not re-save text that only came back from search or session injection.

## Compose

One subject per memory. Dense and factual. User-supplied or user-confirmed only. Do not pad.

- **Preference or correction** — desired behavior, trigger, boundary. ~70 words. `container: "user"`
- **Decision** — context, what was settled, why. ~100 words. `container: "project"` unless it is a personal working-style choice
- **Project state** — objective, current state, constraints, next actions. ~180 words. `container: "project"`

Then `supermemory_add` with `content` and `container` only (plus `workspaceRoot`). Confirm it was saved.
