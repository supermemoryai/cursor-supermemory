import { createHash } from "node:crypto";
import { loadConfig, getAuthToken, isConfigured } from "../config.ts";
import { apiBackend, getSearches } from "../hook-api.ts";
import { readHookState, writeHookState, type HookState } from "../hook-state.ts";
import { getResolvedTags } from "../tags.ts";
import { sessionSkipReason } from "../session-filter.ts";
import { cacheRecall, cachedRecall } from "../repeat-guard.ts";
import {
  conversationId,
  type CursorHookInput,
  workspaceRoot,
} from "./types.ts";
import { isMainModule, runHook } from "../runtime.ts";

const MIN_PROMPT_LENGTH = 12;
const MAX_QUERY_LENGTH = 500;
const MAX_RESULTS = 5;
const MAX_RESULT_CHARS = 300;
const MIN_SIMILARITY = 0.55;
const MAX_SEEN_HASHES = 500;

interface RecallResult {
  chunk?: string;
  content?: string;
  filepath?: string;
  memory?: string;
  score?: number;
  similarity?: number;
  title?: string;
}

export function shouldSkipPrompt(prompt: unknown): boolean {
  if (typeof prompt !== "string" || prompt.trim().length < MIN_PROMPT_LENGTH) {
    return true;
  }
  const normalized = prompt.trim();
  return normalized.startsWith("/") || normalized.startsWith("!");
}

function resultText(result: RecallResult): string {
  return String(
    result.memory ?? result.chunk ?? result.content ?? result.title ?? "",
  ).trim();
}

function hashText(text: string): string {
  return createHash("sha256").update(text.toLowerCase()).digest("hex");
}

export function selectRecallResults(
  profiles: any[],
  seenHashes: string[],
  threshold = MIN_SIMILARITY,
): { fresh: RecallResult[]; hashes: string[] } {
  const seen = new Set(seenHashes);
  const candidates = profiles.flatMap((profile) => {
    const results = profile?.searchResults?.results ?? profile?.results;
    return Array.isArray(results) ? results : [];
  });
  const unique = new Set<string>();
  const fresh = candidates
    .filter((result): result is RecallResult => {
      const text = resultText(result);
      const score = Number(result.similarity ?? result.score ?? 0);
      const hash = hashText(text);
      if (!text || score < threshold || unique.has(hash) || seen.has(hash)) {
        return false;
      }
      unique.add(hash);
      return true;
    })
    .sort(
      (a, b) =>
        Number(b.similarity ?? b.score ?? 0) -
        Number(a.similarity ?? a.score ?? 0),
    )
    .slice(0, MAX_RESULTS);
  return {
    fresh,
    hashes: [
      ...seenHashes,
      ...fresh.map((result) => hashText(resultText(result))),
    ].slice(-MAX_SEEN_HASHES),
  };
}

export function formatRecall(
  results: RecallResult[],
  containerTag: string,
): string {
  const lines = results.map((result) => {
    const text = resultText(result).slice(0, MAX_RESULT_CHARS);
    const title = result.title?.trim();
    const body = title && text !== title ? `${title} — ${text}` : text;
    return `- ◪ ${body}${result.filepath ? ` (${result.filepath})` : ""}`;
  });
  return `<supermemory-recall>
Relevant memory for this turn. Every line marked ◪ came from Supermemory; use it when relevant and preserve the mark when attributing it.
Container: ${containerTag}

${lines.join("\n")}
</supermemory-recall>`;
}

// Returns the recall to queue for this prompt; undefined clears any queued recall.
async function recall(
  input: CursorHookInput,
  id: string,
): Promise<Partial<HookState> | undefined> {
  const root = workspaceRoot(input);
  const config = loadConfig(root);
  if (!isConfigured(config)) return;
  const state = readHookState(id);
  if (sessionSkipReason(input, config, state)) return;
  const tags = getResolvedTags(root, config);
  const query = input.prompt!.slice(0, MAX_QUERY_LENGTH);
  const token = await getAuthToken(config);
  const scope = {
    backend: apiBackend(config.baseUrl, config.apiVersion),
    credential: token,
    containerTags: tags.allReads,
  };
  const cached = config.dedupeRecallQueries ? cachedRecall(scope, query) : null;
  const profiles =
    cached ??
    (await getSearches(
      config.baseUrl,
      token,
      tags.allReads,
      query,
      config.apiVersion,
    ));
  if (
    !cached &&
    config.dedupeRecallQueries &&
    profiles.length === new Set(tags.allReads.filter(Boolean)).size
  ) {
    cacheRecall(scope, query, profiles);
  }
  const { fresh, hashes } = selectRecallResults(
    profiles,
    state.seenHashes ?? [],
    Math.max(MIN_SIMILARITY, config.similarityThreshold),
  );
  if (fresh.length === 0) return;
  return {
    pendingContext: formatRecall(fresh, tags.canonical),
    pendingGeneration: input.generation_id,
    seenHashes: hashes,
  };
}

export async function runPromptRecall(input: CursorHookInput): Promise<void> {
  if (shouldSkipPrompt(input.prompt)) {
    process.stdout.write(JSON.stringify({ continue: true }));
    return;
  }
  const id = conversationId(input);
  let update: Partial<HookState> = {
    pendingContext: undefined,
    pendingGeneration: undefined,
  };
  try {
    update = (await recall(input, id)) ?? update;
  } catch (error) {
    if (process.env.SUPERMEMORY_DEBUG === "true") {
      console.error("[supermemory] recall failed:", error);
    }
  }
  try {
    if (update.pendingContext || readHookState(id).pendingContext) {
      writeHookState(id, update);
    }
  } catch {}
  process.stdout.write(JSON.stringify({ continue: true }));
}

if (isMainModule(import.meta.url)) {
  await runHook<CursorHookInput>(runPromptRecall);
}
