import type { CursorHookInput } from "./types.ts";
import { isMainModule, runHook } from "../runtime.ts";

const READ_ONLY_TOOLS = new Set([
  "search_memory",
  "get_profile",
  "list_documents",
  "get_document",
  "list_memories",
  "list_spaces",
  "who_am_i",
  "listMemories",
  "listDocuments",
  "getDocument",
  "listSpaces",
  "whoAmI",
  "memory-graph",
  "fetch-graph-data",
]);

// Cursor keys MCP servers as `user-<key>`, `project-<path>-<key>` or `plugin-<plugin>-<key>`.
const SUPERMEMORY_SERVER = /^(?:user-|project-.+-|plugin-(?:cursor-)?supermemory-)?supermemory$/i;

// Split "mcp__server__tool", "server/tool" or "server:tool"; a bare tool has no server.
function splitToolName(toolName: string): { server?: string; tool: string } {
  const name = toolName.replace(/^MCP:\s*/, "");
  const mcp = /^mcp__(.+?)__(.+)$/.exec(name);
  if (mcp) return { server: mcp[1], tool: mcp[2]! };
  const qualified = /^(.+)[/:](.+)$/.exec(name);
  if (qualified) return { server: qualified[1]!.trim(), tool: qualified[2]! };
  return { tool: name };
}

// preToolUse only names the tool, so approval needs beforeMCPExecution's mcp_server_name.
export function approveMemoryTool(input: CursorHookInput): void {
  const parsed = splitToolName(input.tool_name ?? "");
  const server = input.mcp_server_name ?? parsed.server;
  if (!server || !SUPERMEMORY_SERVER.test(server)) return;
  if (!READ_ONLY_TOOLS.has(parsed.tool)) return;
  process.stdout.write(JSON.stringify({ permission: "allow" }));
}

if (isMainModule(import.meta.url)) {
  await runHook<CursorHookInput>(approveMemoryTool);
}
