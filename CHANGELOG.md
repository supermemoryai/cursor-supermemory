# Changelog

## Unreleased

- Find the install from Grok Bot's marketplace cache (`~/sand-data/plugins/cache`) in hooks, the MCP entry, commands and skills, and check the package name so another plugin's `dist/cli.js` is never picked up by the commands.
- Add `memory-connect`, `memory-status` and `memory-disconnect` skills for hosts without slash commands.
- `login --client grok_bot` (or Grok's own variables / a `~/.grok` install) registers the OAuth client as "Supermemory for Grok Bot", so the consent page names Grok Bot.
- The MCP proxy marks memories from `search_memory`, `get_profile` and `list_memories` with ◪ and defaults space-scoped calls to the repository namespace, as Claude Code's proxy does.
- Capture redacts credential-shaped values and `<private>` content; recall injects up to 15 memories and asks the agent to open its reply with `◪ Supermemory · recalled N memories` (`showRecallNotice`, on by default); `status` names the account; the ◪ citation wording matches the other plugins.

## 1.3.0

- Sign in with OAuth 2.1 (dynamic client registration and PKCE) instead of a browser-issued API key. Tokens refresh automatically across hooks and the MCP proxy; `logout` revokes them. API keys from the environment, config or an existing credentials file keep working and take precedence.

## 1.2.3

- Use the bundled official Supermemory 5.0.1 SDK for hosted REST profile, search and document capture, preserving existing namespace strings, metadata and incremental generation IDs.
- Retain custom-server v3/v4 compatibility by default, with explicit `apiVersion` / `SUPERMEMORY_API_VERSION` selection and independent MCP routing.
- Render v5 profile facts and validate capture acceptance before advancing the saved cursor. Preserve recall gates, three-second budgets, zero transport retries and dynamic processing.
- Ship reproducible standalone Node 18+ bundles and SDK license attribution. This is the plugin-panel/Git release channel, not an upgrade or publication of the older npm 1.0.0 local-MCP product.
