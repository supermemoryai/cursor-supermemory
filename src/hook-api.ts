import { createHash, createHmac } from "node:crypto";

const DEFAULT_BASE_URL = "https://api.supermemory.ai";
const REQUEST_TIMEOUT_MS = 3_000;
const INTEGRITY_VERSION = 1;
const SEED =
  "7f2a9c4b8e1d6f3a5c0b9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a";

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

function headers(apiKey: string, containerTag: string): Record<string, string> {
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
      headers: headers(apiKey, containerTag),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail || `Supermemory request failed with HTTP ${response.status}`,
    );
  }
  return response.json();
}

export function getProfile(
  baseUrl: string | null,
  apiKey: string,
  containerTag: string,
  query?: string,
  scope?: "personal" | "project",
): Promise<any> {
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

export function addMemory(
  baseUrl: string | null,
  apiKey: string,
  content: string,
  containerTag: string,
  metadata: Record<string, unknown>,
  options: { customId?: string; entityContext?: string } = {},
): Promise<any> {
  return post(baseUrl, apiKey, "/v3/documents", containerTag, {
    content,
    containerTag,
    metadata: { sm_source: "cursor", ...metadata },
    customId: options.customId,
    entityContext: options.entityContext,
  });
}

export async function getProfiles(
  baseUrl: string | null,
  apiKey: string,
  tags: string[],
  query?: string,
  canonicalScope?: "personal" | "project",
): Promise<any[]> {
  const uniqueTags = [...new Set(tags.filter(Boolean))];
  const results = await Promise.allSettled(
    uniqueTags.map((tag, index) =>
      getProfile(
        baseUrl,
        apiKey,
        tag,
        query,
        index === 0 ? canonicalScope : undefined,
      ),
    ),
  );
  const profiles = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  if (profiles.length === 0) {
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    throw failure?.reason ?? new Error("Supermemory is unreachable");
  }
  return profiles;
}
