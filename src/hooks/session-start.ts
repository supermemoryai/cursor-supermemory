import path from "node:path";
import { loadConfig, getApiKey } from "../config.ts";
import { getResolvedTags } from "../tags.ts";
import { getProfiles, resolveApiVersion } from "../hook-api.ts";
import { formatContainerDirective, formatSessionContext } from "../context.ts";
import { readStdinText } from "../runtime.ts";

interface SessionStartInput {
  workspace_roots: string[];
  user_email?: string;
  session_id: string;
}

const ok = () => process.stdout.write(JSON.stringify({}));

async function main() {
  const raw = await readStdinText();
  const input: SessionStartInput = JSON.parse(raw);

  const workspaceRoot = input.workspace_roots?.[0] || process.cwd();
  const config = loadConfig(workspaceRoot);
  const apiKey = getApiKey(config);
  if (!apiKey) {
    const cli = path.join(path.dirname(process.argv[1] ?? "dist/session-start.js"), "cli.js");
    process.stdout.write(
      JSON.stringify({
        additional_context: `<supermemory-status>Supermemory is not connected. When the user wants memory, follow the memory-connect skill: run \`node "${cli}" login --no-wait\` and open the URL it prints in a browser on this same machine.</supermemory-status>`,
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
          resolveApiVersion(config.baseUrl, config.apiVersion) === "legacy"
            ? tags.projectName
            : undefined,
          undefined,
          config.apiVersion,
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
    JSON.stringify({
      additional_context:
        context ||
        `<supermemory-context>\n${formatContainerDirective(tags.canonical)}\n</supermemory-context>`,
    }),
  );
}

main().catch((err) => {
  console.error("[supermemory] session-start error:", err);
  ok();
});
