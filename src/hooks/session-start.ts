import { loadConfig, getApiKey } from "../config.ts";
import { getResolvedTags } from "../tags.ts";
import { CursorMemoryClient } from "../client.ts";
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

  const workspaceRoot = input.workspace_roots?.[0] || process.cwd();
  const config = loadConfig(workspaceRoot);
  const apiKey = getApiKey(config);
  if (!apiKey) return ok();

  // Inject user email from input for tag resolution
  if (input.user_email && !process.env.CURSOR_USER_EMAIL) {
    process.env.CURSOR_USER_EMAIL = input.user_email;
  }

  const tags = getResolvedTags(workspaceRoot, config);
  const client = new CursorMemoryClient(apiKey, config.baseUrl);

  const [profileResult, memoriesResult] = await Promise.allSettled([
    config.injectProfile
      ? client.profileScoped(
          tags.canonical,
          tags.personalReads,
          "personal",
          undefined,
          config.maxMemories,
        )
      : Promise.resolve(null),
    client.listScoped(
      tags.canonical,
      tags.projectReads,
      "project",
      config.maxProjectMemories,
    ),
  ]);

  const profile =
    profileResult.status === "fulfilled" && profileResult.value
      ? profileResult.value.profile
      : null;
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
