import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitSseData } from "./mcp-proxy.ts";
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
    expect(response.error.message).toContain("not authenticated");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("the installer defaults to the user-level Cursor config", () => {
  expect(GLOBAL_MCP_PATH.endsWith(join(".cursor", "mcp.json"))).toBe(true);
});
