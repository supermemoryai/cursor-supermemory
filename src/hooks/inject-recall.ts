import { readHookState, writeHookState } from "../hook-state.ts";
import { conversationId, type CursorHookInput } from "./types.ts";

export function injectPendingRecall(input: CursorHookInput): void {
  const id = conversationId(input);
  const state = readHookState(id);
  if (
    !state.pendingContext ||
    (state.pendingGeneration &&
      input.generation_id &&
      state.pendingGeneration !== input.generation_id)
  ) {
    return;
  }
  process.stdout.write(
    JSON.stringify({ additional_context: state.pendingContext }),
  );
  writeHookState(id, {
    pendingContext: undefined,
    pendingGeneration: undefined,
  });
}

if (import.meta.main) {
  const input = (await Bun.stdin.json()) as CursorHookInput;
  injectPendingRecall(input);
}
