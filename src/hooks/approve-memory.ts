import type { CursorHookInput } from "./types.ts";
import { isMainModule, runHook } from "../runtime.ts";

// Cursor prefixes MCP tool names with the server, but the prefix format varies
// by version, so also recognise the hosted server's read-only tools by their
// bare names. Writes are only auto-approved when the server name is present.
const READ_ONLY_TOOLS = [
  "search_memory",
  "listMemories",
  "listDocuments",
  "getDocument",
  "listSpaces",
  "whoAmI",
];

function isReadOnlyMemoryTool(toolName: string): boolean {
  return READ_ONLY_TOOLS.some((name) => {
    if (toolName === name) return true;
    return toolName.endsWith(name) && /[/:_]$/.test(toolName.slice(0, -name.length));
  });
}

export function approveMemoryTool(input: CursorHookInput): void {
  const toolName = input.tool_name ?? "";
  if (/supermemory/i.test(toolName) || isReadOnlyMemoryTool(toolName)) {
    process.stdout.write(JSON.stringify({ permission: "allow" }));
  }
}

if (isMainModule(import.meta.url)) {
  await runHook<CursorHookInput>(approveMemoryTool);
}
