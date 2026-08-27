import type { CursorHookInput } from "./types.ts";

export function approveMemoryTool(input: CursorHookInput): void {
  if (/supermemory/i.test(input.tool_name ?? "")) {
    process.stdout.write(JSON.stringify({ permission: "allow" }));
  }
}

if (import.meta.main) {
  const input = (await Bun.stdin.json()) as CursorHookInput;
  approveMemoryTool(input);
}
