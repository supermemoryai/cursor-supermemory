<div align="center">

# cursor-supermemory

**Persistent memory for Cursor, powered by [Supermemory](https://supermemory.ai)**

[![version](https://img.shields.io/github/package-json/v/supermemoryai/cursor-supermemory?label=version&color=9C5C10)](https://github.com/supermemoryai/cursor-supermemory)
[![license](https://img.shields.io/badge/license-MIT-9C5C10)](#license)

</div>

Persistent AI memory for Cursor, powered by [Supermemory](https://supermemory.ai). Your
agent remembers what you worked on, across sessions and across projects.

<div align="center">

[Installation](#installation) · [Features](#features) · [How it works](#how-it-works) · [MCP tools](#mcp-tools) · [Shared containers](#shared-agents-containers) · [Configuration](#configuration) · [Commands](#commands) · [License](#license)

</div>

---

## Installation

> Requires [Node.js](https://nodejs.org) on your PATH. Hooks and MCP run the plugin's bundled `dist/` with Node. Bun is only needed to *build* the plugin.

Open **Customize** in Cursor, find **Supermemory**, select **Install**, and choose a
project or user scope. Restart Cursor or run **Developer: Reload Window** after
installation.


## Features

|  |  |
| --- | --- |
| 🧠 **Session context**<br>Loads your persistent profile when a Cursor conversation starts. | 🔎 **Automatic recall**<br>Searches on every substantive prompt, deduplicates results, and injects them after the first tool result (the earliest point Cursor's hook API supports). |
| 💾 **Incremental capture**<br>Saves each completed turn and retries any unsaved transcript delta when the session ends. | 🛠️ **MCP tools**<br>Eight tools available in every Cursor AI session for explicit memory control, auto-approved without a permission prompt. |
| 🧭 **Context gatherer**<br>A subagent fans out several targeted searches before substantial work, instead of one broad query. | 📐 **Always-on rule**<br>A project rule nudges the agent to search proactively at the start of substantive turns, on top of the automatic hook recall. |
| 🧩 **Agent skills**<br>`memory-init` indexes a codebase into memory, `memory-save` and `memory-search` handle explicit save/search requests in conversation. | 🏷️ **Team memory**<br>Project knowledge shared across your team, separate from personal memories, via container scoping. |

All eight MCP tools are auto-approved by the `preToolUse` hook, including writes like
`supermemory_add` and `supermemory_forget`. Unlike the sibling Claude Code and Codex
plugins, this is not limited to read-only tools.

## How it works

Cursor supports hooks and MCP servers. `cursor-supermemory` registers six hooks across
five scripts, in lifecycle order:

**`sessionStart`** → **`beforeSubmitPrompt`** → **`preToolUse`** → **`postToolUse`** → **`stop`** → **`sessionEnd`**

| Step | Script | Event | What it does |
| --- | --- | --- | --- |
| 1 | `session-start` | `sessionStart` | Loads persistent profile context, or a "not connected" notice if unauthenticated. |
| 2 | `prompt-recall` | `beforeSubmitPrompt` | Searches Supermemory with the prompt and stashes fresh, deduplicated matches. |
| 3 | `approve-memory` | `preToolUse` | Auto-approves any `supermemory*` tool call, read or write. |
| 4 | `inject-recall` | `postToolUse` | Injects the recall stashed in step 2, once, into the next tool result. |
| 5 | `capture` | `stop` | Saves the completed turn. |
| 6 | `capture` | `sessionEnd` | Retries any transcript delta that step 5 didn't manage to save. |

Recall is searched immediately on prompt submission but only injected on the next tool
result, because that's the earliest point in a turn Cursor's hook API lets a plugin add
context. This is why capture runs twice: once at `stop` for the common case, once more
at `sessionEnd` as a safety net.

The hooks are tolerant: if Supermemory is unreachable, the API key is missing, or
anything else fails, they exit cleanly without breaking your Cursor session.

## MCP tools

| Tool | Description |
| --- | --- |
| `supermemory_get_config` | Show current config, resolved container tags, and config file paths |
| `supermemory_set_config` | Update config at project or global scope |
| `supermemory_containers` | Show what `user` and `project` container tags resolve to |
| `supermemory_search` | Search memories by query |
| `supermemory_add` | Save new information to memory |
| `supermemory_list` | List stored memories |
| `supermemory_forget` | Delete a memory by id or content |
| `supermemory_profile` | Get your user profile summary |

All tools that accept a `container` argument support:

- `"user"` (default): personal memories for the current repository
- `"project"`: project knowledge for the current repository
- `"both"`: both scopes plus compatible legacy memories
- any custom string: used as a raw container tag

`user` and `project` now write to the same repository container. The `sm_scope`
metadata field keeps personal/session memories separate from explicit project knowledge
when an agent requests one scope.

## Shared Agents containers

Cursor, Claude Code, Codex, and OpenCode use the same repository tag:

```
repo_<project_name>__<project_id>
```

The project ID is a stable hash of the normalized Git remote. Repositories without a
remote fall back to their resolved local path. This prevents two different repositories
with the same directory name from colliding while letting different agents share memory
for the same repository.

The plugin continues reading the former Cursor `cursor_user_*` and `cursor_project_*`
tags, along with legacy tags from the other supported agents. New writes only use the
unified repository tag. Set `repoContainerTag` only when you need an explicit shared
override.

## Configuration

### Environment variables

| Variable | Description |
| --- | --- |
| `SUPERMEMORY_API_KEY` | API key (overrides all other sources) |
| `SUPERMEMORY_API_URL` / `SUPERMEMORY_BASE_URL` | Override the Supermemory API base URL |
| `SUPERMEMORY_AUTH_URL` | Override the browser-auth base URL |
| `SUPERMEMORY_REPO_TAG` | Override the unified repository container tag |
| `SUPERMEMORY_USER_TAG` | Legacy Cursor personal container to continue reading |
| `SUPERMEMORY_PROJECT_TAG` | Legacy Cursor project container to continue reading |
| `SUPERMEMORY_ISOLATE_WORKTREES` | Set to `true` to key the project container on the worktree path instead of the Git remote |
| `SUPERMEMORY_DEBUG` | Set to `true` to log hook errors to stderr |
| `CURSOR_USER_EMAIL` | Used only to find legacy Cursor personal memories |

### Global config (`~/.config/cursor/supermemory.json`)

User-wide defaults, applies to all projects.

```json
{
  "repoContainerTag": "repo_my_project__0123456789abcdef",
  "similarityThreshold": 0.55,
  "maxMemories": 10,
  "maxProjectMemories": 5,
  "injectProfile": true,
  "signalExtraction": false,
  "signalKeywords": ["remember", "architecture", "decision", "bug", "fix"],
  "signalTurnsBefore": 3
}
```

### Project config (`.cursor/.supermemory/config.json`)

Per-workspace overrides. Add to `.gitignore` if it contains an API key. Project config
wins over global config.

```json
{
  "apiKey": "sm_...",
  "repoContainerTag": "repo_my_project__0123456789abcdef",
  "similarityThreshold": 0.55,
  "maxMemories": 10,
  "maxProjectMemories": 5,
  "injectProfile": true
}
```

| Option | Description | Default |
| --- | --- | --- |
| `apiKey` | Project-specific API key | none |
| `baseUrl` | Override the Supermemory API base URL | Supermemory API |
| `repoContainerTag` | Override the unified repository container | derived from normalized Git remote or project path |
| `userContainerTag` | Legacy Cursor personal container to continue reading | none |
| `projectContainerTag` | Legacy Cursor project container to continue reading | none |
| `similarityThreshold` | Minimum similarity for prompt recall. Values below `0.55` are floored. | `0.55` |
| `maxMemories` | Max project memories injected at session start | `10` |
| `maxProjectMemories` | Max project memories injected at session start | `5` |
| `injectProfile` | Whether to inject user profile at session start | `true` |
| `signalExtraction` | Capture only turns containing durable-signal keywords | `false` |
| `signalKeywords` | Keywords that trigger signal-based capture | `remember`, `architecture`, `decision`, `bug`, `fix` |
| `signalTurnsBefore` | Number of nearby turns retained around a signal | `3` |

You can set these via the AI using `supermemory_set_config`, or create/edit the file
manually.

## Commands

Available in Cursor chat, alongside the CLI subcommands they wrap:

| Command | CLI equivalent | Description |
| --- | --- | --- |
| `/supermemory-setup` | `cli.js login` | Connect your Supermemory account |
| `/supermemory-status` | `cli.js status` | Check authentication and live connectivity |
| `/supermemory-logout` | `cli.js logout` | Remove stored credentials (memories are not deleted) |
| `/supermemory-config` | none | Create or edit the project config file |

<details>
<summary>Development</summary>
<br>

```bash
bun install
bun run build   # compiles all dist/ files
```

**Testing from this repo:**

1. Run `bun install && bun run build`.
2. Run `bun run sync` to copy this repository to `~/.cursor/plugins/local/cursor-supermemory` (Cursor rejects symlinks pointing outside its plugins directory; re-run after every change).
3. Run `node dist/cli.js login`.
4. Restart Cursor after changing MCP configuration.

To test in a different project, add the `supermemory` entry from `.cursor/mcp.json` to
that project's MCP config with an absolute path to this repo's `dist/cli.js` (keep the
`mcp` argument; `${workspaceFolder}` would point at the wrong project there).

</details>

## License

MIT

---

<div align="center">
<sub>◪ marks lines recalled from Supermemory in the agent's responses.</sub>
</div>
