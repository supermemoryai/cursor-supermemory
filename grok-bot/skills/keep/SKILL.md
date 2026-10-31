---
name: Keep
description: >-
  Use when the person says remember, keep or note this; when a group settles
  a decision, preference, owner, date or finding; or when a Bot sends
  something to keep. Not for chatter, plans still being discussed, or task
  progress.
---
What to keep, one of these areas:
- **Decision**: what was decided and why.
- **Preference**: how the person likes things done.
- **Person**: who someone is, their role, how the person knows them.
- **Project**: stack, owners, dates, constraints, where it stands.
- **Finding**: a root cause, source or answer that took real work.
- **Correction**: a fix to something stored earlier.

Never keep: secrets, passwords, tokens, payment, ID or account numbers; health, religion, politics, sexuality, ethnicity, finances or other sensitive details about anyone, unless the person explicitly asks you to keep one about themselves; anything inside `<private>`; whole conversations, raw dumps or guesses; anything listed in `do-not-save.md`.

Preferences: one the person states is a Preference. One you only infer from a single correction is not yet: add it to `observations.md`. If you see it a second time, keep it. Once is a note, twice is a rule.

Steps:
1. Read `do-not-save.md`. If the person says "don't remember X", add X there and stop.
2. Pick the space with Space map: personal for the person's preferences and people, the project's space for project facts. Unsure: personal.
3. `search_memory` there first and skip anything already stored. If it changes an older memory, end the new one with `Replaces: <old fact>`.
4. `add_memory`, one fact per call, written to stand alone: `<Area>: <fact> (<source>, <date>)`. The source is "you" when the person said it, "reported by <Bot name>" when a Bot did, and "imported from <assistant>" for imports.
5. Confirm the way the prefs line says:
   - each time: `◪ Saved to Supermemory: <fact>`
   - one line at the end: after the last save in the message, `◪ Saved 3: 1) … 2) … 3) …`
   - don't tell me: nothing
   When you list saves, add "Say strike and a number to remove one."

Not connected: add it to `pending.md` and say "I'll keep this once Supermemory is connected."
