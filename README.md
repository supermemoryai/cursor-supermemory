# cursor-supermemory

Persistent AI memory for Cursor — powered by [Supermemory](https://supermemory.ai).

## Install

Install the Cursor integration package:

```bash
npm install cursor-supermemory@latest
```

After it finishes, restart Cursor or run **Developer: Reload Window**.

If you only need to authenticate an existing install, run:

```bash
bunx cursor-supermemory@latest login
```

## What it does

- **Session hooks** — injects relevant memories at session start; saves conversation highlights at session end
- **MCP tools** — available in every Cursor AI session for explicit memory control
- **Always-on rule** — reminds the AI to use memory tools proactively

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
- `"user"` (default) — personal memory, shared across all projects
- `"project"` — scoped to the current workspace
- any custom string — used as a raw container tag

## Configuration

### Environment variables

| Variable | Description |
|---|---|
| `SUPERMEMORY_API_KEY` | API key (overrides all other sources) |
| `SUPERMEMORY_USER_TAG` | Override the personal container tag |
| `SUPERMEMORY_PROJECT_TAG` | Override the project container tag |
| `CURSOR_USER_EMAIL` | Used to derive the user container tag |

### Global config — `~/.config/cursor/supermemory.json`

User-wide defaults, applies to all projects.

```json
{
  "userContainerTag": "my-personal-tag",
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
  "projectContainerTag": "my-team-backend",
  "userContainerTag": "my-personal-tag",
  "similarityThreshold": 0.3,
  "maxMemories": 10,
  "maxProjectMemories": 5,
  "injectProfile": true
}
```

| Option | Description | Default |
|---|---|---|
| `apiKey` | Project-specific API key | — |
| `userContainerTag` | Override personal memory container | auto-derived from git email / machine id |
| `projectContainerTag` | Override project memory container | auto-derived from git root / cwd |
| `similarityThreshold` | Minimum similarity score for search results | `0.3` |
| `maxMemories` | Max project memories injected at session start | `10` |
| `maxProjectMemories` | Max project memories injected at session start | `5` |
| `injectProfile` | Whether to inject user profile at session start | `true` |

You can set these via the AI using `supermemory_set_config`, or create/edit the file manually.

## Container tags

By default, container tags are derived automatically:

- **User tag** — hashed from your git email, `CURSOR_USER_EMAIL`, or machine id. Consistent across projects.
- **Project tag** — hashed from your git repo root (or cwd). Consistent across team members on the same repo.

To share project memory with your team, set the same `projectContainerTag` in everyone's project config.

## Development

```bash
bun install
bun run build   # compiles all dist/ files
```

### Testing from this repo

1. **Open this repo in Cursor** — rules, commands, skills, and hooks are picked up from `.cursor-plugin`.
2. **Build:** `bun run build`
3. **Use the local MCP server** — `.cursor/mcp.json` in this repo points to `dist/` automatically.
4. **Log in:** `bun run src/cli.ts login`
5. **Restart Cursor** after changing `.cursor/mcp.json`.

To test in a different project, add the `supermemory` entry from `.cursor/mcp.json` to that project's MCP config with an absolute path to `dist/mcp-server.js`.
