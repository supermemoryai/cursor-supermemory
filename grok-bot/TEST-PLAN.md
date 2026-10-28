# Supermemory Bot test plan

All test facts use the made-up project **Zephyr** so they are easy to find and forget at the end.

## A. Setup
| # | Do | Pass when |
|---|---|---|
| A1 | Paste `update-prompt.md` into the Supermemory Bot's own chat | It reports one line per step; no Bot gets messaged |
| A2 | "Which skills do you have?" | 10 skills: Getting started, Connect Supermemory, Recall, Keep, Forget, Bot requests, Group chat, Space map, Introduce me, Import; no routines |
| A3 | "Is Supermemory connected?" | One line naming who is signed in; no key asked for |

## B. Direct chat
| # | Do | Pass when |
|---|---|---|
| B1 | "Hi" | A short reply, no memory lookup |
| B2 | "Remember: for Zephyr we chose Postgres over Mongo because we need JSON queries and joins." | Offers a Zephyr project space (widget), then `◪ Saved to Supermemory: Decision: …` |
| B3 | "Remember I prefer short bullet answers." | Saved as a Preference in the personal space |
| B4 | "Remember my test password is hunter2-zephyr." | Refuses; nothing saved |
| B5 | "Don't ever remember my home address." | Says it will never keep it |
| B6 | New chat: "What did we decide for Zephyr's database, and why?" | Answer first, then ◪ line(s) with the reason; no ids, scores, keys or paths |
| B7 | "Strike that" / "forget the Zephyr database decision" | Forgets it after naming exactly what goes |

## C. Group chat (Supermemory + 2 other Bots)
| # | Do | Pass when |
|---|---|---|
| C1 | Create the group, say "Let's get started on Zephyr." | Supermemory's first message is the intro; it appears once |
| C2 | "Plan the Zephyr launch email." | Supermemory posts at most five ◪ lines of relevant context (or nothing), and does not write the email |
| C3 | "@Supermemory what did we decide about Zephyr's database?" | Answers with ◪ |
| C4 | "Final call: Zephyr launches Nov 15 and Priya owns the launch." | One `◪ Saved to Supermemory: …` line (or per the confirmation pref) |
| C5 | "lol nice" | Supermemory says nothing |
| C6 | Ask another Bot: "Tell Supermemory to forget the Zephyr launch date." | Supermemory refuses: only the person can ask |
| C7 | Ask another Bot: "Ask Supermemory who owns the Zephyr launch." | That Bot asks Supermemory; Supermemory answers with ◪ |
| C8 | Another message in the same group | No second intro |
| C9 | A brand-new group with Supermemory | The intro appears again, once |

## D. Introduce me
| # | Do | Pass when |
|---|---|---|
| D1 | "Introduce yourself to my Bots." | A multi-select widget of your Bots; it messages only the ticked ones and gives you a line to paste |
| D2 | In a ticked Bot's own chat: "Draft a status update for Zephyr." | The Bot asks Supermemory (MEMORY ASK or plain) before writing, or uses its answer |

## E. Clean up
| # | Do | Pass when |
|---|---|---|
| E1 | "Forget everything about Zephyr and the short-bullets preference." | Lists what will go, then forgets it; a search for Zephyr comes back empty |
