# cursor-supermemory

Persistent AI memory for Cursor — powered by [Supermemory](https://supermemory.ai).

## Install

1. Install **cursor-supermemory** from the [Cursor Marketplace](https://cursor.com/marketplace).
2. Authenticate with `/supermemory-setup` (browser login), or set `SUPERMEMORY_API_KEY`.
3. Reload the window (**Developer: Reload Window**).

The plugin is the distribution. MCP and hooks run from this repo's `dist/` with Node — nothing is published to npm.

## What it does

- **Session hooks** — injects profile, recent personal/session memories, and project knowledge at session start; saves conversation highlights at session end
- **MCP tools** — available in every Cursor AI session for explicit memory control
- **Skills** — search, save, and forget load from trigger descriptions (when prior context would help, when to evaluate a save, when to delete)
- **Index command** — `/supermemory-index` for a batch codebase index
- **Always-on rule** — `workspaceRoot` plus what `user` / `project` mean; skills own when to act

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

Every tool requires `workspaceRoot` (absolute path of the active Cursor workspace).

All tools that accept a `container` argument support:
- `"user"` (default) — personal preferences and session history for this repository
- `"project"` — durable project knowledge for this repository
- `"both"` — both scopes plus compatible legacy memories (read-only)
- any custom string — used as a raw container tag

`user` and `project` write to the same repository container. The `sm_scope` metadata field keeps personal/session memories separate from explicit project knowledge.

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
  "injectProfile": true
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
| `similarityThreshold` | Stored for compatibility; search does not currently apply it | `0.3` |
| `maxMemories` | Max personal/session memories injected at session start | `10` |
| `maxProjectMemories` | Max project-knowledge memories injected at session start | `5` |
| `injectProfile` | Whether to inject user profile at session start | `true` |

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
bun run build   # compiles all dist/ files — commit them; the marketplace plugin runs from dist/
```

### Testing from this repo

1. **Open this repo in Cursor** — rules, commands, skills, and hooks are picked up from `.cursor-plugin`.
2. **Build:** `bun run build`
3. **Use the local MCP server** — `.cursor/mcp.json` in this repo points to `./dist/cli.js`.
4. **Log in:** `/supermemory-setup`, or `bun run src/cli.ts login` from this repo
5. **Restart Cursor** after changing `.cursor/mcp.json`.
