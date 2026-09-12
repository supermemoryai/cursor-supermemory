import { expect, test } from "bun:test";
import { approveMemoryTool } from "./approve-memory.ts";

function permissionFor(toolName: string): string {
  const write = process.stdout.write.bind(process.stdout);
  let output = "";
  process.stdout.write = ((chunk: string) => {
    output += chunk;
    return true;
  }) as typeof process.stdout.write;
  try {
    approveMemoryTool({ tool_name: toolName } as never);
  } finally {
    process.stdout.write = write;
  }
  return output;
}

test("approves hosted Supermemory tools under any server prefix", () => {
  expect(permissionFor("mcp__supermemory__search_memory")).toContain("allow");
  expect(permissionFor("MCP: supermemory/add_memory")).toContain("allow");
  expect(permissionFor("search_memory")).toContain("allow");
  expect(permissionFor("listSpaces")).toContain("allow");
});

test("stays out of the way for unrelated tools and unprefixed writes", () => {
  expect(permissionFor("read_file")).toBe("");
  expect(permissionFor("add_memory")).toBe("");
});
