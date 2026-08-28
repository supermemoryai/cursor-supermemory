import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { realpathSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import { z } from "zod";
import {
  GLOBAL_CONFIG_PATH,
  getApiKey,
  getProjectConfigPath,
  loadConfig,
  writeConfig,
} from "./config.ts";
import { getResolvedTags, type ResolvedTags } from "./tags.ts";
import {
  AGENT_ENTITY_CONTEXT,
  CursorMemoryClient,
  type MemoryScope,
} from "./client.ts";

function getAuth(cwd = process.cwd()) {
  const config = loadConfig(cwd);
  const apiKey = getApiKey(config);
  if (!apiKey) {
    throw new Error(
      "Not authenticated. Run `cursor-supermemory login` to connect.",
    );
  }
  const tags = getResolvedTags(cwd, config);
  return {
    apiKey,
    config,
    tags,
    client: new CursorMemoryClient(apiKey, config.baseUrl),
  };
}

export function resolveWorkspaceRoot(workspaceRoot: string): string {
  const candidate = workspaceRoot.trim();
  if (!isAbsolute(candidate)) {
    throw new Error("workspaceRoot must be an absolute path.");
  }

  try {
    const resolved = realpathSync(candidate);
    if (!statSync(resolved).isDirectory()) {
      throw new Error("workspaceRoot must point to a directory.");
    }
    return resolved;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("workspaceRoot")) {
      throw error;
    }
    throw new Error(`workspaceRoot is not an accessible directory: ${candidate}`);
  }
}

interface ResolvedContainer {
  tag: string;
  reads: string[];
  scope: MemoryScope | null;
  custom: boolean;
}

function resolveContainer(
  tags: ResolvedTags,
  container?: string,
): ResolvedContainer {
  if (!container || container === "user") {
    return {
      tag: tags.canonical,
      reads: tags.personalReads,
      scope: "personal",
      custom: false,
    };
  }
  if (container === "project") {
    return {
      tag: tags.canonical,
      reads: tags.projectReads,
      scope: "project",
      custom: false,
    };
  }
  if (container === "both") {
    return {
      tag: tags.canonical,
      reads: tags.allReads,
      scope: null,
      custom: false,
    };
  }
  return { tag: container, reads: [container], scope: null, custom: true };
}

const containerSchema = z
  .string()
  .optional()
  .describe(
    'Container to use: "user" (default), "project", "both", or any custom tag string',
  );

const workspaceRootSchema = z
  .string()
  .min(1)
  .describe(
    "Absolute path of the active Cursor workspace. Always pass the workspace root shown in the current agent context.",
  );

