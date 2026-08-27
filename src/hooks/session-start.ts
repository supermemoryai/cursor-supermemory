import { loadConfig, getApiKey } from "../config.ts";
import { getResolvedTags } from "../tags.ts";
import { getProfiles } from "../hook-api.ts";
import { formatSessionContext } from "../context.ts";

interface SessionStartInput {
  workspace_roots: string[];
  user_email?: string;
  session_id: string;
}

const ok = () => process.stdout.write(JSON.stringify({}));

async function main() {
  const raw = await Bun.stdin.text();
  const input: SessionStartInput = JSON.parse(raw);

  const workspaceRoot = input.workspace_roots?.[0] || process.cwd();
  const config = loadConfig(workspaceRoot);
  const apiKey = getApiKey(config);
  if (!apiKey) {
    process.stdout.write(
      JSON.stringify({
        additional_context:
          "<supermemory-status>Supermemory is not connected. Ask the user to run `bunx --bun cursor-supermemory@latest login` before relying on persistent memory.</supermemory-status>",
      }),
    );
    return;
  }

  // Inject user email from input for tag resolution
  if (input.user_email && !process.env.CURSOR_USER_EMAIL) {
    process.env.CURSOR_USER_EMAIL = input.user_email;
  }

  const tags = getResolvedTags(workspaceRoot, config);
  let profiles: any[] = [];
  try {
    profiles = config.injectProfile
      ? await getProfiles(
          config.baseUrl,
          apiKey,
          tags.allReads,
          tags.projectName,
        )
      : [];
  } catch {
    process.stdout.write(
      JSON.stringify({
        additional_context:
          "<supermemory-status>Supermemory could not be reached. Continue without memory, and do not assume this project has no saved memories.</supermemory-status>",
      }),
    );
    return;
  }
  const context = formatSessionContext(
    profiles,
    config.maxMemories,
    tags.canonical,
    tags.projectName,
  );

  process.stdout.write(
    JSON.stringify(context ? { additional_context: context } : {}),
  );
}

main().catch((err) => {
  console.error("[supermemory] session-start error:", err);
  ok();
});
