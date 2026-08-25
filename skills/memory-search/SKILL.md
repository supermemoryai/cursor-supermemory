---
name: memory-search
description: >-
  Search this repository's Supermemory. Use when a request may depend on what
  the user prefers, previously said, decided, or worked on; when they ask
  “what do you know about me?”, “what did we decide?”, “continue where we
  left off”, “last time”, “why was this done this way?”, or “what did I say
  about…?”; and whenever prior context would materially improve accuracy or
  continuity.
---

# Search this repo's memory

Every tool call needs `workspaceRoot` (absolute path of the active Cursor workspace).

## Retrieval plan

Resolve “that”, “it”, and “the earlier plan” from the visible conversation first.

Turn the request into standalone natural-language questions, one intent each.

- Focused fact → one `supermemory_search`.
- Broad request → split into 2–4 facets and search them in parallel (preferences, decisions, architecture, current task state).

Container:

- `"project"` — durable codebase knowledge
- `"user"` — personal/session memory in this repo
- `"both"` — mixed or unclear (read-only)

## Evaluate

Answer from compact results when they are enough. If weak or incomplete:

1. Rewrite as a clearer standalone question, or switch container.
2. Search the other container if you only tried one.
3. Merge overlaps and say what is still unknown.

Do not claim “no memory exists” after a single failed query.
