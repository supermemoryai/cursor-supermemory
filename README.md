# Cursor Supermemory

Persistent AI memory for Cursor — powered by [Supermemory](https://supermemory.ai).

## Installation

> Requires [Bun](https://bun.sh) on your PATH. Cursor runs the plugin's memory hooks with Bun.

Open **Customize** in Cursor, find **Supermemory**, select **Install**, and choose a project or user scope. Restart Cursor or run **Developer: Reload Window** after installation.

Connect your Supermemory account:

```bash
bunx --bun cursor-supermemory@latest login
```

## What it does

- **Session context** — loads your persistent profile when a Cursor conversation starts
- **Automatic recall** — searches on substantive prompts, deduplicates results, and injects them after the first tool result supported by Cursor
- **Incremental capture** — saves each completed turn and retries unsaved transcript deltas at session end
- **MCP tools** — available in every Cursor AI session for explicit memory control
- **Context gatherer** — fans out targeted searches before substantial work
- **Always-on rule** — makes the agent recall relevant history proactively

## MCP Tools

| Tool | Description |
|---|---|
| `supermemory_get_config` | Show current config, resolved container tags, and config file paths |
| `supermemory_set_config` | Update config at project or global scope |
| `supermemory_containers` | Show what `user` and `project` container tags resolve to |
| `supermemory_search` | Search memories by query |
| `supermemory_add` | Save new information to memory |
| `supermemory_list` | List stored memories |
| `supermemory_forget` | Delete a memory by id or content |
| `supermemory_profile` | Get your user profile summary |

All tools that accept a `container` argument support:
- `"user"` (default) — personal memories for the current repository
- `"project"` — project knowledge for the current repository
- `"both"` — both scopes plus compatible legacy memories
- any custom string — used as a raw container tag

`user` and `project` now write to the same repository container. The
`sm_scope` metadata field keeps personal/session memories separate from
explicit project knowledge when an agent requests one scope.

## Configuration

### Environment variables

| Variable | Description |
|---|---|
| `SUPERMEMORY_API_KEY` | API key (overrides all other sources) |
| `SUPERMEMORY_API_URL` | Override the Supermemory API base URL |
| `SUPERMEMORY_REPO_TAG` | Override the unified repository container tag |
| `SUPERMEMORY_USER_TAG` | Legacy Cursor personal container to continue reading |
| `SUPERMEMORY_PROJECT_TAG` | Legacy Cursor project container to continue reading |
| `CURSOR_USER_EMAIL` | Used only to find legacy Cursor personal memories |

### Global config — `~/.config/cursor/supermemory.json`

User-wide defaults, applies to all projects.

```json
{
  "repoContainerTag": "repo_my_project__0123456789abcdef",
  "similarityThreshold": 0.3,
  "maxMemories": 10,
  "maxProjectMemories": 5,
  "injectProfile": true,
  "signalExtraction": false,
  "signalKeywords": ["remember", "architecture", "decision", "bug", "fix"],
  "signalTurnsBefore": 3
}
```

### Project config — `.cursor/.supermemory/config.json`

Per-workspace overrides. Add to `.gitignore` if it contains an API key. Project config wins over global config.

```json
{
  "apiKey": "sm_...",
  "repoContainerTag": "repo_my_project__0123456789abcdef",
  "similarityThreshold": 0.3,
  "maxMemories": 10,
  "maxProjectMemories": 5,
  "injectProfile": true
}
```

| Option | Description | Default |
|---|---|---|
| `apiKey` | Project-specific API key | — |
| `baseUrl` | Override the Supermemory API base URL | Supermemory API |
| `repoContainerTag` | Override the unified repository container | derived from normalized Git remote or project path |
| `userContainerTag` | Legacy Cursor personal container to continue reading | — |
| `projectContainerTag` | Legacy Cursor project container to continue reading | — |
| `similarityThreshold` | Minimum similarity score for search results | `0.3` |
| `maxMemories` | Max project memories injected at session start | `10` |
| `maxProjectMemories` | Max project memories injected at session start | `5` |
| `injectProfile` | Whether to inject user profile at session start | `true` |
| `signalExtraction` | Capture only turns containing durable-signal keywords | `false` |
| `signalKeywords` | Keywords that trigger signal-based capture | `remember`, `architecture`, `decision`, `bug`, `fix` |
| `signalTurnsBefore` | Number of nearby turns retained around a signal | `3` |

You can set these via the AI using `supermemory_set_config`, or create/edit the file manually.

## Container tags

Cursor, Claude Code, Codex, and OpenCode use the same repository tag:

```text
repo_<project_name>__<project_id>
```

The project ID is a stable hash of the normalized Git remote. Repositories
without a remote fall back to their resolved local path. This prevents two
different repositories with the same directory name from colliding while
letting different agents share memory for the same repository.

The plugin continues reading the former Cursor `cursor_user_*` and
`cursor_project_*` tags, along with legacy tags from the other supported
agents. New writes only use the unified repository tag. Set
`repoContainerTag` only when you need an explicit shared override.

## Development

```bash
bun install
bun run build   # compiles all dist/ files
```

### Testing from this repo

1. Run `bun install && bun run build`.
2. Copy or symlink this repository to `~/.cursor/plugins/local/cursor-supermemory`.
3. Run `bun run src/cli.ts login`.
4. Restart Cursor after changing MCP configuration.

To test in a different project, add the `supermemory` entry from `.cursor/mcp.json` to that project's MCP config with an absolute path to `dist/mcp-server.js`.
