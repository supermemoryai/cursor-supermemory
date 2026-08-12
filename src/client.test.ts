import { expect, test } from "bun:test";
import { CursorMemoryClient, scopeFilters } from "./client.ts";

function createClientWithRequests() {
  const requests: Array<{ method: string; containerTag: string; input: any }> = [];
  const client = new CursorMemoryClient("test-api-key");

  (client as any).raw = (containerTag: string) => ({
    search: {
      memories: async (input: any) => {
        requests.push({ method: "search", containerTag, input });
        return { results: [] };
      },
    },
    profile: async (input: any) => {
      requests.push({ method: "profile", containerTag, input });
      return { profile: { static: [], dynamic: [] }, results: [] };
    },
    documents: {
      list: async (input: any) => {
        requests.push({ method: "list", containerTag, input });
        return { documents: [] };
      },
    },
  });

  return { client, requests };
}

const canonicalTag = "repo_cursor_supermemory__0123456789abcdef";
const generatedTag = "repo_cursor_supermemory__fedcba9876543210";
const legacyTag = "cursor_user_0123456789abcdef";

const personalFilters: ReturnType<typeof scopeFilters> = {
  AND: [
    { key: "agent_scope", value: "personal", filterType: "metadata" as const },
  ],
};

test("builds scoped filters from indexed agent_scope metadata", () => {
  expect(scopeFilters("personal")).toEqual(personalFilters);
  expect(JSON.stringify(scopeFilters("project"))).not.toContain("sm_scope");
});

test("scoped searches filter canonical and unified tags but preserve legacy reads", async () => {
  const { client, requests } = createClientWithRequests();

  await client.searchScoped(
    "recent decisions",
    canonicalTag,
    [canonicalTag, generatedTag, legacyTag],
    "personal",
    10,
  );

  expect(requests).toEqual([
    expect.objectContaining({
      method: "search",
      containerTag: canonicalTag,
      input: expect.objectContaining({ filters: personalFilters }),
    }),
    expect.objectContaining({
      method: "search",
      containerTag: generatedTag,
      input: expect.objectContaining({ filters: personalFilters }),
    }),
    expect.objectContaining({
      method: "search",
      containerTag: legacyTag,
      input: expect.objectContaining({ filters: undefined }),
    }),
  ]);
});

test("scoped profiles use agent_scope filters without filtering legacy containers", async () => {
  const { client, requests } = createClientWithRequests();

  await client.profileScoped(
    canonicalTag,
    [canonicalTag, legacyTag],
    "personal",
    undefined,
    10,
  );

  expect(requests).toEqual([
    expect.objectContaining({
      method: "profile",
      containerTag: canonicalTag,
      input: expect.objectContaining({ filters: personalFilters }),
    }),
    expect.objectContaining({
      method: "profile",
      containerTag: legacyTag,
      input: expect.objectContaining({ filters: undefined }),
    }),
  ]);
});

test("scoped lists send agent_scope filters to the server", async () => {
  const { client, requests } = createClientWithRequests();

  await client.listScoped(
    canonicalTag,
    [canonicalTag, generatedTag, legacyTag],
    "personal",
    10,
    2,
  );

  expect(requests).toEqual([
    expect.objectContaining({
      method: "list",
      containerTag: canonicalTag,
      input: {
        containerTags: [canonicalTag],
        limit: 10,
        page: 2,
        filters: personalFilters,
      },
    }),
    expect.objectContaining({
      method: "list",
      containerTag: generatedTag,
      input: {
        containerTags: [generatedTag],
        limit: 10,
        page: 2,
        filters: personalFilters,
      },
    }),
    expect.objectContaining({
      method: "list",
      containerTag: legacyTag,
      input: {
        containerTags: [legacyTag],
        limit: 10,
        page: 2,
        filters: undefined,
      },
    }),
  ]);
});
