import { readHookState, writeHookState } from "../hook-state.ts";
import { conversationId, type CursorHookInput } from "./types.ts";
import { isMainModule, runHook } from "../runtime.ts";

export function injectPendingRecall(input: CursorHookInput): void {
  const id = conversationId(input);
  const state = readHookState(id);
  if (!state.pendingContext) {
    return;
  }
  writeHookState(id, {
    pendingContext: undefined,
    pendingGeneration: undefined,
  });
  process.stdout.write(
    JSON.stringify({ additional_context: state.pendingContext }),
  );
}

if (isMainModule(import.meta.url)) {
  await runHook<CursorHookInput>(injectPendingRecall, {});
}
