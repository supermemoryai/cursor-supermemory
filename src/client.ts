import { createHash, createHmac } from "node:crypto";
import Supermemory from "supermemory";
export { AGENT_ENTITY_CONTEXT } from "./hook-api.ts";

const INTEGRITY_VERSION = 1;
const SEED =
  "7f2a9c4b8e1d6f3a5c0b9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a";
const CURSOR_SOURCE = "cursor";

export type MemoryScope = "personal" | "project";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function integrityHeaders(apiKey: string, containerTag: string) {
  const contentHash = sha256(containerTag);
  const payload = [sha256(apiKey), contentHash, INTEGRITY_VERSION].join(":");
  const sig = createHmac("sha256", SEED)
    .update(payload)
    .digest("base64url");
  return {
    "X-Content-Hash": contentHash,
    "X-Request-Integrity": `v${INTEGRITY_VERSION}.${sig}`,
    "x-sm-source": CURSOR_SOURCE,
  };
}

function scopeFilters(scope: MemoryScope) {
  return {
    AND: [{ key: "sm_scope", value: scope, filterType: "metadata" as const }],
  };
}

function supportsScopedCanonicalTag(containerTag: string): boolean {
  return /^repo_.+__[0-9a-f]{16}$/i.test(containerTag);
}

function unique<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = key(value).trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function searchText(result: any): string {
  return String(
    result?.memory ??
      result?.content ??
      result?.chunk ??
      result?.context ??
      "",
  );
}

