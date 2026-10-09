# Cursor Supermemory

Persistent AI memory for Cursor — powered by [Supermemory](https://supermemory.ai).

## Installation

> Requires [Node.js 18 or newer](https://nodejs.org) on your PATH. Hooks and the MCP proxy run the plugin's bundled `dist/` with Node, including the official Supermemory SDK. No runtime dependency installation is needed. Bun is only needed to *build* the plugin.

Open **Customize** in Cursor, find **Supermemory**, select **Install**, and choose a project or user scope. Restart Cursor or run **Developer: Reload Window** after installation. The public catalog is manually reviewed and can lag this repository: the audited public listing pins SDK4/local-MCP version **1.1.0**, not this source artifact. A source merge is not a native catalog update.

Connect your Supermemory account:

```bash
node "$(ls -d ~/.cursor/plugins/local/cursor-supermemory ~/.cursor/plugins/cache/*/cursor-supermemory/*/ 2>/dev/null | head -1)/dist/cli.js" login
```

Every host names the install path after itself — Cursor sets `CURSOR_PLUGIN_ROOT`,
Claude Code and Grok set `CLAUDE_PLUGIN_ROOT`, Grok also sets `GROK_PLUGIN_ROOT` —
so the command above finds the install itself and works from any directory.

### Upgrade channels

This repository's **1.2.4 source artifact** has SDK-backed v5 REST hooks and explicit hosted/local MCP modes. Existing 1.2.x hosted-proxy installations retain hosted mode by default. **Catalog 1.1.0 users MUST select local mode before updating** to preserve their eight local tool interfaces; there is no reliable installed-generation marker and no automatic mode conversion. See [Local MCP compatibility](#local-mcp-compatibility). Source availability does not establish a public catalog refresh or native upgrade.

Keep your existing global/project config, credentials and hook-state files. The update does not rewrite them or upload historical transcripts. Existing container-tag strings are used unchanged as v5 namespaces, with canonical and legacy reads retained. A native manager update must be checked separately; the verified transition is an isolated artifact replacement with recoverable original files.

The published npm **1.0.0** package is a different, older product with a local MCP server, different tools and installation wiring. This change does **not** publish 1.2.4 over that package or promise an in-place npm upgrade. npm users should retain their current install until a dedicated upgrade is available. Existing namespace overrides should be copied with their exact values only after reviewing the different config paths below; no automated conversion of the npm product is included.

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

### Local MCP compatibility

Set `"mcpMode": "local"` in your existing global/project config, preserving every other key, or set `SUPERMEMORY_MCP_MODE=local` in the MCP launch environment. The existing `cli.js mcp` registration then starts the restored local server. `cli.js mcp-local` explicitly selects the same server without changing registrations or stored settings. A valid explicit command overrides a valid mode setting; invalid mode strings fail closed. Values are exactly lowercase `local` or `hosted`, and the environment overrides merged project/global config. No mode is inferred from namespace, credential or state files.

The eight aliases are `supermemory_get_config`, `supermemory_set_config`, `supermemory_containers`, `supermemory_search`, `supermemory_add`, `supermemory_profile`, `supermemory_list` and `supermemory_forget`. Every call retains its required absolute `workspaceRoot`; keys, base URLs, config and namespace aliases are resolved for that workspace, not the server's startup cwd. `container: "user"` and `"project"` use the same canonical namespace with personal/project metadata; `"both"` is a read alias, and arbitrary custom containers retain their exact strings. The `supermemory_list` alias lists **documents**, as the old SDK implementation did; it never silently becomes a formed-memory list.

Local core operations use SDK5 on the hosted API or explicitly upgraded custom servers, and pinned SDK4.11.1 on explicitly selected legacy/custom servers. Local search retains hybrid mode, its caller limit and the legacy 0.6 server threshold, separately from automatic hook recall's 0.55 memories-only search. Local tools retain the 60-second per-attempt timeout and a maximum of two SDK retries, not identical retry policies: SDK5 does not retry 409 responses or attempt timeouts as SDK4 does. A five-minute outer abort cancels active requests and response bodies, but an SDK retry sleep can delay returning the abort. The transport rejects already-aborted signals before constructing another request. Automatic hooks remain at three seconds/zero retries. A retry-capable explicit save is not proof of exactly-once billing.

The SDKs use bundled node-fetch 3.3.2 with keep-alive agents as their supported custom fetch implementation in local mode. This keeps timeout/body cancellation working on the minimum Node 18.0 runtime; the hosted proxy and automatic-hook transports remain unchanged.

Exact-ID forgetting uses SDK5 memory IDs in one namespace per request and verifies the returned count/matches/errors. Exact-content forgetting has no equivalent SDK5 operation, so that **explicit tool argument** uses the pinned SDK4 exact-content endpoint at the same configured base URL, even when core operations use v5. It never calls semantic deletion or retries a failed v5 operation on another version. Legacy-route availability is server-dependent; failure is reported rather than rerouted. Any incomplete/invalid namespace outcome sets the MCP error flag and reports confirmed outcomes plus failed namespaces; successful changes aren't rolled back automatically.

Local mode does not connect to hosted MCP for initialization or tool discovery. The eight tools and their local config operations work without hosted MCP access. Selecting local mode changes the protocol surface deliberately; it is **not** a transparent default upgrade of catalog 1.1.0.

#### Explicit catalog 1.1.0 transition

The cold-artifact transition was verified with the exact catalog revision `83c5968`, not with a native Cursor manager. Use these steps only for a deliberate source/local trial; publishing or refreshing the public catalog is a separate authorized action.

1. Stop active Cursor agents/hooks. Copy the complete old plugin artifact outside auto-discovered plugin roots, and privately back up `~/.config/cursor/supermemory.json`, each project's `.cursor/.supermemory/config.json`, `~/.supermemory-cursor/` (credentials and hook state), and user/project MCP or hook registrations. Preserve permissions; do not place credential backups in a repository or shared drive.
2. **Before replacing the artifact**, add `SUPERMEMORY_MCP_MODE=local` to the existing MCP launch environment or add `"mcpMode": "local"` to the existing config without deleting other fields. The old plugin ignores this new selector, and the new `cli.js mcp` consumes it. Keep every namespace override and REST base/key unchanged. Older custom servers keep legacy REST unless you explicitly opt into v5 after upgrading them.
3. Retain the old registration and artifact as rollback material. Replace only the selected plugin artifact with the exact 1.2.4 candidate. If using a local import instead of a manager update, remove/disable the conflicting marketplace installation as required by Cursor's same-name precedence and confirm your policy permits local imports; do not run duplicate old/new hooks. No installer silently rewrites files or registrations.
4. Reload Cursor and verify the effective artifact/version and the eight `supermemory_*` tools. Check `supermemory_get_config` with the active absolute workspace path, including any second workspace. Keep the local tool arguments and document/memory ID distinction; the hosted proxy is not an interchangeable local tool server.
5. If the native manager/import or tools do not match, stop the new instance and restore the archived artifact/registrations. Restore original settings only if intentionally changed; preserve any newly acknowledged cursor state or new saved data rather than replaying old transcripts. The isolated probe preserves old cursors, pending recall and original files, but a native manager upgrade still needs its own verification.

## Commands

| Command | Description |
|---|---|
| `/supermemory-index` | Index codebase architecture and patterns into Supermemory |
| `/supermemory-config` | Configure Supermemory settings for this project |
| `/supermemory-setup` | Connect Supermemory to Cursor |
| `/supermemory-status` | Check authentication and live connectivity |
| `/supermemory-logout` | Disconnect Supermemory from Cursor |

## Configuration

### Environment variables

| Variable | Description |
|---|---|
| `SUPERMEMORY_API_KEY` | API key (overrides all other sources) |
| `SUPERMEMORY_API_URL` | Override the Supermemory API base URL |
| `SUPERMEMORY_BASE_URL` | API base URL fallback when `SUPERMEMORY_API_URL` is unset |
| `SUPERMEMORY_API_VERSION` | Explicit `v5` or `legacy` REST contract; overrides config `apiVersion` |
| `SUPERMEMORY_MCP_URL` | Independent hosted MCP proxy endpoint; REST version selection does not change it |
| `SUPERMEMORY_MCP_API_KEY` | Independent proxy credential; overrides the shared REST key only for hosted/proxy mode |
| `SUPERMEMORY_MCP_MODE` | Explicit `local` or `hosted` MCP mode; overrides config `mcpMode` |
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
| `apiVersion` | `v5` or `legacy`; choose explicitly for an upgraded custom server | v5 for the hosted API root, legacy for custom endpoints |
| `mcpMode` | `local` restores the eight catalog-era tools; `hosted` uses the current proxy | `hosted` |
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

### REST compatibility

The hosted API root (`https://api.supermemory.ai`, including equivalent case/default-port/trailing-slash spellings) defaults to v5. Custom URLs keep the v3/v4 REST contract by default, including their path prefix and bearer key, so older self-hosted servers below 0.0.9 remain usable. After upgrading your custom server, opt into v5 with `"apiVersion": "v5"` or `SUPERMEMORY_API_VERSION=v5`. An explicit `legacy` also supports hosted rollback if that server still serves v3/v4. Invalid versions fail the memory operation; there is no failed-write version probing or fallback to the hosted API.

Recall explicitly uses memories search, threshold `0.55`, ten candidates per namespace, no reranking or query rewriting. The existing local configured threshold floor, five-result cap, excerpts and session dedup remain. Session context uses query-free profiles and renders both old string facts and v5 object facts. Reads and capture retain the three-second request budget and zero automatic transport retries. Capture keeps its generation IDs and POST append/diff semantics, advancing its cursor only on valid document acceptance; acceptance is not completed processing or exactly-once billing. Dynamic processing is retained and can delay newly recallable facts by minutes; no billable instant processing is enabled.

These are client contract guarantees, not a live-backend historical-data/ranking parity claim. No namespace move, merge, deletion or backfill is performed. Hosted MCP tool schemas and approvals remain unchanged because MCP is a separate protocol.

The hosted proxy still respects `SUPERMEMORY_MCP_URL`. With a custom REST base and the hosted MCP destination, it fails closed unless `SUPERMEMORY_MCP_API_KEY` explicitly supplies an independent credential; it never sends custom REST credentials to hosted MCP merely to discover tools. An explicitly configured custom MCP endpoint still uses its configured/shared credential as before. Endpoint case/default-port spellings do not bypass the guard. Notices do not echo key material or backend response details.

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
bun install --frozen-lockfile
bun run build   # compiles all dist/ files
bun run typecheck && bun test
bun run check:dist   # after committing the rebuilt dist/, rejects bundle drift
```

Build with Bun 1.3.14 and the committed lockfile. The six existing entrypoints stay in `dist/`; the additive standalone `mcp-server.js` is loaded only in local mode. The SDK5 hooks, local MCP SDK5/SDK4 boundaries, MCP implementation and schema libraries are all bundled; no runtime node_modules is needed. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the copied upstream licenses are generated from the local bundle's included modules. The packed source also includes the lockfile, build script and typecheck config for reproduction.

### Testing from this repo

1. Run `bun install && bun run build`.
2. Run `bun run sync` to copy this repository to `~/.cursor/plugins/local/cursor-supermemory` (Cursor rejects symlinks pointing outside its plugins directory; re-run after every change).
3. Run `node dist/cli.js login`.
4. Restart Cursor after changing MCP configuration.

To test in a different project, add the `supermemory` entry from `.cursor/mcp.json` to that project's MCP config with an absolute path to this repo's `dist/cli.js` (keep the `mcp` argument — `${workspaceFolder}` would point at the wrong project there).

## Other hosts and Cloud Agents

`${CURSOR_PLUGIN_ROOT}` only exists in Cursor. Grok expands `${GROK_PLUGIN_ROOT}`,
`${CLAUDE_PLUGIN_ROOT}` and their `_DATA` pairs and nothing else, so a Cursor-only
token reaches `node` verbatim and resolves against the working directory. Cursor
Cloud Agents hand `mcp.json` to the exec daemon without expanding anything at all.

Neither `mcp.json` nor `hooks/hooks.json` depends on one host's token any more.
Both launch `node -e` with no path of their own and locate the install in order:
the plugin root a host expanded into the argument, then `CURSOR_PLUGIN_ROOT`,
`CLAUDE_PLUGIN_ROOT` or `GROK_PLUGIN_ROOT` from the environment (a value still
reading `${...}` is ignored), then a copy under `~/.cursor/plugins`,
`~/.grok/installed-plugins`, `~/.grok/plugins` or `~/.claude/plugins`. Grok also
reads `.claude-plugin/plugin.json`, which it discovers where `.cursor-plugin/` means
nothing to it. Hooks fail open when no root resolves; the MCP entry reports it.

Cloud Agents have no browser for the login flow, so set `SUPERMEMORY_API_KEY` in the
agent environment. That is the only required Cloud Agent step.

If an environment installs the plugin somewhere else entirely — none of those
directories and no usable plugin root — run this from the plugin directory to
register an absolute entry:

```bash
node dist/cli.js mcp-install
```

It writes a `supermemory` entry with an absolute path into `~/.cursor/mcp.json`,
which needs no variable expansion. Hooks keep working either way.
