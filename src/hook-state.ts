import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface HookState {
  capturedEntries?: number;
  pendingContext?: string;
  pendingGeneration?: string;
  seenHashes?: string[];
  transcriptPath?: string;
}

function statePath(conversationId: string): string {
  const id = createHash("sha256")
    .update(conversationId || "unknown")
    .digest("hex")
    .slice(0, 32);
  return join(homedir(), ".supermemory-cursor", "hook-state", `${id}.json`);
}

export function readHookState(conversationId: string): HookState {
  try {
    return JSON.parse(readFileSync(statePath(conversationId), "utf8"));
  } catch {
    return {};
  }
}

export function writeHookState(
  conversationId: string,
  updates: Partial<HookState>,
): void {
  const filePath = statePath(conversationId);
  mkdirSync(join(homedir(), ".supermemory-cursor", "hook-state"), {
    recursive: true,
    mode: 0o700,
  });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(
    tempPath,
    `${JSON.stringify({ ...readHookState(conversationId), ...updates })}\n`,
    { mode: 0o600 },
  );
  renameSync(tempPath, filePath);
}

export function deleteHookState(conversationId: string): void {
  rmSync(statePath(conversationId), { force: true });
}
