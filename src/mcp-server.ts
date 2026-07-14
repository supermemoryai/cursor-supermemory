import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig, getApiKey, writeConfig, getProjectConfigPath, GLOBAL_CONFIG_PATH } from "./config.ts";
import { getUserTag, getProjectTag } from "./tags.ts";
import { createClient } from "./client.ts";

function getWorkspaceRoot() {
  const workspaceRoot = process.env.SUPERMEMORY_WORKSPACE_ROOT?.trim();
  if (workspaceRoot && !workspaceRoot.includes("${")) return workspaceRoot;
  return process.cwd();
}

function getAuth() {
  const workspaceRoot = getWorkspaceRoot();
  const config = loadConfig(workspaceRoot);
  const apiKey = getApiKey(config);
  if (!apiKey) throw new Error("Not authenticated. Run `cursor-supermemory login` to connect.");
  return {
    apiKey,
    userTag: getUserTag(config),
    projectTag: getProjectTag(workspaceRoot, config),
    workspaceRoot,
    config,
  };
}

// "user" → personal tag, "project" → project tag, anything else → used as-is
function resolveContainer(auth: { userTag: string; projectTag: string }, container?: string): string {
  if (!container || container === "user") return auth.userTag;
  if (container === "project") return auth.projectTag;
  return container;
}

const containerSchema = z
  .string()
  .optional()
  .describe('Container to use: "user" (default), "project" (current project), or any custom tag string');

export async function startMcpServer() {
  const server = new McpServer({ name: "supermemory", version: "1.0.0" });

  server.registerTool(
    "supermemory_get_config",
    {
      description:
        "Show the current supermemory configuration — effective settings, resolved container tags, and config file paths.",
      inputSchema: {},
    },
    async () => {
      const auth = getAuth();
      const { config, workspaceRoot } = auth;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                effectiveConfig: {
                  userContainerTag: config.userContainerTag ?? "(auto-derived from git email / machine id)",
                  projectContainerTag: config.projectContainerTag ?? "(auto-derived from git root / cwd)",
                  similarityThreshold: config.similarityThreshold,
                  maxMemories: config.maxMemories,
                  maxProjectMemories: config.maxProjectMemories,
                  injectProfile: config.injectProfile,
                },
                resolvedTags: {
                  user: auth.userTag,
                  project: auth.projectTag,
                },
                configFiles: {
                  project: getProjectConfigPath(workspaceRoot),
                  global: GLOBAL_CONFIG_PATH,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "supermemory_set_config",
    {
      description:
        "Update supermemory configuration. Use scope='project' to set per-workspace overrides (saved to .cursor/.supermemory/config.json), or scope='global' for user-wide defaults.",
      inputSchema: {
        scope: z.enum(["project", "global"]).default("project"),
        userContainerTag: z.string().optional().describe("Override the personal memory container tag"),
        projectContainerTag: z.string().optional().describe("Override the project/workspace memory container tag"),
        similarityThreshold: z.number().min(0).max(1).optional(),
        maxMemories: z.number().int().positive().optional(),
        maxProjectMemories: z.number().int().positive().optional(),
        injectProfile: z.boolean().optional(),
      },
    },
    async ({ scope, ...updates }) => {
      const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      if (Object.keys(filtered).length === 0) throw new Error("No config values provided.");
      const workspaceRoot = getWorkspaceRoot();
      writeConfig(filtered as any, scope, workspaceRoot);
      const filePath = scope === "project" ? getProjectConfigPath(workspaceRoot) : GLOBAL_CONFIG_PATH;
      return {
        content: [{ type: "text", text: `Config updated (${scope}): ${filePath}\n${JSON.stringify(filtered, null, 2)}` }],
      };
    },
  );

  server.registerTool(
    "supermemory_containers",
    {
      description:
        "Show the available container tags. Use these as the `container` argument in other tools. " +
        '"user" is personal memory, "project" is scoped to the current workspace.',
      inputSchema: {},
    },
    async () => {
      const auth = getAuth();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                user: { alias: "user", tag: auth.userTag, description: "Personal memories across all projects" },
                project: { alias: "project", tag: auth.projectTag, description: "Memories scoped to this workspace" },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "supermemory_search",
    {
      description:
        'Search memories. Use container="user" for personal, "project" for workspace, or pass a custom tag.',
      inputSchema: { query: z.string(), container: containerSchema, limit: z.number().default(10) },
    },
    async ({ query, container, limit }) => {
      const auth = getAuth();
      const tag = resolveContainer(auth, container);
      const client = createClient(auth.apiKey, tag);
      const result = await client.search.memories({ q: query, containerTag: tag, limit });
      const formatted = result.results.map((r) => ({
        id: r.id,
        memory: r.memory ?? r.chunk ?? "",
        similarity: r.similarity,
        updatedAt: r.updatedAt,
      }));
      return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
    },
  );

  server.registerTool(
    "supermemory_add",
    {
      description:
        'Save information to memory. Use container="user" for personal, "project" for workspace, or a custom tag.',
      inputSchema: { content: z.string(), container: containerSchema },
    },
    async ({ content, container }) => {
      const auth = getAuth();
      const tag = resolveContainer(auth, container);
      const client = createClient(auth.apiKey, tag);
      const result = await client.add({ content, containerTag: tag });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "supermemory_profile",
    {
      description: "Get the user's profile summary based on their personal memories.",
      inputSchema: { query: z.string().optional() },
    },
    async ({ query }) => {
      const auth = getAuth();
      const client = createClient(auth.apiKey, auth.userTag);
      const result = await client.profile({ containerTag: auth.userTag, q: query });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "supermemory_list",
    {
      description: "List stored memories, optionally filtered by container.",
      inputSchema: { limit: z.number().default(20), page: z.number().default(1), container: containerSchema },
    },
    async ({ limit, page, container }) => {
      const auth = getAuth();
      const tag = resolveContainer(auth, container);
      const client = createClient(auth.apiKey, tag);
      const result = await client.documents.list({ limit, page });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "supermemory_forget",
    {
      description: "Forget a specific memory by id or content.",
      inputSchema: {
        id: z.string().optional(),
        content: z.string().optional(),
        container: containerSchema,
      },
    },
    async ({ id, content, container }) => {
      if (!id && !content) throw new Error("Provide either id or content.");
      const auth = getAuth();
      const tag = resolveContainer(auth, container);
      const client = createClient(auth.apiKey, tag);
      const result = await client.memories.forget({ containerTag: tag, id, content });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  await server.connect(new StdioServerTransport());
}
