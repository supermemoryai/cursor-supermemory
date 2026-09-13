---
name: memory-init
description: Deep codebase exploration to initialize project memory. Use when starting work on a new project or when user asks to "index" or "learn" the codebase.
---

1. Explore the project structure: read package.json, README, main entry points
2. Identify: tech stack, framework, architecture patterns, key directories
3. Find conventions: naming, testing approach, build system, deployment
4. Read core files to understand data models and business logic
5. Save the architecture summary, the tech stack, and the key conventions with separate `add_memory` calls, each passing the container tag from the `<supermemory-context>` block injected at session start
6. Confirm: "Codebase indexed — [N] memories saved about [project name]"