function resultDate(result: any): number {
  const value = result?.updatedAt ?? result?.createdAt;
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function resultMetadata(result: any): Record<string, unknown> {
  if (result?.metadata && typeof result.metadata === "object") {
    return result.metadata as Record<string, unknown>;
  }
  if (
    result?.document?.metadata &&
    typeof result.document.metadata === "object"
  ) {
    return result.document.metadata as Record<string, unknown>;
  }
  return {};
}

function listItems(result: any): any[] {
  if (Array.isArray(result?.memories)) return result.memories;
  if (Array.isArray(result?.documents)) return result.documents;
  if (Array.isArray(result?.items)) return result.items;
  return [];
}

function profileFacts(result: any, kind: "static" | "dynamic"): string[] {
  const facts = result?.profile?.[kind];
  return Array.isArray(facts)
    ? facts.filter((fact): fact is string => typeof fact === "string")
    : [];
}

function searchResults(result: any): any[] {
  const values = result?.searchResults?.results ?? result?.results;
  return Array.isArray(values) ? values : [];
}

export function mergeSearchResults(
  responses: any[],
  limit: number,
): { results: any[]; total: number } {
  const merged = responses.flatMap((response) =>
    searchResults(response).map((result) => ({
      ...result,
      memory: searchText(result),
    })),
  );
  const results = unique(merged, (result) => result.id || searchText(result))
    .sort(
      (a, b) =>
        Number(b.similarity ?? b.score ?? 0) -
          Number(a.similarity ?? a.score ?? 0) ||
        resultDate(b) - resultDate(a),
    )
    .slice(0, limit);
  return { results, total: results.length };
}

function mergeProfiles(responses: any[], limit: number) {
  const staticFacts = unique(
    responses.flatMap((result) => profileFacts(result, "static")),
    (fact) => fact,
  );
  const dynamicFacts = unique(
    responses.flatMap((result) => profileFacts(result, "dynamic")),
    (fact) => fact,
  ).filter(
    (fact) =>
      !new Set(staticFacts.map((value) => value.toLowerCase())).has(
        fact.toLowerCase(),
      ),
  );
  const mergedSearch = mergeSearchResults(responses, limit);
  return {
    profile: { static: staticFacts, dynamic: dynamicFacts },
    searchResults: mergedSearch,
  };
}

function mergeLists(responses: any[], limit: number) {
  const memories = unique(
    responses.flatMap(listItems),
    (item) => String(item?.id ?? searchText(item)),
  )
    .sort((a, b) => resultDate(b) - resultDate(a))
    .slice(0, limit);
  return { memories };
}

function fulfilledOrThrow<T>(
  settled: PromiseSettledResult<T>[],
  message: string,
): T[] {
  const successful = settled
    .filter(
      (result): result is PromiseFulfilledResult<T> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);
  if (successful.length > 0) return successful;
  const firstError = settled.find(
    (result): result is PromiseRejectedResult =>
      result.status === "rejected",
  );
  throw firstError?.reason ?? new Error(message);
}

export class CursorMemoryClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl?: string | null,
  ) {}

  private raw(containerTag: string): Supermemory {
    return new Supermemory({
      apiKey: this.apiKey,
      baseURL: this.baseUrl || undefined,
      defaultHeaders: integrityHeaders(this.apiKey, containerTag),
    });
  }

  async addMemory(
    content: string,
    containerTag: string,
    metadata: Record<string, unknown>,
    options: { customId?: string; entityContext?: string } = {},
  ) {
    return this.raw(containerTag).add({
      content,
      containerTag,
      metadata: { sm_source: CURSOR_SOURCE, ...metadata },
      customId: options.customId,
      entityContext: options.entityContext,
    });
  }

  private async searchOne(
    query: string,
    containerTag: string,
    limit: number,
    scope?: MemoryScope,
  ) {
    const result = await this.raw(containerTag).search.memories({
      q: query,
      containerTag,
      limit,
      searchMode: "hybrid",
      filters: scope ? scopeFilters(scope) : undefined,
    });
    return {
      ...result,
      results: (result.results ?? []).map((item: any) => ({
        ...item,
        memory: searchText(item),
        containerTag,
      })),
    };
  }

  async searchMany(query: string, containerTags: string[], limit: number) {
    const settled = await Promise.allSettled(
      [...new Set(containerTags.filter(Boolean))].map((containerTag) =>
        this.searchOne(query, containerTag, limit),
      ),
    );
    return mergeSearchResults(
      fulfilledOrThrow(settled, "No memory containers could be searched"),
      limit,
    );
  }

  async searchScoped(
    query: string,
    canonicalTag: string,
    containerTags: string[],
    scope: MemoryScope,
    limit: number,
  ) {
    const legacyTags = [
      ...new Set(
        containerTags.filter(
          (tag) => tag && tag !== canonicalTag,
        ),
      ),
    ];
    const settled = await Promise.allSettled([
      this.searchOne(
        query,
        canonicalTag,
        limit,
        supportsScopedCanonicalTag(canonicalTag) ? scope : undefined,
      ),
      ...legacyTags.map((tag) => this.searchOne(query, tag, limit)),
    ]);
    return mergeSearchResults(
      fulfilledOrThrow(settled, "No memory containers could be searched"),
      limit,
    );
  }

  private async profileOne(
    containerTag: string,
    query?: string,
    scope?: MemoryScope,
  ) {
    return this.raw(containerTag).profile({
      containerTag,
      q: query,
      filters: scope ? scopeFilters(scope) : undefined,
    } as any);
  }

  async profileScoped(
    canonicalTag: string,
    containerTags: string[],
    scope: MemoryScope,
    query: string | undefined,
    limit: number,
  ) {
    const legacyTags = [
      ...new Set(
        containerTags.filter(
          (tag) => tag && tag !== canonicalTag,
        ),
      ),
    ];
    const settled = await Promise.allSettled([
      this.profileOne(
        canonicalTag,
        query,
        supportsScopedCanonicalTag(canonicalTag) ? scope : undefined,
      ),
      ...legacyTags.map((tag) => this.profileOne(tag, query)),
    ]);
    return mergeProfiles(
      fulfilledOrThrow(settled, "No memory profiles could be loaded"),
      limit,
    );
  }

  private async listOne(
    containerTag: string,
    limit: number,
    page: number,
    scope?: MemoryScope,
  ) {
    const result = await this.raw(containerTag).documents.list({
      containerTags: [containerTag],
      limit,
      page,
    });
    if (!scope) return result;
    const memories = listItems(result).filter(
      (item) => resultMetadata(item).sm_scope === scope,
    );
    return { ...result, memories };
  }

  async listScoped(
    canonicalTag: string,
    containerTags: string[],
    scope: MemoryScope,
    limit: number,
    page = 1,
  ) {
    const legacyTags = [
      ...new Set(
        containerTags.filter(
          (tag) => tag && tag !== canonicalTag,
        ),
      ),
    ];
    const settled = await Promise.allSettled([
      this.listOne(
        canonicalTag,
        Math.max(limit * 10, 100),
        page,
        supportsScopedCanonicalTag(canonicalTag) ? scope : undefined,
      ),
      ...legacyTags.map((tag) => this.listOne(tag, limit, page)),
    ]);
    return mergeLists(
      fulfilledOrThrow(settled, "No memory containers could be listed"),
      limit,
    );
  }

  async listMany(containerTags: string[], limit: number, page = 1) {
    const settled = await Promise.allSettled(
      [...new Set(containerTags.filter(Boolean))].map((tag) =>
        this.listOne(tag, limit, page),
      ),
    );
    return mergeLists(
      fulfilledOrThrow(settled, "No memory containers could be listed"),
      limit,
    );
  }

  async forgetMany(
    containerTags: string[],
    input: { id?: string; content?: string },
  ) {
    const settled = await Promise.allSettled(
      [...new Set(containerTags.filter(Boolean))].map((containerTag) =>
        this.raw(containerTag).memories.forget({
          containerTag,
          ...input,
        }),
      ),
    );
    const successful = fulfilledOrThrow(
      settled,
      "No memory containers could be updated",
    );
    return { forgottenFrom: successful.length, results: successful };
  }
}

/** Raw SDK compatibility helper retained for external imports. */
export function createClient(
  apiKey: string,
  containerTag = "cursor",
  baseUrl?: string | null,
): Supermemory {
  return new Supermemory({
    apiKey,
    baseURL: baseUrl || undefined,
    defaultHeaders: integrityHeaders(apiKey, containerTag),
  });
}
