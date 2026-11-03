import { expect, test } from "bun:test";
import { approveMemoryTool } from "./approve-memory.ts";

function permissionFor(toolName: string, mcpServerName?: string): string {
  const write = process.stdout.write.bind(process.stdout);
  let output = "";
  process.stdout.write = ((chunk: string) => {
    output += chunk;
    return true;
  }) as typeof process.stdout.write;
  try {
    approveMemoryTool({ tool_name: toolName, mcp_server_name: mcpServerName } as never);
  } finally {
    process.stdout.write = write;
  }
  return output;
}

test("approves read-only tools on the Supermemory server", () => {
  for (const server of [
    "plugin-supermemory-supermemory",
    "plugin-cursor-supermemory-supermemory",
    "user-supermemory",
    "project-0-repo-supermemory",
    "supermemory",
  ]) {
    expect(permissionFor("search_memory", server)).toContain("allow");
  }
  for (const tool of [
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
  ]) {
    expect(permissionFor(tool, "plugin-supermemory-supermemory")).toContain("allow");
  }
  expect(permissionFor("mcp__supermemory__search_memory")).toContain("allow");
  expect(permissionFor("MCP:supermemory:list_documents")).toContain("allow");
});

test("leaves writes and account-wide changes to the user", () => {
  for (const tool of [
    "add_memory",
    "forget_memory",
    "save-memory",
    "guided-save",
    "set-active-tag",
    "select-space",
    "upload-file",
    "prepare-file-upload",
  ]) {
    expect(permissionFor(tool, "plugin-supermemory-supermemory")).toBe("");
  }
  expect(permissionFor("MCP: supermemory/add_memory")).toBe("");
  expect(permissionFor("mcp__supermemory__forget_memory")).toBe("");
});

test("leaves other servers' tools alone, even with the same names", () => {
  expect(permissionFor("MCP:mem0:search_memory")).toBe("");
  expect(permissionFor("mcp__mem0__list_memories")).toBe("");
  expect(permissionFor("search_memory", "user-mem0")).toBe("");
  expect(permissionFor("search_memory", "plugin-mem0-supermemory")).toBe("");
  expect(permissionFor("search_memory", "user-not-supermemory-mcp")).toBe("");
  expect(permissionFor("read_file", "plugin-supermemory-supermemory")).toBe("");
});

test("waits for the server name when the tool name has none", () => {
  expect(permissionFor("MCP:search_memory")).toBe("");
  expect(permissionFor("search_memory")).toBe("");
  expect(permissionFor("listSpaces")).toBe("");
});
