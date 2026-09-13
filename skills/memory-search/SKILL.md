---
name: memory-search
description: Search persistent memory for relevant information from past coding sessions. Use when user asks about previous work, past bugs, architectural decisions, or anything that may have been worked on before.
---

1. Call `search_memory` with a focused query and the container tag from the `<supermemory-context>` block injected at session start
2. If results found, surface relevant memories in your response with context
3. If no results found, note that no prior memory exists for this topic
4. For a broad question, run a few narrower searches instead of one wide one, and use `listMemories` when recent memories matter more than semantic relevance
