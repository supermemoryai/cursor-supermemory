# Changelog

## Unreleased

- Fix `login` dying before the browser could deliver the key on machines with no browser opener (`spawn xdg-open ENOENT`), which left Grok Bot's approval pointing at a closed port. The callback listener now runs in the background for 10 minutes, so agents get the URL back at once (`--wait` blocks; `--callback-url` finishes from an address the browser could not deliver).
- Name the agent on the approval page: `--client grok_bot` (or Grok's own variables / a `~/.grok` install) shows Grok Bot instead of Cursor, and the device, OS, folder and plugin version replace "Unknown".
- Add `memory-connect`, `memory-status` and `memory-disconnect` skills for hosts without slash commands, and locate the install on Cursor, Grok and Claude Code paths in every command.
- Ask the agent to open replies that use recalled memory with `◪ Supermemory · recalled N memories` (`showRecallNotice`, on by default), and let the MCP proxy pick up a key saved mid-session.
- Parity with the Claude Code and Codex plugins: the MCP proxy marks memories from `search_memory`, `get_profile` and `list_memories` with ◪ and defaults space-scoped calls to the repository namespace; capture redacts credential-shaped values and `<private>` content; recall injects up to 15 memories; `status` names the account; an unconnected session opens the browser sign-in once; read-only tools under the server's snake_case names are auto-approved; the ◪ citation wording matches the other plugins.

## 1.2.3

- Use the bundled official Supermemory 5.0.1 SDK for hosted REST profile, search and document capture, preserving existing namespace strings, metadata and incremental generation IDs.
- Retain custom-server v3/v4 compatibility by default, with explicit `apiVersion` / `SUPERMEMORY_API_VERSION` selection and independent MCP routing.
- Render v5 profile facts and validate capture acceptance before advancing the saved cursor. Preserve recall gates, three-second budgets, zero transport retries and dynamic processing.
- Ship reproducible standalone Node 18+ bundles and SDK license attribution. This is the plugin-panel/Git release channel, not an upgrade or publication of the older npm 1.0.0 local-MCP product.
