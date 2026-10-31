import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import {
  DEFAULT_MCP_URL,
  getApiKey,
  getAuthToken,
  getMcpUrl,
  loadConfig,
} from "./config.ts";
import { isAuthRequired, settleAuth } from "./auth.ts";
import { MEMORY_MARK_NOTE } from "./context.ts";
import { getResolvedTags } from "./tags.ts";

const REQUEST_TIMEOUT_MS = 30_000;
const REPO_SCOPED_TOOLS = new Set([
  "search_memory",
  "add_memory",
  "forget_memory",
  "get_profile",
  "list_memories",
  "listMemories",
  "list_documents",
  "listDocuments",
  "save-memory",
  "memory-graph",
  "fetch-graph-data",
]);
const MEMORY_RESULT_TOOLS = new Set([
  "search_memory",
  "get_profile",
  "list_memories",
  "listMemories",
]);

let sessionId: string | null = null;

interface JsonRpcMessage {
  id?: string | number | null;
  method?: unknown;
  params?: unknown;
  [key: string]: unknown;
}

type ToolCallParams = { name?: unknown; arguments?: unknown };
type TextItem = { type?: unknown; text?: unknown };

// A home or root working directory is not a project, so it gets no default space.
function repoNamespace(): string | null {
  const cwd = process.env.CURSOR_PROJECT_DIR || process.cwd();
  if (cwd === os.homedir() || cwd === path.parse(cwd).root) return null;
  try {
    return getResolvedTags(cwd, loadConfig(cwd)).canonical;
  } catch {
    return null;
  }
}

// Without a space the hosted server uses the account's active one, where hook recall never looks.
export function withRepoNamespace(
  message: JsonRpcMessage,
  namespace: string | null,
): JsonRpcMessage {
  if (!namespace || message.method !== "tools/call") return message;
  const params = message.params as ToolCallParams | undefined;
  if (typeof params?.name !== "string" || !REPO_SCOPED_TOOLS.has(params.name)) {
    return message;
  }
  const args = params.arguments ?? {};
  if (typeof args !== "object" || Array.isArray(args)) return message;
  const chosen = args as Record<string, unknown>;
  if (
    [chosen.namespace, chosen.containerTag].some(
      (value) => typeof value === "string" && value.trim(),
    )
  ) {
    return message;
  }
  return { ...message, params: { ...params, arguments: { ...chosen, namespace } } };
}

function mark(value: unknown): unknown {
  return typeof value === "string" && !value.startsWith("◪") ? `◪ ${value}` : value;
}

// Some hosts show the model structuredContent instead of text, so its memory strings carry the mark too.
function markStructured(toolName: string, structured: unknown): unknown {
  if (!structured || typeof structured !== "object") return structured;
  const data = structured as Record<string, any>;
  if (toolName === "search_memory" && Array.isArray(data.results)) {
    return { ...data, results: data.results.map((r: any) => ({ ...r, text: mark(r?.text) })) };
  }
  if (toolName === "get_profile" && data.profile && typeof data.profile === "object") {
    const facts = (list: unknown) => (Array.isArray(list) ? list.map(mark) : list);
    return {
      ...data,
      profile: { ...data.profile, static: facts(data.profile.static), dynamic: facts(data.profile.dynamic) },
    };
  }
  if (Array.isArray(data.memoryEntries)) {
    return {
      ...data,
      memoryEntries: data.memoryEntries.map((e: any) => ({ ...e, memory: mark(e?.memory) })),
    };
  }
  return structured;
}

// Marks each returned memory with ◪, as hook recall does, so the agent can credit Supermemory.
export function markMemoryResult(toolName: string, response: unknown): unknown {
  if (!MEMORY_RESULT_TOOLS.has(toolName)) return response;
  const result = (
    response as { result?: { content?: unknown; isError?: unknown; structuredContent?: unknown } }
  )?.result;
  if (!result || result.isError || !Array.isArray(result.content)) return response;
  let marked = false;
  const content = result.content.map((item: TextItem) => {
    if (item?.type !== "text" || typeof item.text !== "string") return item;
    const text = item.text.replace(/^- (?!◪|\+\d+ more$)/gm, () => {
      marked = true;
      return "- ◪ ";
    });
    return { ...item, text };
  });
  if (!marked) return response;
  content.push({ type: "text", text: MEMORY_MARK_NOTE });
  const structured =
    result.structuredContent === undefined
      ? {}
      : { structuredContent: markStructured(toolName, result.structuredContent) };
  return { ...(response as object), result: { ...result, content, ...structured } };
}

function relay(line: string, message: JsonRpcMessage): string {
  const toolName = (message.params as ToolCallParams | undefined)?.name;
  if (message.method !== "tools/call" || typeof toolName !== "string") return line;
  try {
    const response = JSON.parse(line) as JsonRpcMessage;
    if (response.id !== message.id) return line;
    return `${JSON.stringify(markMemoryResult(toolName, response))}\n`;
  } catch {
    return line;
  }
}

function send(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function sendError(
  id: JsonRpcMessage["id"],
  code: number,
  message: string,
): void {
  if (id === undefined || id === null) return;
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

export function emitSseData(
  body: string,
  write: (line: string) => void,
): void {
  for (const event of body.split("\n\n")) {
    for (const line of event.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data) write(`${data}\n`);
    }
  }
}

async function forward(
  message: JsonRpcMessage,
  apiKey: string,
  mcpUrl: string,
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const response = await fetch(mcpUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const nextSessionId = response.headers.get("mcp-session-id");
  if (nextSessionId) sessionId = nextSessionId;

  if (response.status === 202) return;
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    sendError(
      message.id,
      -32000,
      `Supermemory MCP ${response.status}: ${body.slice(0, 200) || "request failed"}`,
    );
    return;
  }

  const body = await response.text();
  if (!body.trim()) return;

  if ((response.headers.get("content-type") || "").includes("text/event-stream")) {
    emitSseData(body, (line) => process.stdout.write(relay(line, message)));
  } else {
    process.stdout.write(relay(`${body.trim()}\n`, message));
  }
}

// API keys keep the hosted MCP default; an OAuth token is only valid for its resource.
function proxyTarget(config: ReturnType<typeof loadConfig>): string {
  if (getApiKey(config)) return process.env.SUPERMEMORY_MCP_URL || DEFAULT_MCP_URL;
  return getMcpUrl(config);
}

export function startMcpProxy(): void {
  const namespace = repoNamespace();
  let queue = Promise.resolve();
  const lines = createInterface({ input: process.stdin });

  lines.on("line", (line) => {
    if (!line.trim()) return;

    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      return;
    }

    queue = queue.then(async () => {
      try {
        // Resolve per message: login or a token refresh may land after the proxy started.
        const config = loadConfig();
        const apiKey = await getAuthToken(config);
        await forward(withRepoNamespace(message, namespace), apiKey, proxyTarget(config));
      } catch (error) {
        if (isAuthRequired(error)) {
          sessionId = null;
          sendError(
            message.id,
            -32001,
            "Supermemory is not authenticated. Use the memory-connect skill (\"Sign me in to Supermemory\") or /supermemory-setup, or set SUPERMEMORY_API_KEY.",
          );
          return;
        }
        const detail = error instanceof Error ? error.message : String(error);
        sendError(message.id, -32000, `Supermemory MCP proxy error: ${detail}`);
      }
    });
  });

  lines.on("close", () => {
    // Let a refresh that is still rotating tokens save them before exiting.
    queue.finally(() => settleAuth().finally(() => process.exit(0)));
  });
}
