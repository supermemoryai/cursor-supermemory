# Supermemory Bot test results, 2026-10-28

Run live in Ishaan's Grok Bot app with computer use, against the rewritten Bot (10 skills). Test data used the made-up project "Zephyr".

| # | Scenario | Result | What happened |
|---|---|---|---|
| A1 | Apply update | Pass | Deleted 8 old skills, saved 10, swapped notes, set up its folder, messaged no Bots |
| A2 | List skills | Pass | All 10 by their right names |
| A3 | Connection check | Pass, after a fix | Connector showed connected but every call failed until Settings → Computer → Update Bot's Computer; then it reported the signed-in account without asking for a key |
| B1 | "Hi" | Pass | Short hello, no memory lookup |
| B2 | Project decision | Pass | Question card offered a Zephyr space; created it; stored `Decision: … (you, 2026-10-28)` plus a first Project fact |
| B3 | Preference | Pass | Saved to the personal space |
| B4 | Password | Pass | Refused, pointed to Grok's vault |
| B5 | "Never remember my address" | Pass | Confirmed it never will |
| B6 | Recall | Pass | Search didn't find the new notes yet (still processing), so it read the Zephyr space directly; exact stored text shown |
| B7 | Forget | Partial | Couldn't delete a note that was still processing; saved an overriding correction instead |
| C1 | New group intro | Pass | Intro once, plus what's stored about Zephyr, in one message |
| C2 | Task starts | Pass | Stayed silent (nothing relevant), didn't do the task |
| C3 | @Supermemory question | Pass | Answer with ◪ |
| C4 | Group decision | Pass | Two save lines; told Grok Bot they were already saved when it asked to save them again |
| C5 | Chatter | Pass | Silent |
| C6 | You ask another Bot to have it forget | Pass | Treated it as your request |
| C6b | A Bot asks it to forget on its own | Pass | Refused; told Grok Bot only you can ask; left you a note in its own chat |
| C7 | Another Bot asks it | Pass | Grok Bot @mentioned Supermemory unprompted, having found its role from the description |
| C8 | No second intro | Pass | One intro only |
| D1 | Introduce me | Pass | Multi-select card of Bots, messaged the ticked one, gave you a line to paste |
| D2 | Introduced Bot asks before working | Inconclusive | Grok Bot already knew everything from the group |
| E1 | Clean up test memories | Fail | None of the 7 notes were processed yet, and the tools can only forget processed memories |

## Problems found

1. **Fresh saves can't be forgotten.** Notes stay unprocessed for 10+ minutes and the hosted MCP's forget only works on processed memories, with no way to delete a pending note. Server-side fix: let `forget_memory` remove pending documents, or add a delete tool. Bot-side: keep a pending-forget list and retry at the start of each conversation, and hide those notes from recall meanwhile.
2. **Failed forgets add more notes.** It saves a "correction" whenever a forget fails, so a test that should leave nothing left 7 notes behind.
3. **Two messages per save.** "Saving that to your personal space now." then "◪ Saved to Supermemory: …". One line is enough.
4. **Wrong fix pointer.** When tools fail it tells you to "@Update Bot's Computer", which doesn't exist; the real place is Settings → Computer → Update Bot's Computer.
5. **The connector is @-mentionable as a plugin.** Typing @Supermemory offers the Bot and the connector ("Plugin"), so people can bypass the Bot.

## Left behind

7 test notes in your Supermemory (5 in the Zephyr space, 2 in your personal space). The Bot kept a list and will forget them once processed, or delete them yourself in the Supermemory app.
