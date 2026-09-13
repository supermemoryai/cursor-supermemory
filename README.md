# Cursor Supermemory

Persistent AI memory for Cursor — powered by [Supermemory](https://supermemory.ai).

## Installation

> Requires [Node.js](https://nodejs.org) on your PATH. Hooks and the MCP proxy run the plugin's bundled `dist/` with Node. Bun is only needed to *build* the plugin.

Open **Customize** in Cursor, find **Supermemory**, select **Install**, and choose a project or user scope. Restart Cursor or run **Developer: Reload Window** after installation.

Connect your Supermemory account:

```bash
node "$(ls -d ~/.cursor/plugins/local/cursor-supermemory ~/.cursor/plugins/cache/*/cursor-supermemory/*/ 2>/dev/null | head -1)/dist/cli.js" login
```

Cursor only sets `CURSOR_PLUGIN_ROOT` for plugin hooks, so the command above finds
the install itself and works from any directory.

## What it does

- **Session context** — loads your persistent profile when a Cursor conversation starts
- **Automatic recall** — searches on substantive prompts, deduplicates results, and injects them after the first tool result supported by Cursor
- **Incremental capture** — saves each completed turn and retries unsaved transcript deltas at session end
- **MCP tools** — the hosted Supermemory tools, proxied over stdio for explicit memory control
- **Context gatherer** — fans out targeted searches before substantial work
- **Always-on rule** — makes the agent recall relevant history proactively

## MCP Tools

The plugin proxies the hosted Supermemory MCP server (`https://mcp.supermemory.ai/mcp`)
over stdio, using the same credentials as the hooks — one login covers both.
Claude Code and Codex use the same server, so all three agents see one tool set:

| Tool | Description |
|---|---|
| `search_memory` | Search memories in one container, with that container's profile summary |
| `add_memory` | Save a memory, or forget one that is outdated |
| `listMemories` | List recent memories with their IDs |
| `listDocuments` / `getDocument` | Browse and read stored documents |
| `listSpaces` / `whoAmI` | Resolve a named space, or report the active account and space |
| `save-memory` / `guided-save` | Alternate save flows exposed by the hosted server |
| `upload-file` / `prepare-file-upload` | Attach a file to a space |
| `memory-graph` / `fetch-graph-data` | Explore the memory graph |
| `select-space` / `set-active-tag` | Change the account's active space |

The first five rows are what the bundled rule, skills, and agent use. The rest
come from the hosted server and appear in `tools/list` as well; the two
`select-space` / `set-active-tag` tools change account-wide state, so prefer
passing `containerTag` per call over switching the active space.

Pass `containerTag` on every call, using the tag from the
`<supermemory-context>` block the session-start hook injects. Without it the
hosted server writes to the account's active space, and this project's hook
recall will not find the memory. The bundled rule, skills, and context-gatherer
agent all carry that instruction.

Config lives in files rather than tools: see [Configuration](#configuration) or
run the `/supermemory-config` command.

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
  "similarityThreshold": 0.55,
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
  "similarityThreshold": 0.55,
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
| `similarityThreshold` | Minimum similarity for prompt recall. Values below `0.55` are floored. | `0.55` |
| `maxMemories` | Max project memories injected at session start | `10` |
| `maxProjectMemories` | Max project memories injected at session start | `5` |
| `injectProfile` | Whether to inject user profile at session start | `true` |
| `signalExtraction` | Capture only turns containing durable-signal keywords | `false` |
| `signalKeywords` | Keywords that trigger signal-based capture | `remember`, `architecture`, `decision`, `bug`, `fix` |
| `signalTurnsBefore` | Number of nearby turns retained around a signal | `3` |

Create or edit the config file directly, or run the `/supermemory-config` command.

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
2. Run `bun run sync` to copy this repository to `~/.cursor/plugins/local/cursor-supermemory` (Cursor rejects symlinks pointing outside its plugins directory; re-run after every change).
3. Run `node dist/cli.js login`.
4. Restart Cursor after changing MCP configuration.

To test in a different project, add the `supermemory` entry from `.cursor/mcp.json` to that project's MCP config with an absolute path to this repo's `dist/cli.js` (keep the `mcp` argument — `${workspaceFolder}` would point at the wrong project there).

## Cloud Agents

Cursor Cloud Agents pass the plugin's `mcp.json` to the exec daemon without
expanding `${CURSOR_PLUGIN_ROOT}`, and they have no browser for the login flow.

The `mcp.json` entry handles the first half on its own: it launches `node -e`
with no path of its own, then locates the install from `CURSOR_PLUGIN_ROOT`
when that resolved, and otherwise from `~/.cursor/plugins`. Nothing to run.

For the second half, set `SUPERMEMORY_API_KEY` in the agent environment. That
is the only required Cloud Agent step.

If an environment installs the plugin somewhere else entirely — no
`~/.cursor/plugins` copy and no usable `CURSOR_PLUGIN_ROOT` — run this from the
plugin directory to register an absolute entry:

```bash
node dist/cli.js mcp-install
```

It writes a `supermemory` entry with an absolute path into `~/.cursor/mcp.json`,
which needs no variable expansion. Hooks keep working either way.
