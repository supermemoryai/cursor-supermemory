// src/hook-state.ts
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
function statePath(conversationId) {
  const id = createHash("sha256").update(conversationId || "unknown").digest("hex").slice(0, 32);
  return join(homedir(), ".supermemory-cursor", "hook-state", `${id}.json`);
}
function readHookState(conversationId) {
  try {
    return JSON.parse(readFileSync(statePath(conversationId), "utf8"));
  } catch {
    return {};
  }
}
function writeHookState(conversationId, updates) {
  const filePath = statePath(conversationId);
  mkdirSync(join(homedir(), ".supermemory-cursor", "hook-state"), {
    recursive: true,
    mode: 448
  });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify({ ...readHookState(conversationId), ...updates })}
`, { mode: 384 });
  renameSync(tempPath, filePath);
}

// src/hooks/types.ts
function conversationId(input) {
  return input.conversation_id || input.session_id || "unknown";
}

// src/runtime.ts
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
async function readStdinText() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function readStdinJson() {
  return JSON.parse(await readStdinText());
}
function isMainModule(metaUrl) {
  const entry = process.argv[1];
  if (!entry)
    return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return pathToFileURL(entry).href === metaUrl;
  }
}
async function runHook(handler, fallback = { continue: true }) {
  const write = process.stdout.write.bind(process.stdout);
  let answered = false;
  process.stdout.write = (...args) => {
    answered = true;
    return write(...args);
  };
  try {
    await handler(await readStdinJson());
  } catch (error) {
    if (process.env.SUPERMEMORY_DEBUG === "true") {
      console.error("[supermemory] hook failed:", error);
    }
    if (!answered)
      write(JSON.stringify(fallback));
  } finally {
    process.stdout.write = write;
  }
}

// src/hooks/inject-recall.ts
function injectPendingRecall(input) {
  const id = conversationId(input);
  const state = readHookState(id);
  if (!state.pendingContext) {
    return;
  }
  writeHookState(id, {
    pendingContext: undefined,
    pendingGeneration: undefined
  });
  process.stdout.write(JSON.stringify({ additional_context: state.pendingContext }));
}
if (isMainModule(import.meta.url)) {
  await runHook(injectPendingRecall, {});
}
export {
  injectPendingRecall
};
