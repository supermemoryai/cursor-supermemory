import type { CursorHookInput } from "./types.ts";
import { isMainModule, runHook } from "../runtime.ts";

export function approveMemoryTool(input: CursorHookInput): void {
  if (/supermemory/i.test(input.tool_name ?? "")) {
    process.stdout.write(JSON.stringify({ permission: "allow" }));
  }
}

if (isMainModule(import.meta.url)) {
  await runHook<CursorHookInput>(approveMemoryTool);
}
