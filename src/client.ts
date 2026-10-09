import {
  Supermemory,
  type AddRequest,
  type FilterExpression,
} from "supermemory";
import LegacySupermemory from "supermemory-legacy";
import compatibleFetch, {
  type RequestInfo,
  type RequestInit,
} from "node-fetch";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import {
  memoryHeaders,
  memoryRequest,
  resolveApiVersion,
  validateDocumentAcceptance,
} from "./hook-api.ts";
export { AGENT_ENTITY_CONTEXT } from "./hook-api.ts";

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;
const OPERATION_BUDGET_MS = REQUEST_TIMEOUT_MS * 5;
const DEFAULT_BASE_URL = "https://api.supermemory.ai";
const httpAgent = new HttpAgent({ keepAlive: true });
const httpsAgent = new HttpsAgent({ keepAlive: true });

export type MemoryScope = "personal" | "project";

function sdkFetch(input: RequestInfo, init?: RequestInit) {
  return compatibleFetch(input, {
    ...init,
    agent: (url) => (url.protocol === "http:" ? httpAgent : httpsAgent),
  });
}

function scopeFilters(scope: MemoryScope) {
  return {
    AND: [{ key: "sm_scope", value: scope, filterType: "metadata" as const }],
  };
}

function scopeFilter(scope?: MemoryScope): FilterExpression | undefined {
  return scope
    ? { field: "sm_scope", operator: "eq", value: scope }
    : undefined;
}

