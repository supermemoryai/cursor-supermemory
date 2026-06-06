import { loadCredentials } from "../auth.ts";
import { loadConfig, getApiKey } from "../config.ts";
import { getUserTag, getProjectTag } from "../tags.ts";
import { createClient } from "../client.ts";
import { formatContext } from "../context.ts";

interface SessionStartInput {
  workspace_roots: string[];
  user_email?: string;
  session_id: string;
}

const ok = () => process.stdout.write(JSON.stringify({ continue: true }));

async function main() {
  const raw = await Bun.stdin.text();
  const input: SessionStartInput = JSON.parse(raw);

  const creds = loadCredentials();
  if (!creds) return ok();

  const config = loadConfig(input.workspace_roots[0]);
  const apiKey = getApiKey(config);
  if (!apiKey) return ok();

  // Inject user email from input for tag resolution
  if (input.user_email && !process.env.CURSOR_USER_EMAIL) {
    process.env.CURSOR_USER_EMAIL = input.user_email;
  }

  const userTag = getUserTag(config);
  const projectTag = getProjectTag(input.workspace_roots[0] || process.cwd(), config);

  // Use documents.list (recency-ordered) rather than search.memories: the v4
  // search endpoint rejects the empty query we'd need to "list everything".
  const [profileResult, memoriesResult] = await Promise.allSettled([
    createClient(apiKey, userTag).profile({ containerTag: userTag }),
    createClient(apiKey, projectTag).documents.list({ containerTags: [projectTag], limit: 10 }),
  ]);

  const profile = profileResult.status === "fulfilled" ? profileResult.value.profile : null;
  const memories =
    memoriesResult.status === "fulfilled" ? (memoriesResult.value.memories ?? []) : [];

  const context = formatContext(profile, memories);
  if (!context) return ok();

  process.stdout.write(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: "sessionStart",
      additionalContext: context,
    },
  }));
}

main().catch((err) => {
  console.error("[supermemory] session-start error:", err);
  ok();
});
