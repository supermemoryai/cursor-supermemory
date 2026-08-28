import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..");
const home = mkdtempSync(join(tmpdir(), "cursor-supermemory-hooks-"));
const workspace = join(home, "workspace");
const requests: Array<{ path: string; body: any }> = [];

let server: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  mkdirSync(workspace, { recursive: true });
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = await request.json();
      requests.push({ path: new URL(request.url).pathname, body });
      if (new URL(request.url).pathname === "/v4/profile") {
        return Response.json({
          profile: { static: ["Uses Bun"], dynamic: [] },
          searchResults: {
            results: [
              { memory: "The auth flow uses rotating tokens", similarity: 0.82 },
            ],
          },
        });
      }
      return Response.json({ id: "saved" });
    },
  });
});

afterAll(() => {
  server.stop(true);
  rmSync(home, { recursive: true, force: true });
});

async function runHook(file: string, input: Record<string, unknown>) {
  const child = Bun.spawn(["node", join(root, file)], {
    cwd: workspace,
    env: {
      ...Bun.env,
      HOME: home,
      USERPROFILE: home,
      CURSOR_PROJECT_DIR: workspace,
      SUPERMEMORY_API_KEY: "sm_test_key_0123456789",
      SUPERMEMORY_API_URL: server.url.toString(),
    },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  child.stdin.write(JSON.stringify(input));
  child.stdin.end();
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect(exitCode, stderr).toBe(0);
  return stdout;
}

describe("Cursor hook integration", () => {
  test("recalls before a prompt and injects after the first tool", async () => {
    const input = {
      conversation_id: "conversation-recall",
      generation_id: "generation-1",
      prompt: "continue fixing the authentication flow",
      workspace_roots: [workspace],
    };
    expect(JSON.parse(await runHook("dist/prompt-recall.js", input))).toEqual({
      continue: true,
    });
    const output = JSON.parse(
      await runHook("dist/inject-recall.js", input),
    );
    expect(output.additional_context).toContain(
      "- ◪ The auth flow uses rotating tokens",
    );
    expect(await runHook("dist/inject-recall.js", input)).toBe("");
  });

  test("keeps queued recall across a skipped follow-up prompt", async () => {
    const input = {
      conversation_id: "conversation-recall-skip",
      generation_id: "generation-keep",
      prompt: "continue fixing the authentication flow",
      workspace_roots: [workspace],
    };
    expect(JSON.parse(await runHook("dist/prompt-recall.js", input))).toEqual({
      continue: true,
    });
    expect(
      JSON.parse(
        await runHook("dist/prompt-recall.js", {
          ...input,
          generation_id: "generation-skip",
          prompt: "hi",
        }),
      ),
    ).toEqual({ continue: true });
    const output = JSON.parse(
      await runHook("dist/inject-recall.js", {
        ...input,
        generation_id: "generation-later",
      }),
    );
    expect(output.additional_context).toContain(
      "- ◪ The auth flow uses rotating tokens",
    );
  });

  test("captures only unsaved transcript entries", async () => {
    const transcriptPath = join(home, "transcript.jsonl");
    writeFileSync(
      transcriptPath,
      [
        {
          role: "user",
          content:
            "Please investigate the refresh-token failure and preserve the durable implementation details for our next session.",
        },
        {
          role: "assistant",
          content:
            "The token was expiring before rotation completed, so the implementation now rotates atomically and retries safely.",
        },
      ]
        .map((entry) => JSON.stringify(entry))
        .join("\n"),
    );
    const input = {
      conversation_id: "conversation-capture",
      generation_id: "generation-capture-1",
      status: "completed",
      transcript_path: transcriptPath,
      workspace_roots: [workspace],
    };
    const savesBefore = requests.filter(
      (request) => request.path === "/v3/documents",
    ).length;
    await runHook("dist/capture.js", input);
    await runHook("dist/capture.js", input);
    const saves = requests.filter(
      (request) => request.path === "/v3/documents",
    );
    expect(saves).toHaveLength(savesBefore + 1);
    expect(saves.at(-1)?.body.metadata.sm_capture_mode).toBe("stop");
    expect(saves.at(-1)?.body.content).toContain("rotates atomically");
  });
});
