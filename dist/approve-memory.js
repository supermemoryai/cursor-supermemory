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

// src/hooks/approve-memory.ts
function approveMemoryTool(input) {
  if (/supermemory/i.test(input.tool_name ?? "")) {
    process.stdout.write(JSON.stringify({ permission: "allow" }));
  }
}
if (isMainModule(import.meta.url)) {
  await runHook(approveMemoryTool);
}
export {
  approveMemoryTool
};
