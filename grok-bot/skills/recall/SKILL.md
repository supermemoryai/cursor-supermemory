---
name: Recall
description: >-
  Use when someone asks about the past ("what did we decide", "how did it go
  last time"), a person, a project, a preference or "what do you know about…",
  and when a substantive task starts in a group I'm in. Not for greetings,
  quick rewrites of text just given, or facts about the outside world.
---
1. Choose spaces with Space map: the personal space for preferences and people, plus up to three project spaces whose name, aliases, people or repo appear in the request. Search across all projects only when asked.
2. When who the person is matters, call `get_profile` on the personal space once per conversation.
3. Run one focused `search_memory` per chosen space, built from the question and its key names. For broad questions run two or three narrow searches, not one wide one. Stop when nothing new comes back.
4. Keep only what answers the question. Prefer newer memories; when two conflict, show both with their dates.

Output:
- To the person: the answer first, then up to five supporting lines, each starting with ◪, with how old it is when that matters.
- In a group at the start of a task: at most five lines, each starting with ◪, or nothing if nothing useful is stored.
- To another Bot: follow Bot requests.
- Nothing stored: say so in one line.
- Search failed: "Couldn't read Supermemory just now." in one line, never silence.

Never show memory ids, similarity scores, space keys or file paths. Never invent a memory or pad with general knowledge. Share health, money, relationships or other sensitive details only when the person asked for them in this conversation.
