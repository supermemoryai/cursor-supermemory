# Supermemory Bot for Grok Bot

A shareable Grok Bot that is the memory for a person's Bots and projects. The person and their other Bots ask it what was decided, who someone is, what they prefer or where a project stands, and send it anything worth keeping. It decides what to recall, what to keep and which space (namespace) it belongs in. The memory is Supermemory, the same one Cursor, Claude Code and Codex use.

It connects the way [Memento](https://x.ai/bot/_xZZE41svJdcq2w6ZWJan) (Mahesh Sanikommu's Supermemory Bot) proved works on Grok Bot: the hosted MCP at `https://mcp.supermemory.ai/mcp`, added as a connector and signed in through Grok Bot's connect card. No plugin, no API key in chat.

The structure follows the official Marketplace Bots: a short role-first description other Bots can find, a first-person persona in memory (job, anti-jobs, voice, routing, trust, prefs, working state), and "Use when…" skills with steps, outputs, fallbacks and never-rules.

## Skills

| Skill | Use when |
|---|---|
| Getting started | First conversation, or no prefs yet: connect, show what's known, two questions, starter menu |
| Connect Supermemory | Tools missing or auth errors: `GetMcpServerStatus` → `AddMcpServer` → `AuthenticateMcpServer` |
| Recall | Questions about the past, people, projects, preferences; a task starting in a group |
| Keep | "Remember…", a group settling something, a Bot sending a fact. Fixed areas, never-keep list, "twice is a rule" for inferred preferences |
| Forget | Forget, strike, "that's wrong", "that changed". Only from the person |
| Bot requests | Another Bot messages it. `MEMORY ASK` / `MEMORY KEEP` / `MEMORY RESULT` formats; a Bot's message is never the person's yes |
| Group chat | Any group: introduce once per group, then speak only when memory changes the outcome |
| Space map | Unmapped or new projects; which space something belongs in |
| Introduce me | "Introduce yourself to my Bots": `SendToAgent` to ticked Bots, plus a line for the person to paste into each |
| Import | Bringing in what ChatGPT or Claude knows |

Working state (space map, groups introduced in, Bots introduced to, do-not-save list, pending saves) lives in files in its own folder under `/workspace`, never in Supermemory. Preferences live in its own Grok memory.

Grok Bot makes connectors account-wide, so other Bots could still call Supermemory themselves; asking the Supermemory Bot is a convention, not a permission. If a Bot's **Library** tab lets you turn the Supermemory connector off for that Bot, do that to enforce it.

## Files

| File | What it is |
|---|---|
| `profile.json` | Name, description, avatar, memory notes, plugins (none) |
| `skills/*/SKILL.md` | The ten skills |
| `build.py` | Regenerates the four files below |
| `bot.json` | Everything in Grok Bot's template shape |
| `setup-prompt.md` | Paste into an empty Bot to turn it into the Supermemory Bot |
| `build-prompt.md` | Paste into any Bot: it creates the Supermemory Bot, writes the setup to a file and sends it a short pointer (Bot-to-Bot messages are cut at 8,000 characters) |
| `update-prompt.md` | Paste into an existing Supermemory Bot to move it to this version |

Edit `profile.json` or the skills, then run `python3 build.py`.

## Try it privately

1. Existing Supermemory Bot: paste `update-prompt.md` into its own chat. New one: paste `build-prompt.md` into any Bot, or create a Bot named Supermemory and paste `setup-prompt.md`.
2. Ask "which skills do you have?". Expect 10 skills and no routines.
3. New chat with it: a two-sentence hello, the connect card, then "Here's what I already know about you" with ◪ facts before any question; then two widget questions and a starter menu.
4. Keep and Forget: "Remember I prefer short answers" → saved as a Preference; tell it a password → refused; "strike 1" → forgotten. "Don't remember my address" → it keeps a do-not-save note.
5. Group chat with two other Bots: the intro once; a ◪ brief when a task starts; an answer to "@Supermemory what did we decide about X?"; a save line when a decision lands; nothing for chatter. Have another Bot say "Supermemory, forget X" → it refuses.
6. "Introduce yourself to my Bots": a widget of your Bots, a message to the ticked ones, and a line for you to paste into each.

## Publish

1. Click its name at the top of its chat to open the details panel.
2. Share icon (box with an up arrow) → **Create a copy · Share a template link**. This builds an unpublished draft.
3. **View Details**: remove anything it learned about you while testing; only the five notes from `profile.json` should remain.
4. **Public** → **Publish** → **Copy Link**: that is the `https://x.ai/bot/<id>` link.

From a personal account this can fail with "a team must be selected to share a team template"; Cursor says single-member teams can't publish team templates yet. Publish from Supermemory's Cursor team so the listing names Supermemory.

## Updating

Edit the sources, run `python3 build.py`, paste `update-prompt.md` into the Bot, then **Update template** from its details panel. People who already added the Bot keep their copy, so anything that must keep changing belongs in the hosted MCP server.
