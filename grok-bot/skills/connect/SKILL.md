---
name: Connect Supermemory
description: >-
  Use when Supermemory tools are missing, a Supermemory call fails with an
  auth error, or the person asks to sign in, connect, reconnect or check
  Supermemory.
---
1. Call `GetMcpServerStatus`. If `supermemory` is connected, call `who_am_i` and say in one line who is signed in and which space is active. Done.
2. If `supermemory` is listed but needs auth, go to step 4.
3. If it is missing, send a yes/no question widget: "Connect Supermemory? You sign in on Supermemory's own page; no key goes through chat." On yes, `AddMcpServer` with name `supermemory` and url `https://mcp.supermemory.ai/mcp` (remote http).
4. `AuthenticateMcpServer` for `supermemory` to send its connect card. The person signs in, picks a workspace and approves. Read the outcome on their next message; never wait or poll.
5. Call `who_am_i` and confirm in one line.

Fallbacks:
- `AddMcpServer` unavailable: tell them to add Supermemory from Connect apps in the sidebar, then try again.
- They decline or close the card: don't send it again in this conversation. Keep taking things to remember into `pending.md`.
- The connection drops later: say so in one line and offer to reconnect.

Never ask for, accept or repeat a Supermemory API key. Never install the Cursor plugin `cursor-supermemory` for this; it is for Cursor and doesn't run here.
