---
name: memory-save
description: Save important information to persistent memory. Use when user explicitly asks to remember something, or when you've solved a significant problem worth preserving.
---

1. Extract the key insight, decision, or solution to save
2. Call `add_memory` with concise, searchable content and the container tag from the `<supermemory-context>` block injected at session start
3. Prefix project knowledge with the area it belongs to (architecture, conventions, error solutions) so later searches can distinguish it
4. Use `add_memory` in `forget` mode when the information replaces something now outdated
5. Confirm to user that the information has been saved
