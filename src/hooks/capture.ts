import { createHash } from "node:crypto";
import { loadConfig, getApiKey } from "../config.ts";
import { addMemory, AGENT_ENTITY_CONTEXT } from "../hook-api.ts";
import {
  deleteHookState,
  readHookState,
  writeHookState,
} from "../hook-state.ts";
import { getResolvedTags } from "../tags.ts";
import {
  conversationId,
  type CursorHookInput,
  workspaceRoot,
} from "./types.ts";
import { isMainModule, readTextFile, runHook } from "../runtime.ts";

interface TranscriptEntry {
  content?: unknown;
  message?: unknown;
  role?: string;
  type?: string;
}

interface CapturedEntry {
  role: "user" | "assistant";
  text: string;
}

function cleanContent(text: string): string {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(
      /<supermemory-(?:context|recall)>[\s\S]*?<\/supermemory-(?:context|recall)>/g,
      "",
    )
    .trim();
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return cleanContent(content);
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((block) => {
      if (!block || typeof block !== "object") return [];
      const value = block as { text?: unknown; type?: unknown };
      return value.type === "text" && typeof value.text === "string"
        ? [cleanContent(value.text)]
        : [];
    })
    .filter(Boolean)
    .join("\n");
}

function extractEntry(entry: TranscriptEntry): CapturedEntry | null {
  const role = entry.role ?? entry.type;
  if (role !== "user" && role !== "assistant") return null;
  const message = entry.message as { content?: unknown } | undefined;
  const text = textFromContent(entry.content ?? message?.content);
  return text ? { role, text } : null;
}

export function parseTranscript(text: string): CapturedEntry[] {
  let entries: TranscriptEntry[] = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) entries = parsed;
  } catch {
    entries = text
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as TranscriptEntry];
        } catch {
          return [];
        }
      });
  }
  return entries.flatMap((entry) => {
    const captured = extractEntry(entry);
    return captured ? [captured] : [];
  });
}

export function selectCaptureEntries(
  entries: CapturedEntry[],
  start: number,
  signalExtraction: boolean,
  signalKeywords: string[],
  signalTurnsBefore: number,
): CapturedEntry[] {
  const pending = entries.slice(start);
  if (!signalExtraction) return pending;
  const keywords = signalKeywords.map((keyword) => keyword.toLowerCase());
  const signalIndex = pending.findLastIndex(
    (entry) =>
      entry.role === "user" &&
      keywords.some((keyword) => entry.text.toLowerCase().includes(keyword)),
  );
  if (signalIndex < 0) return [];
  let first = signalIndex;
  let userTurns = Math.max(1, signalTurnsBefore);
  while (first > 0 && userTurns > 1) {
    first--;
    if (pending[first]?.role === "user") userTurns--;
  }
  return pending.slice(first);
}

export function formatCapture(entries: CapturedEntry[]): string {
  if (entries.length === 0) return "";
  const parts = [`<|turn_start|>${new Date().toISOString()}`];
  for (const entry of entries) {
    parts.push(
      `<|start|>${entry.role}<|message|>${entry.text}<|end|>`,
    );
  }
  parts.push("<|turn_end|>");
  return parts.join("\n\n");
}

async function capture(input: CursorHookInput): Promise<void> {
  if (
    [input.status, input.reason].some((value) =>
      ["aborted", "error"].includes(value ?? ""),
    )
  ) {
    return;
  }
  const transcriptPath =
    input.transcript_path || process.env.CURSOR_TRANSCRIPT_PATH;
  if (!transcriptPath) return;

  try {
    const root = workspaceRoot(input);
    const config = loadConfig(root);
    const apiKey = getApiKey(config);
    if (!apiKey) return;

    const id = conversationId(input);
    const state = readHookState(id);
    const entries = parseTranscript(await readTextFile(transcriptPath));
    const capturedEntries =
      state.transcriptPath === transcriptPath ? state.capturedEntries ?? 0 : 0;
    const start = capturedEntries <= entries.length ? capturedEntries : 0;
    const selected = selectCaptureEntries(
      entries,
      start,
      config.signalExtraction,
      config.signalKeywords,
      config.signalTurnsBefore,
    );
    const content = formatCapture(selected);
    if (content.length < 100) return;

    const tags = getResolvedTags(root, config);
    const generation =
      input.generation_id ||
      createHash("sha256").update(content).digest("hex").slice(0, 32);
    await addMemory(
      config.baseUrl,
      apiKey,
      content,
      tags.canonical,
      {
        type: "conversation",
        project: tags.projectName,
        sm_project_id: tags.projectId,
        sm_scope: "personal",
        sm_capture_mode: "stop",
        sessionId: id,
        timestamp: new Date().toISOString(),
      },
      {
        customId: `cursor:capture:${createHash("sha256")
          .update(`${id}:${generation}`)
          .digest("hex")}`,
        entityContext: AGENT_ENTITY_CONTEXT,
      },
    );
    writeHookState(id, {
      capturedEntries: entries.length,
      transcriptPath,
    });
  } catch (error) {
    if (process.env.SUPERMEMORY_DEBUG === "true") {
      console.error("[supermemory] capture failed:", error);
    }
  }
}

export async function runCapture(input: CursorHookInput): Promise<void> {
  try {
    await capture(input);
  } finally {
    if (input.hook_event_name === "sessionEnd") {
      deleteHookState(conversationId(input));
    }
  }
}

if (isMainModule(import.meta.url)) {
  await runHook<CursorHookInput>(runCapture, {});
}
