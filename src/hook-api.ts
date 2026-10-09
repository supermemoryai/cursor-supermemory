import { createHash, createHmac } from "node:crypto";
import { Supermemory, type AddRequest, type ProfileRequest } from "supermemory";

const DEFAULT_BASE_URL = "https://api.supermemory.ai";
const REQUEST_TIMEOUT_MS = 3_000;
const INTEGRITY_VERSION = 1;
const SEED = "7f2a9c4b8e1d6f3a5c0b9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a";

export function resolveApiVersion(
  baseUrl: string | null,
  apiVersion?: string,
): "v5" | "legacy" {
  if (apiVersion !== undefined) {
    if (apiVersion === "v5" || apiVersion === "legacy") return apiVersion;
    throw new Error('Supermemory apiVersion must be "v5" or "legacy"');
  }
  let url: URL;
  try {
    url = new URL(baseUrl || DEFAULT_BASE_URL);
  } catch {
    throw new Error("Supermemory API base URL is invalid");
  }
  return url.origin === DEFAULT_BASE_URL &&
    /^\/*$/.test(url.pathname) &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
    ? "v5"
    : "legacy";
}

function sdk(baseUrl: string | null, apiKey: string, tag: string): Supermemory {
  return new Supermemory({
    apiKey,
    baseUrl: (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    headers: memoryHeaders(apiKey, tag),
    timeoutInSeconds: REQUEST_TIMEOUT_MS / 1_000,
    maxRetries: 0,
  });
}

export async function memoryRequest<T>(request: PromiseLike<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    const status =
      (error as { statusCode?: number; status?: number })?.statusCode ??
      (error as { status?: number })?.status;
    throw new Error(
      status
        ? `Supermemory request failed with HTTP ${status}`
        : "Supermemory request failed or timed out",
    );
  }
}

export const AGENT_ENTITY_CONTEXT = `Shared coding-agent memory for one software repository.

RULES:
- Preserve durable context that helps Claude Code, Codex, OpenCode, or Cursor continue the work
- Condense assistant responses into decisions, outcomes, and reusable knowledge
- Keep user preferences and project facts concise and independently understandable

EXTRACT:
- User preferences, accepted decisions, durable workflows, actions, and learnings
- Architecture, conventions, implementation patterns, setup requirements, and decisions

SKIP:
- Generic assistant suggestions the user did not accept
- Transient command output and low-value implementation chatter
- Granular details that do not help future work`;

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function memoryHeaders(
  apiKey: string,
  containerTag: string,
): Record<string, string> {
  const contentHash = sha256(containerTag);
  const payload = [sha256(apiKey), contentHash, INTEGRITY_VERSION].join(":");
  const signature = createHmac("sha256", SEED)
    .update(payload)
    .digest("base64url");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Content-Hash": contentHash,
    "X-Request-Integrity": `v${INTEGRITY_VERSION}.${signature}`,
    "x-sm-source": "cursor",
  };
}

async function post(
  baseUrl: string | null,
  apiKey: string,
  path: string,
  containerTag: string,
  body: Record<string, unknown>,
): Promise<any> {
  const response = await fetch(
    `${(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "")}${path}`,
    {
      method: "POST",
      headers: memoryHeaders(apiKey, containerTag),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  ).catch(() => {
    throw new Error("Supermemory request failed or timed out");
  });
  if (!response.ok) {
    throw new Error(`Supermemory request failed with HTTP ${response.status}`);
  }
  return response.json().catch(() => {
    throw new Error("Supermemory returned an invalid response");
  });
}

export async function getProfile(
  baseUrl: string | null,
  apiKey: string,
  containerTag: string,
  query?: string,
  scope?: "personal" | "project",
  apiVersion?: string,
): Promise<any> {
  if (resolveApiVersion(baseUrl, apiVersion) === "v5") {
    const client = sdk(baseUrl, apiKey, containerTag);
    const options = {
      abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      maxRetries: 0,
    };
    const body: ProfileRequest = scope
      ? { filter: { field: "sm_scope", operator: "eq", value: scope } }
      : {};
    const [profile, searchResults] = await Promise.all([
      memoryRequest(client.profile(containerTag, body, options)),
      query
        ? searchMemories(
            baseUrl,
            apiKey,
            containerTag,
            query,
            scope,
            "v5",
            options.abortSignal,
          )
        : undefined,
    ]);
    return { ...profile, ...(searchResults ? { searchResults } : {}) };
  }
  return post(baseUrl, apiKey, "/v4/profile", containerTag, {
    containerTag,
    ...(query ? { q: query } : {}),
    ...(scope
      ? {
          filters: {
            AND: [{ key: "sm_scope", value: scope, filterType: "metadata" }],
          },
        }
      : {}),
  });
}

export async function addMemory(
  baseUrl: string | null,
  apiKey: string,
  content: string,
  containerTag: string,
  metadata: Record<string, unknown>,
  options: { customId?: string; entityContext?: string } = {},
  apiVersion?: string,
): Promise<any> {
  const version = resolveApiVersion(baseUrl, apiVersion);
  const result =
    version === "v5"
      ? await memoryRequest(
          sdk(baseUrl, apiKey, containerTag).add(
            containerTag,
            {
              content,
              id: options.customId,
              supportingContext: options.entityContext,
              metadata: {
                sm_source: "cursor",
                ...metadata,
              } as AddRequest["metadata"],
              taskType: "memory",
              dreaming: "dynamic",
            },
            {
              abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
              maxRetries: 0,
            },
          ),
        )
      : await post(baseUrl, apiKey, "/v3/documents", containerTag, {
          content,
          containerTag,
          metadata: { sm_source: "cursor", ...metadata },
          customId: options.customId,
          entityContext: options.entityContext,
        });
  validateDocumentAcceptance(result, version);
  return result;
}

export function validateDocumentAcceptance(
  result: any,
  version: "v5" | "legacy",
): void {
  if (
    typeof result?.id !== "string" ||
    !result.id.trim() ||
    (version === "v5" &&
      ![
        "unknown",
        "queued",
        "extracting",
        "chunking",
        "embedding",
        "indexing",
        "done",
      ].includes(result.status)) ||
    result.status === "failed" ||
    result.error
  ) {
    throw new Error("Supermemory did not acknowledge the document");
  }
}

export async function searchMemories(
  baseUrl: string | null,
  apiKey: string,
  containerTag: string,
  query: string,
  scope?: "personal" | "project",
  apiVersion?: string,
  abortSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS),
): Promise<any> {
  if (resolveApiVersion(baseUrl, apiVersion) === "legacy") {
    return getProfile(baseUrl, apiKey, containerTag, query, scope, "legacy");
  }
  return memoryRequest(
    sdk(baseUrl, apiKey, containerTag).search(
      containerTag,
      {
        query,
        searchMode: "memories",
        threshold: 0.55,
        limit: 10,
        rerank: "none",
        rewriteQuery: false,
        ...(scope
          ? {
              filter: {
                field: "sm_scope",
                operator: "eq",
                value: scope,
              } as const,
            }
          : {}),
      },
      { abortSignal, maxRetries: 0 },
    ),
  );
}

export function getProfiles(
  baseUrl: string | null,
  apiKey: string,
  tags: string[],
  query?: string,
  canonicalScope?: "personal" | "project",
  apiVersion?: string,
): Promise<any[]> {
  return readNamespaces(tags, (tag, index) =>
    getProfile(
      baseUrl,
      apiKey,
      tag,
      query,
      index === 0 ? canonicalScope : undefined,
      apiVersion,
    ),
  );
}

export function getSearches(
  baseUrl: string | null,
  apiKey: string,
  tags: string[],
  query: string,
  apiVersion?: string,
): Promise<any[]> {
  return readNamespaces(tags, (tag) =>
    searchMemories(baseUrl, apiKey, tag, query, undefined, apiVersion),
  );
}

async function readNamespaces(
  tags: string[],
  read: (tag: string, index: number) => Promise<any>,
): Promise<any[]> {
  const results = await Promise.allSettled(
    [...new Set(tags.filter(Boolean))].map(read),
  );
  const values = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  if (!values.length) {
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    throw failure?.reason ?? new Error("Supermemory is unreachable");
  }
  return values;
}
