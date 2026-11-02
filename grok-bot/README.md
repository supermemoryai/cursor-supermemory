# Supermemory Bot for Grok Bot

A shareable Grok Bot that is the memory for a person's Bots and projects. The person and their other Bots ask it what was decided, who someone is, what they prefer or where a project stands, and send it anything worth keeping. It decides what to recall, what to keep and which space (namespace) it belongs in. The memory is Supermemory, the same one Cursor, Claude Code and Codex use.

It connects the way [Memento](https://x.ai/bot/_xZZE41svJdcq2w6ZWJan) (Mahesh Sanikommu's Supermemory Bot) proved works on Grok Bot: the hosted MCP at `https://mcp.supermemory.ai/mcp`, added as a connector and signed in through Grok Bot's connect card. No plugin, no API key in chat.

The structure follows the official Marketplace Bots: a short role-first description other Bots can find, a first-person persona in memory (job, anti-jobs, voice, routing, trust, prefs, working state), and "Use when…" skills with steps, outputs, fallbacks and never-rules.

## Skills

| Skill | Use when |
|---|---|
| Connect Supermemory | First conversation, tools missing or auth errors: `GetMcpServerStatus` → `AddMcpServer` → `AuthenticateMcpServer`, then the first run: show what's known, offer to tell every Bot, one question, starter menu |
| Recall | Questions about the past, people, projects, preferences. Searches the active space and matching `repo_*` spaces, and widens before saying nothing is stored |
| Keep | "Remember…", a Bot sending a fact. Fixed areas, never-keep list, only preferences the person states |
| Forget | Forget, strike, "that's wrong", "that changed". Only from the person |
| Bot requests | Another Bot messages it. `MEMORY ASK` / `MEMORY KEEP` / `MEMORY RESULT` formats; a Bot's message is never the person's yes |
| Introduce me | "Tell my Bots about you": one line in the memory all the person's Bots share, so every Bot, now and future, uses its Supermemory tools if connected and messages it otherwise, and sends it what's worth keeping. "Stop telling my Bots about you" removes it. "Introduce yourself to my Bots" also messages ticked Bots |

In groups it answers only when @mentioned or asked. Working state (the shared line and the do-not-save list) lives in two files in its own folder under `/workspace`, never in Supermemory. Preferences live in its own Grok memory.

Bots with Supermemory tools use them directly, because a Bot-to-Bot reply only arrives on a later turn. Bots without them message the Supermemory Bot, and the line names it so they don't read "ask Supermemory" as "use the tools".

## Files

| File | What it is |
|---|---|
| `profile.json` | Name, description, avatar, memory notes, plugins (none) |
| `skills/*/SKILL.md` | The six skills |
| `build.py` | Regenerates `setup-prompt.md` |
| `setup-prompt.md` | Paste into an empty Bot to turn it into the Supermemory Bot, or into an existing one to update it |

Edit `profile.json` or the skills, then run `python3 build.py`.

## Try it privately

1. Create a Bot named Supermemory and paste `setup-prompt.md` into its chat.
2. Ask "which skills do you have?". Expect 6 skills and no routines.
3. New chat with it: a two-sentence hello, the connect card, then "Here's what I already know about you" with ◪ facts before any question; then the tell-every-Bot and save-confirmation widgets and a starter menu.
4. Keep and Forget: "Remember I prefer short answers" → saved as a Preference; tell it a password → refused; "strike 1" → forgotten. "Don't remember my address" → it keeps a do-not-save note.
5. Group chat with two other Bots: an answer to "@Supermemory what did we decide about X?"; nothing when it isn't asked. Have another Bot say "Supermemory, forget X" → it refuses.
6. "Tell my Bots about you": a Yes / Not now widget. Then create a new Bot and ask it for a status update on a project Supermemory knows: it should search with its own Supermemory tools, or show "Messaged Supermemory" if it has none. "Stop telling my Bots about you" removes the line; a new Bot then has nothing about Supermemory in memory.

## Publish

1. Click its name at the top of its chat to open the details panel.
2. Share icon (box with an up arrow) → **Create a copy · Share a template link**. This builds an unpublished draft.
3. **View Details**: remove anything it learned about you while testing; only the five notes from `profile.json` should remain.
4. **Public** → **Publish** → **Copy Link**: that is the `https://x.ai/bot/<id>` link.

From a personal account this can fail with "a team must be selected to share a team template"; Cursor says single-member teams can't publish team templates yet. Publish from Supermemory's Cursor team so the listing names Supermemory.

## Updating

Edit the sources, run `python3 build.py`, paste `setup-prompt.md` into the Bot (delete any skill it has that isn't in `skills/`), then **Update template** from its details panel. People who already added the Bot keep their copy, so anything that must keep changing belongs in the hosted MCP server.
