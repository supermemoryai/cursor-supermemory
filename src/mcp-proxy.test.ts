import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitSseData, markMemoryResult, withRepoNamespace } from "./mcp-proxy.ts";
import { GLOBAL_MCP_PATH, writeGlobalMcpEntry } from "./mcp-install.ts";

const root = join(import.meta.dir, "..");

test("unwraps SSE frames into newline-delimited JSON-RPC", () => {
  const written: string[] = [];
  emitSseData(
    "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":1}\n\nevent: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":2}\n\n",
    (line) => written.push(line),
  );
  expect(written).toEqual([
    '{"jsonrpc":"2.0","id":1}\n',
    '{"jsonrpc":"2.0","id":2}\n',
  ]);
});

test("mcp-install writes an absolute proxy path and keeps other servers", () => {
  const home = mkdtempSync(join(tmpdir(), "cursor-supermemory-mcp-"));
  try {
    const configPath = join(home, "mcp.json");
    writeFileSync(
      configPath,
      JSON.stringify({ mcpServers: { other: { url: "https://example.com" } } }),
    );
    writeGlobalMcpEntry("/plugins/cursor-supermemory/dist/cli.js", configPath);
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.mcpServers.other).toEqual({ url: "https://example.com" });
    expect(config.mcpServers.supermemory.args).toEqual([
      "/plugins/cursor-supermemory/dist/cli.js",
      "mcp",
    ]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("forwards a request to the configured MCP endpoint with the API key", async () => {
  const received: { auth: string | null; body: any } = { auth: null, body: null };
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      received.auth = request.headers.get("authorization");
      received.body = await request.json();
      return new Response('data: {"jsonrpc":"2.0","id":1,"result":{"tools":[]}}\n\n', {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });

  try {
    const child = Bun.spawn(["node", join(root, "dist/cli.js"), "mcp"], {
      env: {
        ...Bun.env,
        SUPERMEMORY_API_KEY: "sm_test_key_0123456789",
        SUPERMEMORY_MCP_URL: server.url.toString(),
      },
      stdin: "pipe",
      stdout: "pipe",
    });
    child.stdin.write('{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n');
    child.stdin.end();
    const stdout = await new Response(child.stdout).text();

    expect(received.auth).toBe("Bearer sm_test_key_0123456789");
    expect(received.body.method).toBe("tools/list");
    expect(stdout.trim()).toBe('{"jsonrpc":"2.0","id":1,"result":{"tools":[]}}');
  } finally {
    server.stop(true);
  }
});

test("answers with a JSON-RPC error when no credentials are available", async () => {
  const home = mkdtempSync(join(tmpdir(), "cursor-supermemory-noauth-"));
  try {
    const child = Bun.spawn(["node", join(root, "dist/cli.js"), "mcp"], {
      env: {
        PATH: Bun.env.PATH,
        HOME: home,
        USERPROFILE: home,
      },
      stdin: "pipe",
      stdout: "pipe",
    });
    child.stdin.write('{"jsonrpc":"2.0","id":7,"method":"tools/list"}\n');
    child.stdin.end();
    const response = JSON.parse(await new Response(child.stdout).text());
    expect(response.id).toBe(7);
    expect(response.error.message).toContain("not connected");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("the installer defaults to the user-level Cursor config", () => {
  expect(GLOBAL_MCP_PATH.endsWith(join(".cursor", "mcp.json"))).toBe(true);
});

test("defaults space-scoped tools to the repository namespace", () => {
  const call = (name: string, args?: Record<string, unknown>) => ({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: args },
  });
  const args = (message: unknown) =>
    (message as { params: { arguments: Record<string, unknown> } }).params.arguments;

  expect(args(withRepoNamespace(call("search_memory", { query: "auth" }), "repo_app__1"))).toEqual({
    query: "auth",
    namespace: "repo_app__1",
  });
  expect(args(withRepoNamespace(call("get_profile"), "repo_app__1"))).toEqual({
    namespace: "repo_app__1",
  });
  expect(
    args(withRepoNamespace(call("add_memory", { content: "x", containerTag: "mine" }), "repo_app__1")),
  ).toEqual({ content: "x", containerTag: "mine" });
  expect(args(withRepoNamespace(call("who_am_i", {}), "repo_app__1"))).toEqual({});
  expect(args(withRepoNamespace(call("search_memory", { query: "q" }), null))).toEqual({ query: "q" });
});

test("marks memories in memory tool results and leaves other tools alone", () => {
  const response = (text: string, isError = false) => ({
    jsonrpc: "2.0",
    id: 1,
    result: { content: [{ type: "text", text }], isError },
  });
  const texts = (value: unknown) =>
    (value as { result: { content: { text: string }[] } }).result.content.map((item) => item.text);

  const search = texts(
    markMemoryResult(
      "search_memory",
      response("## Matching memories\n- m1 [82%] Uses Bun (document: d1)\n- m2 [70%] Ships on Fridays"),
    ),
  );
  expect(search[0]).toBe(
    "## Matching memories\n- ◪ m1 [82%] Uses Bun (document: d1)\n- ◪ m2 [70%] Ships on Fridays",
  );
  expect(search[1]).toContain("credit it naturally with the ◪ prefix");

  expect(
    texts(markMemoryResult("get_profile", response("## Stable Context\n- Likes Helix\n- +3 more")))[0],
  ).toBe("## Stable Context\n- ◪ Likes Helix\n- +3 more");
  expect(
    texts(markMemoryResult("list_memories", response("1 active memory\n\n- [m1] Uses Bun\n  version 1")))[0],
  ).toBe("1 active memory\n\n- ◪ [m1] Uses Bun\n  version 1");
  expect(texts(markMemoryResult("search_memory", response("No matching memories found.")))).toHaveLength(1);
  expect(texts(markMemoryResult("search_memory", response("- broken", true)))).toEqual(["- broken"]);
  expect(texts(markMemoryResult("list_documents", response("- [d1] \"Doc\"")))).toEqual(['- [d1] "Doc"']);
});

test("the proxy scopes calls to the repository and marks recalled memories", async () => {
  const project = mkdtempSync(join(tmpdir(), "cursor-supermemory-project-"));
  let args: Record<string, unknown> = {};
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = await request.json();
      args = body.params.arguments;
      const result = {
        jsonrpc: "2.0",
        id: body.id,
        result: { content: [{ type: "text", text: "## Matching memories\n- m1 [90%] Prefers short answers" }] },
      };
      return new Response(`event: message\ndata: ${JSON.stringify(result)}\n\n`, {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  try {
    const child = Bun.spawn(["node", join(root, "dist/cli.js"), "mcp"], {
      cwd: project,
      env: {
        ...Bun.env,
        SUPERMEMORY_API_KEY: "sm_test_key_0123456789",
        SUPERMEMORY_MCP_URL: server.url.toString(),
        SUPERMEMORY_REPO_TAG: "repo_project__abc",
      },
      stdin: "pipe",
      stdout: "pipe",
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "search_memory", arguments: { query: "answers" } } })}\n`,
    );
    child.stdin.end();
    const response = JSON.parse(await new Response(child.stdout).text());

    expect(args).toEqual({ query: "answers", namespace: "repo_project__abc" });
    expect(response.result.content[0].text).toContain("- ◪ m1 [90%] Prefers short answers");
    expect(response.result.content[1].text).toContain("◪");
  } finally {
    server.stop(true);
    rmSync(project, { recursive: true, force: true });
  }
});

test("marks memory strings in structuredContent as well", () => {
  const marked = markMemoryResult("search_memory", {
    jsonrpc: "2.0",
    id: 1,
    result: {
      content: [{ type: "text", text: "- m1 [90%] Uses Bun" }],
      structuredContent: { query: "q", results: [{ id: "m1", text: "Uses Bun", similarity: 0.9 }] },
    },
  }) as { result: { structuredContent: { results: { id: string; text: string }[] } } };
  expect(marked.result.structuredContent.results[0]).toEqual({ id: "m1", text: "◪ Uses Bun", similarity: 0.9 } as never);

  const profile = markMemoryResult("get_profile", {
    jsonrpc: "2.0",
    id: 2,
    result: {
      content: [{ type: "text", text: "## Stable Context\n- Likes Helix" }],
      structuredContent: { namespace: "n", profile: { static: ["Likes Helix"], dynamic: [] } },
    },
  }) as { result: { structuredContent: { profile: { static: string[] } } } };
  expect(profile.result.structuredContent.profile.static).toEqual(["◪ Likes Helix"]);
});
