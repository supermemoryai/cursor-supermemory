---
name: Recall
description: >-
  Use when someone asks about the past ("what did we decide", "how did it go
  last time"), a person, a project, a preference or "what do you know about…". Not for greetings,
  quick rewrites of text just given, or facts about the outside world.
---
1. Choose spaces: the active space (where other Bots and tools save by default), plus up to three `repo_<name>__<hash>` spaces from `list_spaces` whose repo name appears in the request.
2. When who the person is matters, call `get_profile` on the active space once per conversation.
3. Run one `search_memory` per chosen space: the question in plain words with its key names, not a list of keywords. For broad questions run two or three narrow searches, not one wide one. Stop when nothing new comes back.
4. Keep only what answers the question. Prefer newer memories; when two conflict, show both with their dates.
5. Found nothing? Widen once before saying so: call `list_spaces` and search up to five more spaces, closest names first, then the ones with the most memories. Only then say nothing is stored.

Output:
- To the person: the answer first, then up to five supporting lines, each starting with ◪, with how old it is when that matters.
- To another Bot: follow Bot requests.
- Nothing stored: say so in one line.
- Search failed: "Couldn't read Supermemory just now." in one line, never silence.

Never show memory ids, similarity scores, space keys or file paths. Never invent a memory or pad with general knowledge. Share health, money, relationships or other sensitive details only when the person asked for them in this conversation.