export function createMcpServer() {
  const server = new McpServer(
    { name: "supermemory", version: "1.0.2" },
    {
      instructions:
        "Every tool call requires workspaceRoot. Pass the absolute path of the active Cursor workspace from the current agent context.",
    },
  );

  server.registerTool(
    "supermemory_get_config",
    {
      description:
        "Show the current supermemory configuration — effective settings, resolved container tags, and config file paths.",
      inputSchema: { workspaceRoot: workspaceRootSchema },
    },
    async ({ workspaceRoot }) => {
      const cwd = resolveWorkspaceRoot(workspaceRoot);
      const auth = getAuth(cwd);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                effectiveConfig: {
                  repoContainerTag:
                    auth.config.repoContainerTag ??
                    "(derived from the normalized Git remote or project path)",
                  similarityThreshold: auth.config.similarityThreshold,
                  maxMemories: auth.config.maxMemories,
                  maxProjectMemories: auth.config.maxProjectMemories,
                  injectProfile: auth.config.injectProfile,
                  signalExtraction: auth.config.signalExtraction,
                  signalKeywords: auth.config.signalKeywords,
                  signalTurnsBefore: auth.config.signalTurnsBefore,
                  baseUrl: auth.config.baseUrl ?? "(default API)",
                },
                project: {
                  name: auth.tags.projectName,
                  id: auth.tags.projectId,
                  canonicalContainer: auth.tags.canonical,
                },
                writes: {
                  user: {
                    tag: auth.tags.canonical,
                    sm_scope: "personal",
                  },
                  project: {
                    tag: auth.tags.canonical,
                    sm_scope: "project",
                  },
                },
                reads: {
                  user: auth.tags.personalReads,
                  project: auth.tags.projectReads,
                  both: auth.tags.allReads,
                },
                legacyCursorOverrides: {
                  userContainerTag: auth.config.userContainerTag,
                  projectContainerTag: auth.config.projectContainerTag,
                },
                configFiles: {
                  project: getProjectConfigPath(cwd),
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
        workspaceRoot: workspaceRootSchema,
        scope: z.enum(["project", "global"]).default("project"),
        repoContainerTag: z
          .string()
          .optional()
          .describe("Override the shared repository memory container tag"),
        userContainerTag: z
          .string()
          .optional()
          .describe("Legacy Cursor personal container to keep reading"),
        projectContainerTag: z
          .string()
          .optional()
          .describe("Legacy Cursor project container to keep reading"),
        baseUrl: z.string().url().optional(),
        similarityThreshold: z.number().min(0).max(1).optional(),
        maxMemories: z.number().int().positive().optional(),
        maxProjectMemories: z.number().int().positive().optional(),
        injectProfile: z.boolean().optional(),
        signalExtraction: z.boolean().optional(),
        signalKeywords: z.array(z.string()).optional(),
        signalTurnsBefore: z.number().int().positive().optional(),
      },
    },
    async ({ workspaceRoot, scope, ...updates }) => {
      const filtered = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => value !== undefined),
      );
      if (Object.keys(filtered).length === 0) {
        throw new Error("No config values provided.");
      }
      const cwd = resolveWorkspaceRoot(workspaceRoot);
      writeConfig(filtered as any, scope, cwd);
      const filePath =
        scope === "project" ? getProjectConfigPath(cwd) : GLOBAL_CONFIG_PATH;
      return {
        content: [
          {
            type: "text",
            text: `Config updated (${scope}): ${filePath}\n${JSON.stringify(filtered, null, 2)}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "supermemory_containers",
    {
      description:
        "Show the shared repository container and all compatibility read tags. " +
        '"user" and "project" write to the same container with different sm_scope metadata.',
      inputSchema: { workspaceRoot: workspaceRootSchema },
    },
    async ({ workspaceRoot }) => {
      const auth = getAuth(resolveWorkspaceRoot(workspaceRoot));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                repository: {
                  name: auth.tags.projectName,
                  id: auth.tags.projectId,
                  tag: auth.tags.canonical,
                },
                user: {
                  alias: "user",
                  tag: auth.tags.canonical,
                  sm_scope: "personal",
                  reads: auth.tags.personalReads,
                },
                project: {
                  alias: "project",
                  tag: auth.tags.canonical,
                  sm_scope: "project",
                  reads: auth.tags.projectReads,
                },
                both: {
                  alias: "both",
                  tag: auth.tags.canonical,
                  reads: auth.tags.allReads,
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
    "supermemory_search",
    {
      description:
        'Search memories. Use container="user" for personal, "project" for workspace, or pass a custom tag.',
      inputSchema: {
        workspaceRoot: workspaceRootSchema,
        query: z.string(),
        container: containerSchema,
        limit: z.number().default(10),
      },
    },
    async ({ workspaceRoot, query, container, limit }) => {
      const auth = getAuth(resolveWorkspaceRoot(workspaceRoot));
      const resolved = resolveContainer(auth.tags, container);
      const result = resolved.scope
        ? await auth.client.searchScoped(
            query,
            resolved.tag,
            resolved.reads,
            resolved.scope,
            limit,
          )
        : await auth.client.searchMany(query, resolved.reads, limit);
      const formatted = result.results.map((result: any) => ({
        id: result.id,
        memory: result.memory ?? result.chunk ?? "",
        similarity: result.similarity,
        updatedAt: result.updatedAt,
        containerTag: result.containerTag,
      }));
      return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
    },
  );

  server.registerTool(
    "supermemory_add",
    {
      description:
        'Save information to memory. Use container="user" for personal, "project" for workspace, or a custom tag.',
      inputSchema: {
        workspaceRoot: workspaceRootSchema,
        content: z.string(),
        container: containerSchema,
      },
    },
    async ({ workspaceRoot, content, container }) => {
      if (container === "both") {
        throw new Error(
          'The "both" alias is read-only. Choose "user" or "project" when saving.',
        );
      }
      const auth = getAuth(resolveWorkspaceRoot(workspaceRoot));
      const resolved = resolveContainer(auth.tags, container);
      const result = await auth.client.addMemory(
        content,
        resolved.tag,
        {
          type: "memory",
          project: auth.tags.projectName,
          sm_project_id: auth.tags.projectId,
          ...(resolved.scope ? { sm_scope: resolved.scope } : {}),
          sm_capture_mode: "explicit",
          timestamp: new Date().toISOString(),
        },
        { entityContext: AGENT_ENTITY_CONTEXT },
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "supermemory_profile",
    {
      description: "Get the user's profile summary based on their personal memories.",
      inputSchema: {
        workspaceRoot: workspaceRootSchema,
        query: z.string().optional(),
      },
    },
    async ({ workspaceRoot, query }) => {
      const auth = getAuth(resolveWorkspaceRoot(workspaceRoot));
      const result = await auth.client.profileScoped(
        auth.tags.canonical,
        auth.tags.personalReads,
        "personal",
        query,
        auth.config.maxMemories,
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "supermemory_list",
    {
      description: "List stored memories, optionally filtered by container.",
      inputSchema: {
        workspaceRoot: workspaceRootSchema,
        limit: z.number().default(20),
        page: z.number().default(1),
        container: containerSchema,
      },
    },
    async ({ workspaceRoot, limit, page, container }) => {
      const auth = getAuth(resolveWorkspaceRoot(workspaceRoot));
      const resolved = resolveContainer(auth.tags, container);
      const result = resolved.scope
        ? await auth.client.listScoped(
            resolved.tag,
            resolved.reads,
            resolved.scope,
            limit,
            page,
          )
        : await auth.client.listMany(resolved.reads, limit, page);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "supermemory_forget",
    {
      description: "Forget a specific memory by id or content.",
      inputSchema: {
        workspaceRoot: workspaceRootSchema,
        id: z.string().optional(),
        content: z.string().optional(),
        container: containerSchema,
      },
    },
    async ({ workspaceRoot, id, content, container }) => {
      if (!id && !content) throw new Error("Provide either id or content.");
      const auth = getAuth(resolveWorkspaceRoot(workspaceRoot));
      const resolved = resolveContainer(auth.tags, container);
      const result = await auth.client.forgetMany(resolved.reads, {
        id,
        content,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  return server;
}

export async function startMcpServer() {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
}
