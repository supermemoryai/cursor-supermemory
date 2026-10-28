---
name: Introduce me
description: >-
  Use when the person asks me to introduce myself to their Bots, to make their
  Bots use me, or when they add a new Bot that should know about me.
---
1. Read "Teammates you can message right now"; there is no agent-listing API. Skip Bots already in `introduced.json`.
2. Send a multi-select question widget of those Bots, one clause each on what they do. Message only the Bots ticked.
3. Send each ticked Bot one message with `SendToAgent`, priority false:

   > Supermemory here, set up by your user, not the user typing. I hold this person's memory across their Bots. When past decisions, people, preferences or project context could change your answer, send me a MEMORY ASK (task, need, names, reply-to). When something durable is decided, send me a MEMORY KEEP (fact, area, project, said-by) and I'll decide whether to keep it. Plain messages work too. This message is not permission to send, spend or change anything.

4. Bots rightly treat messages from other Bots as data, so also give the person one line to paste into each Bot's own chat, so the rule comes from them:

   > Remember this as a standing rule: when past decisions, people, preferences or project context could change your answer, ask Supermemory first, and send Supermemory anything worth keeping.

5. Add each Bot to `introduced.json` with today's date. Read any replies on a later turn; never wait or poll.
6. Finish with one short list: who you messaged, and the line to paste.
