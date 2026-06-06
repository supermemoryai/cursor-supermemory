import { loadCredentials } from "../auth.ts";
import { loadConfig, getApiKey } from "../config.ts";
import { getUserTag, getProjectTag } from "../tags.ts";
import { createClient } from "../client.ts";

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

async function main() {
  const raw = await Bun.stdin.text();
  const input: SessionEndInput = JSON.parse(raw);

  // Persist on any normal session end that produced a transcript. Cursor sends
  // "completed" only rarely; real interactive sessions usually end with
  // "user_close"/"window_close". Skip only sessions with no transcript or that
  // ended abnormally ("aborted"/"error").
  const NON_PERSISTABLE_REASONS = new Set(["aborted", "error"]);
  if (!input.transcript_path || NON_PERSISTABLE_REASONS.has(input.reason ?? "")) return;

  const creds = loadCredentials();
  if (!creds) return;

  // Cursor spawns this hook from ~/.cursor, so process.cwd() is NOT the
  // workspace. Resolve config + project tag from workspace_roots[0] (as
  // session-start does) so reads and writes target the same container.
  const workspaceRoot = input.workspace_roots?.[0] || process.cwd();
  const config = loadConfig(workspaceRoot);
  const apiKey = getApiKey(config);
  if (!apiKey) return;

  const fileContent = await Bun.file(input.transcript_path).text();
  const turns = parseTranscript(fileContent);

  const relevant = turns
    .filter((t) => t.role === "user" || t.role === "assistant")
    .map((t) => ({ role: t.role, text: extractTurnText(t) }))
    .filter((t) => t.text.length > 0);
  const userTurns = relevant.filter((t) => t.role === "user");
  if (userTurns.length < 2) return;

  let transcript = relevant
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.text}`)
    .join("\n");
  if (transcript.length > 100_000) {
    transcript = transcript.slice(0, 100_000);
  }

  const userTag = getUserTag(config);
  const projectTag = getProjectTag(workspaceRoot, config);
  const content = `Cursor IDE session transcript:\n${transcript}`;

  await Promise.allSettled([
    createClient(apiKey, userTag).add({ content, containerTag: userTag }),
    createClient(apiKey, projectTag).add({ content, containerTag: projectTag }),
  ]);
}

main().catch((err) => {
  console.error("[supermemory] session-end error:", err);
});
