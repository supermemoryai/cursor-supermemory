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

async function runHook(
  file: string,
  input: Record<string, unknown>,
  env: Record<string, string> = {},
) {
  const child = Bun.spawn(["node", join(root, file)], {
    cwd: workspace,
    env: {
      ...Bun.env,
      HOME: home,
      USERPROFILE: home,
      CURSOR_PROJECT_DIR: workspace,
      SUPERMEMORY_API_KEY: "sm_test_key_0123456789",
      SUPERMEMORY_API_URL: server.url.toString(),
      ...env,
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
      prompt: "keep fixing the authentication flow",
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
test("skips every API call for subagent and background sessions unless opted in", async () => {
    const transcriptPath = join(home, "subagent-transcript.jsonl");
    writeFileSync(
      transcriptPath,
      [
        { role: "user", content: "Explore the payment module and list every file that touches refunds in detail." },
        { role: "assistant", content: "The refund flow lives in payments/refunds.ts and payments/ledger.ts, with retries in jobs/refund-retry.ts." },
      ]
        .map((entry) => JSON.stringify(entry))
        .join("\n"),
    );
    const sessions = [
      { conversation_id: "subagent-cursor", parent_conversation_id: "parent-1" },
      { conversation_id: "subagent-grok", subagentType: "explore" },
      { conversation_id: "background-agent", is_background_agent: true },
    ];
    for (const session of sessions) {
      const before = requests.length;
      const input = {
        ...session,
        generation_id: `${session.conversation_id}-gen`,
        prompt: `look into the refund retries for ${session.conversation_id}`,
        status: "completed",
        transcript_path: transcriptPath,
        workspace_roots: [workspace],
      };
      expect(JSON.parse(await runHook("dist/session-start.js", input))).toEqual({});
      await runHook("dist/prompt-recall.js", input);
      await runHook("dist/capture.js", input);
      expect(requests.length).toBe(before);
      const flag: Record<string, string> = {
        [`SUPERMEMORY_CAPTURE_${"is_background_agent" in session ? "HEADLESS" : "SUBAGENTS"}`]: "true",
      };
      await runHook("dist/session-start.js", input, flag);
      await runHook("dist/prompt-recall.js", input, flag);
      await runHook("dist/capture.js", input, flag);
      const paths = requests.slice(before).map((request) => request.path);
      expect(paths).toContain("/v4/profile");
      expect(paths).toContain("/v3/documents");
    }
  });

  test("treats orchestrator sessions as interactive and honours captureOrchestrated", async () => {
    const input = {
      conversation_id: "conductor-session",
      generation_id: "conductor-gen",
      prompt: "wire the conductor workspace into the deploy script",
      workspace_roots: [workspace],
    };
    const before = requests.length;
    await runHook("dist/prompt-recall.js", input, { CONDUCTOR_WORKSPACE_PATH: workspace });
    expect(requests.length).toBeGreaterThan(before);
    const skipped = requests.length;
    await runHook(
      "dist/prompt-recall.js",
      { ...input, conversation_id: "vk-session", prompt: "wire the kanban workspace into the deploy script" },
      { VK_WORKSPACE_ID: "vk-1", SUPERMEMORY_CAPTURE_ORCHESTRATED: "false" },
    );
    expect(requests.length).toBe(skipped);
  });

  test("recalls an identical query once per container within the window", async () => {
    const prompt = "summarise the swarm worker task for the billing service";
    const searches = () => requests.filter((request) => request.body?.q === prompt).length;
    await runHook("dist/prompt-recall.js", { conversation_id: "worker-1", prompt, workspace_roots: [workspace] });
    const once = searches();
    expect(once).toBeGreaterThan(0);
    await runHook("dist/prompt-recall.js", { conversation_id: "worker-2", prompt, workspace_roots: [workspace] });
    expect(searches()).toBe(once);
    await runHook(
      "dist/prompt-recall.js",
      { conversation_id: "worker-3", prompt, workspace_roots: [workspace] },
      { SUPERMEMORY_DEDUPE_RECALL_QUERIES: "false" },
    );
    expect(searches()).toBe(once * 2);
  });

  test("replaces an opening prompt already captured from this machine with a marker", async () => {
    const opening = "Run the nightly reconciliation task across every ledger shard and report mismatches.";
    const capture = async (id: string, env: Record<string, string> = {}) => {
      const transcriptPath = join(home, `${id}.jsonl`);
      writeFileSync(
        transcriptPath,
        [
          { role: "user", content: opening },
          { role: "assistant", content: `Shard report for ${id}: two mismatches found in the EU ledger and queued for review.` },
        ]
          .map((entry) => JSON.stringify(entry))
          .join("\n"),
      );
      await runHook(
        "dist/capture.js",
        { conversation_id: id, generation_id: `${id}-gen`, status: "completed", transcript_path: transcriptPath, workspace_roots: [workspace] },
        env,
      );
      return requests.filter((request) => request.path === "/v3/documents").at(-1)?.body.content as string;
    };
    expect(await capture("opening-1")).toContain(opening);
    const second = await capture("opening-2");
    expect(second).not.toContain(opening);
    expect(second).toContain("opening prompt already captured from this machine");
    expect(second).toContain("Shard report for opening-2");
    expect(await capture("opening-3", { SUPERMEMORY_DEDUPE_OPENING_PROMPT: "false" })).toContain(opening);
  });
});