function normalizeResult(result: any): any {
  return {
    ...result,
    ...(result?.system?.createdAt
      ? { createdAt: result.system.createdAt }
      : {}),
    ...(result?.system?.updatedAt
      ? { updatedAt: result.system.updatedAt }
      : {}),
    ...(result?.system?.status ? { status: result.system.status } : {}),
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
    result?.memory ?? result?.content ?? result?.chunk ?? result?.context ?? "",
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
    ? facts.flatMap((fact) => {
        const text = typeof fact === "string" ? fact : fact?.memory;
        return typeof text === "string" && text.trim() ? [text] : [];
      })
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
          Number(a.similarity ?? a.score ?? 0) || resultDate(b) - resultDate(a),
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
  const memories = unique(responses.flatMap(listItems), (item) =>
    String(item?.id ?? searchText(item)),
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
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  throw firstError?.reason ?? new Error(message);
}

export class CursorMemoryClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl?: string | null,
    private readonly apiVersion?: string,
  ) {}

  private version(): "v5" | "legacy" {
    return resolveApiVersion(this.baseUrl ?? null, this.apiVersion);
  }

  private raw(containerTag: string): LegacySupermemory {
    return createClient(this.apiKey, containerTag, this.baseUrl);
  }

  private sdk(containerTag: string): Supermemory {
    return new Supermemory({
      apiKey: this.apiKey,
      baseUrl: (this.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ""),
      headers: memoryHeaders(this.apiKey, containerTag),
      timeoutInSeconds: REQUEST_TIMEOUT_MS / 1_000,
      maxRetries: MAX_RETRIES,
      fetch: sdkFetch as unknown as typeof fetch,
    });
  }

  async addMemory(
    content: string,
    containerTag: string,
    metadata: Record<string, unknown>,
    options: { customId?: string; entityContext?: string } = {},
  ) {
    const version = this.version();
    const signal = AbortSignal.timeout(OPERATION_BUDGET_MS);
    const result =
      version === "legacy"
        ? await memoryRequest(
            this.raw(containerTag).add(
              {
                content,
                containerTag,
                metadata: { sm_source: "cursor", ...metadata },
                customId: options.customId,
                entityContext: options.entityContext,
              },
              { signal, maxRetries: MAX_RETRIES, timeout: REQUEST_TIMEOUT_MS },
            ),
          )
        : await memoryRequest(
            this.sdk(containerTag).add(
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
                abortSignal: signal,
                maxRetries: MAX_RETRIES,
                timeoutInSeconds: REQUEST_TIMEOUT_MS / 1_000,
              },
            ),
          );
    validateDocumentAcceptance(result, version);
    return result;
  }

  private async searchOne(
    query: string,
    containerTag: string,
    limit: number,
    scope?: MemoryScope,
  ) {
    const signal = AbortSignal.timeout(OPERATION_BUDGET_MS);
    const result =
      this.version() === "legacy"
        ? await memoryRequest(
            this.raw(containerTag).search.memories(
              {
                q: query,
                containerTag,
                limit,
                searchMode: "hybrid",
                filters: scope ? scopeFilters(scope) : undefined,
              },
              { signal, maxRetries: MAX_RETRIES, timeout: REQUEST_TIMEOUT_MS },
            ),
          )
        : await memoryRequest(
            this.sdk(containerTag).search(
              containerTag,
              {
                query,
                searchMode: "hybrid",
                threshold: 0.6,
                limit,
                filter: scopeFilter(scope),
                rerank: "none",
                rewriteQuery: false,
              },
              {
                abortSignal: signal,
                maxRetries: MAX_RETRIES,
                timeoutInSeconds: REQUEST_TIMEOUT_MS / 1_000,
              },
            ),
          );
    return {
      ...result,
      results: (result.results ?? []).map((item: any) => ({
        ...normalizeResult(item),
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
      ...new Set(containerTags.filter((tag) => tag && tag !== canonicalTag)),
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
    const signal = AbortSignal.timeout(OPERATION_BUDGET_MS);
    if (this.version() === "legacy") {
      const body = {
        containerTag,
        q: query,
        filters: scope ? scopeFilters(scope) : undefined,
      };
      return memoryRequest(
        this.raw(containerTag).profile(body, {
          signal,
          maxRetries: MAX_RETRIES,
          timeout: REQUEST_TIMEOUT_MS,
        }),
      );
    }
    const [profile, searchResults] = await Promise.all([
      memoryRequest(
        this.sdk(containerTag).profile(
          containerTag,
          { filter: scopeFilter(scope) },
          {
            abortSignal: signal,
            maxRetries: MAX_RETRIES,
            timeoutInSeconds: REQUEST_TIMEOUT_MS / 1_000,
          },
        ),
      ),
      query ? this.searchOne(query, containerTag, 10, scope) : undefined,
    ]);
    return { ...profile, ...(searchResults ? { searchResults } : {}) };
  }

  async profileScoped(
    canonicalTag: string,
    containerTags: string[],
    scope: MemoryScope,
    query: string | undefined,
    limit: number,
  ) {
    const legacyTags = [
      ...new Set(containerTags.filter((tag) => tag && tag !== canonicalTag)),
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
    const signal = AbortSignal.timeout(OPERATION_BUDGET_MS);
    let result: any;
    if (this.version() === "legacy") {
      result = await memoryRequest(
        this.raw(containerTag).documents.list(
          {
            containerTags: [containerTag],
            limit,
            page,
          },
          { signal, maxRetries: MAX_RETRIES, timeout: REQUEST_TIMEOUT_MS },
        ),
      );
    } else {
      if (
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        !Number.isSafeInteger(page) ||
        page < 1
      ) {
        throw new Error("List limit and page must be positive integers.");
      }
      const offset = (page - 1) * limit;
      if (!Number.isSafeInteger(offset + limit))
        throw new Error("List page is out of range.");
      const pageSize = Math.min(limit, 100);
      const firstPage = Math.floor(offset / pageSize) + 1;
      const lastPage = Math.floor((offset + limit - 1) / pageSize) + 1;
      const pages = await Promise.all(
        Array.from({ length: lastPage - firstPage + 1 }, (_, index) =>
          memoryRequest(
            this.sdk(containerTag).list(
              containerTag,
              "documents",
              {
                page: firstPage + index,
                limit: pageSize,
                sort: "createdAt",
                order: "desc",
              },
              {
                abortSignal: signal,
                maxRetries: MAX_RETRIES,
                timeoutInSeconds: REQUEST_TIMEOUT_MS / 1_000,
              },
            ),
          ),
        ),
      );
      result = {
        memories: pages
          .flatMap((response) =>
            response.documents.map((document) => ({
              ...normalizeResult(document),
              containerTags: [containerTag],
            })),
          )
          .slice(offset % pageSize, (offset % pageSize) + limit),
      };
    }
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
      ...new Set(containerTags.filter((tag) => tag && tag !== canonicalTag)),
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
    if (
      (!input.id || !input.id.trim()) &&
      (!input.content || !input.content.trim())
    ) {
      throw new Error("Provide a nonempty memory id or exact content.");
    }
    const tags = [...new Set(containerTags.filter(Boolean))];
    const version = this.version();
    const settled = await Promise.allSettled(
      tags.map(async (containerTag) => {
        const signal = AbortSignal.timeout(OPERATION_BUDGET_MS);
        if (version === "legacy" || input.content !== undefined) {
          const result = await memoryRequest(
            this.raw(containerTag).memories.forget(
              {
                containerTag,
                ...input,
              },
              { signal, maxRetries: MAX_RETRIES, timeout: REQUEST_TIMEOUT_MS },
            ),
          );
          if (
            result.forgotten !== true ||
            typeof result.id !== "string" ||
            !result.id.trim() ||
            (input.id !== undefined && result.id !== input.id)
          ) {
            throw new Error(
              "Supermemory did not acknowledge the exact memory forget.",
            );
          }
          return result;
        }
        const result = await memoryRequest(
          this.sdk(containerTag).memories.forget(
            containerTag,
            { ids: [input.id!] },
            {
              abortSignal: signal,
              maxRetries: MAX_RETRIES,
              timeoutInSeconds: REQUEST_TIMEOUT_MS / 1_000,
            },
          ),
        );
        if (
          !Array.isArray(result.matches) ||
          !Array.isArray(result.errors) ||
          result.errors.length ||
          result.count !== 1 ||
          result.matches.length !== 1 ||
          result.matches[0]?.id !== input.id
        ) {
          throw new Error(
            "Supermemory reported an incomplete or invalid exact-ID forget.",
          );
        }
        return { id: input.id!, forgotten: true };
      }),
    );
    const results = settled.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    const errors = settled.flatMap((result, index) =>
      result.status === "rejected"
        ? [
            {
              containerTag: tags[index],
              ...(input.id ? { id: input.id } : {}),
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : "Exact forget failed.",
            },
          ]
        : [],
    );
    return { forgottenFrom: results.length, results, errors };
  }
}

export function createClient(
  apiKey: string,
  containerTag = "cursor",
  baseUrl?: string | null,
): LegacySupermemory {
  return new LegacySupermemory({
    apiKey,
    baseURL: baseUrl || undefined,
    defaultHeaders: memoryHeaders(apiKey, containerTag),
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
    logLevel: "off",
    fetch: sdkFetch as unknown as typeof fetch,
  });
}
