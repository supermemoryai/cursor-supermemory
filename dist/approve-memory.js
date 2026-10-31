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
var READ_ONLY_TOOLS = new Set([
  "search_memory",
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
  "fetch-graph-data"
]);
var SUPERMEMORY_SERVER = /^(?:user-|project-.+-|plugin-(?:cursor-)?supermemory-)?supermemory$/i;
function splitToolName(toolName) {
  const name = toolName.replace(/^MCP:\s*/, "");
  const mcp = /^mcp__(.+?)__(.+)$/.exec(name);
  if (mcp)
    return { server: mcp[1], tool: mcp[2] };
  const qualified = /^(.+)[/:](.+)$/.exec(name);
  if (qualified)
    return { server: qualified[1].trim(), tool: qualified[2] };
  return { tool: name };
}
function approveMemoryTool(input) {
  const parsed = splitToolName(input.tool_name ?? "");
  const server = input.mcp_server_name ?? parsed.server;
  if (!server || !SUPERMEMORY_SERVER.test(server))
    return;
  if (!READ_ONLY_TOOLS.has(parsed.tool))
    return;
  process.stdout.write(JSON.stringify({ permission: "allow" }));
}
if (isMainModule(import.meta.url)) {
  await runHook(approveMemoryTool);
}
export {
  approveMemoryTool
};
