import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadConfig, getApiKey } from "../config.ts";
import { getResolvedTags } from "../tags.ts";
import {
  AGENT_ENTITY_CONTEXT,
  CursorMemoryClient,
} from "../client.ts";
import { readStdin } from "../stdin.ts";

interface SessionEndInput {
  session_id: string;
  transcript_path?: string;
  reason?: string;
  workspace_roots?: string[];
}

interface Turn {
  role: string;
  content?: unknown;
  message?: unknown;
}

// Cursor transcripts store each turn as { role, message: { content: [{ type, text }] } }.
// Older/other formats may use a flat string `content`. Extract plain text from either.
function extractTurnText(turn: Turn): string {
  if (typeof turn.content === "string") return turn.content;

  const message = turn.message as { content?: unknown } | undefined;
  const blocks = message?.content;
  if (Array.isArray(blocks)) {
    return blocks
      .filter(
        (b): b is { type: string; text: string } =>
          !!b && typeof b === "object" && (b as { type?: unknown }).type === "text" &&
          typeof (b as { text?: unknown }).text === "string",
      )
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

function parseTranscript(text: string): Turn[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  // Try JSONL
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function captureId(sessionId: string): string {
  const digest = createHash("sha256").update(sessionId).digest("hex");
  return `cursor:capture:${digest}`;
}

async function main() {
  const raw = await readStdin();
  const input: SessionEndInput = JSON.parse(raw);

  // Persist on any normal session end that produced a transcript. Cursor sends
  // "completed" only rarely; real interactive sessions usually end with
  // "user_close"/"window_close". Skip only sessions with no transcript or that
  // ended abnormally ("aborted"/"error").
  const NON_PERSISTABLE_REASONS = new Set(["aborted", "error"]);
  if (!input.transcript_path || NON_PERSISTABLE_REASONS.has(input.reason ?? "")) return;

  // Cursor spawns this hook from ~/.cursor, so process.cwd() is NOT the
  // workspace. Resolve config + project tag from workspace_roots[0] (as
  // session-start does) so reads and writes target the same container.
  const workspaceRoot = input.workspace_roots?.[0] || process.cwd();
  const config = loadConfig(workspaceRoot);
  const apiKey = getApiKey(config);
  if (!apiKey) return;

  const fileContent = await readFile(input.transcript_path, "utf-8");
  const turns = parseTranscript(fileContent);

  const relevant = turns
    .filter((t) => t.role === "user" || t.role === "assistant")
    .map((t) => ({ role: t.role, text: extractTurnText(t) }))
    .filter((t) => t.text.length > 0);
  const userTurns = relevant.filter((t) => t.role === "user");
  if (userTurns.length < 2) return;

  let transcript = relevant
    .map(
      (turn, index) =>
        `${index + 1}. [${turn.role}] ${turn.text}`,
    )
    .join("\n");
  if (transcript.length > 100_000) {
    transcript = transcript.slice(0, 100_000);
  }

  const tags = getResolvedTags(workspaceRoot, config);
  const content = `[Conversation ${input.session_id}]\n${transcript}`;
  const client = new CursorMemoryClient(apiKey, config.baseUrl);

  await client.addMemory(
    content,
    tags.canonical,
    {
      type: "conversation",
      project: tags.projectName,
      sm_project_id: tags.projectId,
      sm_scope: "personal",
      sm_capture_mode: "session_end",
      sessionId: input.session_id,
      timestamp: new Date().toISOString(),
    },
    {
      customId: captureId(input.session_id),
      entityContext: AGENT_ENTITY_CONTEXT,
    },
  );
}

main().catch((err) => {
  console.error("[supermemory] session-end error:", err);
});
