import { afterEach, expect, test } from "bun:test";
import { deleteHookState, readHookState, writeHookState } from "../hook-state.ts";
import { injectPendingRecall } from "./inject-recall.ts";

const id = "inject-recall-test";

function captureStdout(run: () => void): string {
  const original = process.stdout.write;
  let out = "";
  process.stdout.write = ((chunk: string) => {
    out += chunk;
    return true;
  }) as typeof process.stdout.write;
  try {
    run();
  } finally {
    process.stdout.write = original;
  }
  return out;
}

afterEach(() => deleteHookState(id));

test("injects queued recall once", () => {
  writeHookState(id, { pendingContext: "ctx", pendingGeneration: "gen-1" });
  const out = captureStdout(() =>
    injectPendingRecall({ conversation_id: id, generation_id: "gen-1" }),
  );
  expect(JSON.parse(out)).toEqual({ additional_context: "ctx" });
  expect(readHookState(id).pendingContext).toBeUndefined();
});

test("still injects when the turn moved on", () => {
  writeHookState(id, { pendingContext: "ctx", pendingGeneration: "gen-1" });
  const out = captureStdout(() =>
    injectPendingRecall({ conversation_id: id, generation_id: "gen-2" }),
  );
  expect(JSON.parse(out)).toEqual({ additional_context: "ctx" });
});

test("stays silent when nothing is queued", () => {
  const out = captureStdout(() => injectPendingRecall({ conversation_id: id }));
  expect(out).toBe("");
});
