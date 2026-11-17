import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..");
const home = mkdtempSync(join(tmpdir(), "cursor-supermemory-hooks-"));
const workspace = join(home, "workspace");
const requests: Array<{ path: string; body: any; headers: Headers }> = [];

let server: ReturnType<typeof Bun.serve>;
let failSessions = false;

beforeAll(() => {
  mkdirSync(workspace, { recursive: true });
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = await request.json();
      const path = new URL(request.url).pathname;
      requests.push({ path, body, headers: request.headers });
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
      if (path.endsWith("/document")) {
        return failSessions
          ? new Response("unavailable", { status: 503 })
          : Response.json({ id: body.id, status: "queued" });
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

  test("sends raw transcript deltas on v5 and advances only on success", async () => {
    const transcriptPath = join(home, "raw-transcript.jsonl");
    const line = (record: unknown) => `${JSON.stringify(record)}\n`;
    const first =
      line({
        role: "user",
        message: {
          content: [
            {
              type: "text",
              text: "<timestamp>now</timestamp>\n<user_query>\nFix token refresh — keep it atomic\n</user_query>",
            },
          ],
        },
      }) +
      line({
        role: "assistant",
        message: {
          content: [
            { type: "text", text: "Rotation is atomic now." },
            { type: "tool_use", name: "Shell", input: { command: "bun test" } },
          ],
        },
      });
    const second = line({ type: "turn_ended", status: "success" });
    writeFileSync(transcriptPath, `${first}{"type":"turn_`);
    const input = {
      conversation_id: "6f1c2a9e-raw-session",
      status: "completed",
      transcript_path: transcriptPath,
      workspace_roots: [workspace],
    };
    const v5 = { SUPERMEMORY_API_VERSION: "v5" };
    const sessions = () =>
      requests.filter((request) => request.path.endsWith("/document"));

    await runHook("dist/capture.js", input, v5);
    expect(sessions()).toHaveLength(1);
    const sent = sessions()[0]!;
    expect(sent.headers.get("x-sm-session")).toBe("cursor");
    expect(sent.headers.get("x-sm-source")).toBe("cursor");
    expect(sent.body).toMatchObject({
      id: input.conversation_id,
      content: first,
      taskType: "memory",
      dreaming: "dynamic",
      metadata: {
        sm_source: "cursor",
        sm_capture_mode: "stop",
        sessionId: input.conversation_id,
        sm_session_generation: 0,
        sm_session_offset: 0,
      },
    });
    expect(sent.body.supportingContext).toContain("coding-agent memory");

    await runHook("dist/capture.js", input, v5);
    expect(sessions()).toHaveLength(1);

    appendFileSync(transcriptPath, 'ended","status":"success"}\n');
    failSessions = true;
    await runHook("dist/capture.js", input, v5);
    failSessions = false;
    await runHook("dist/capture.js", input, v5);
    await runHook("dist/capture.js", input, v5);
    const offset = Buffer.byteLength(first);
    expect(sessions().slice(1).map((request) => request.body.content)).toEqual([
      second,
      second,
    ]);
    expect(
      sessions()
        .slice(1)
        .map((request) => request.body.metadata.sm_session_offset),
    ).toEqual([offset, offset]);

    const rewritten = line({
      role: "user",
      message: { content: [{ type: "text", text: "Summary" }] },
    });
    writeFileSync(transcriptPath, rewritten);
    await runHook("dist/capture.js", input, v5);
    writeFileSync(transcriptPath, first + second + second);
    await runHook("dist/capture.js", input, v5);
    expect(
      sessions()
        .slice(3)
        .map((request) => [
          request.body.metadata.sm_session_generation,
          request.body.metadata.sm_session_offset,
          request.body.content,
        ]),
    ).toEqual([
      [1, 0, rewritten],
      [2, 0, first + second + second],
    ]);
  });
});
