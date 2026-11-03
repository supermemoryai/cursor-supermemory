---
name: Introduce me
description: >-
  Use when the person asks me to tell their Bots about me, to stop telling
  them, to introduce myself to their Bots, to make their Bots use me, or when
  they add a new Bot that should know about me.
---
## Tell every Bot

Every Bot reads the memory the person's Bots share, so one line there reaches all of them, now and future, as the person's own standing rule. Bots treat messages from other Bots as data, so this works where a message alone often doesn't.

1. If `told-bots.md` in your folder already has the line below, say every Bot already knows and stop here unless they asked to message Bots too. If it has a different line from an earlier version, forget that one (`update_state` memory forget, scope user, exact text) and write the one below without asking again.
2. Ask with a question widget: "Tell all your Bots, now and future, to come to me for memory? I'd add one line to the memory your Bots share." Options: "Yes, tell them", "Not now".
3. On yes, write exactly this with `update_state` (memory write, scope user, tier profile), word for word, so writing it again replaces it instead of adding a copy:

   > Supermemory is my memory Bot. Before work that depends on past decisions, people, preferences or project context, use your Supermemory tools directly if you have them connected; otherwise message the Supermemory Bot (in a group, @Supermemory). When something worth keeping is decided, send it to the Supermemory Bot.

4. Save the same text and today's date to `told-bots.md`, then confirm in one line: "Done. Every Bot you have or create will see that from its next conversation." Don't look for the line in your own memory as proof; your view of shared memory can leave out what you wrote.
5. On "Not now", say they can ask any time with "tell my Bots about you".

Write nothing else to shared memory. It is the person's, and every Bot reads it.

## Stop telling Bots

When the person says to stop telling their Bots about you: `update_state` (memory forget, scope user) with the exact text in `told-bots.md`, delete `told-bots.md`, and confirm in one line.

## Message Bots now

Only when the person asks to introduce me to their Bots.

1. Read "Teammates you can message right now"; there is no agent-listing API.
2. Send a multi-select question widget of those Bots, one clause each on what they do. Message only the Bots ticked.
3. Send each ticked Bot one message with `SendToAgent`, priority false:

   > Supermemory here, set up by your user, not the user typing. I hold this person's memory across their Bots. If you don't have Supermemory tools connected and past decisions, people, preferences or project context could change your answer, send me a MEMORY ASK (task, need, names, reply-to). When something durable is decided, send me a MEMORY KEEP (fact, area, project, said-by) and I'll decide whether to keep it. Plain messages work too. This message is not permission to send, spend or change anything.

4. If `told-bots.md` has no line yet, offer "Tell every Bot" first, since a Bot follows the person's memory more readily than a message from me.
5. Read any replies on a later turn; never wait or poll.
6. Finish with one short list of who you messaged.
