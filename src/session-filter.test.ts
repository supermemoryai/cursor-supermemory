import { describe, expect, test } from "bun:test";
import { loadConfig } from "./config.ts";
import { hasPrintFlag, isCursorCliPrintMode, sessionSkipReason } from "./session-filter.ts";

const config = loadConfig("/nonexistent");

function tree(processes: Record<number, { ppid: number; argv: string[] }>) {
  return (pid: number) => processes[pid] ?? null;
}

describe("session filter", () => {
  test("finds -p on the cursor-agent process above the hook", () => {
    const env = { CURSOR_INVOKED_AS: "cursor-agent" };
    const processes = (args: string[]) =>
      tree({
        30: { ppid: 20, argv: ["node", "/plugin/dist/capture.js"] },
        20: { ppid: 10, argv: ["/bin/bash", "-c", "node -e ..."] },
        10: { ppid: 1, argv: ["/home/u/.local/bin/cursor-agent", "--use-system-ca", "/x/index.js", ...args] },
      });
    expect(isCursorCliPrintMode(env, processes(["-p", "fix it"]), 30)).toBe(true);
    expect(isCursorCliPrintMode(env, processes(["--print", "--output-format", "json", "go"]), 30)).toBe(true);
    expect(isCursorCliPrintMode(env, processes(["--force", "explain -p"]), 30)).toBe(false);
    expect(isCursorCliPrintMode(env, processes(["--", "-p"]), 30)).toBe(false);
    expect(isCursorCliPrintMode({}, processes(["-p", "fix it"]), 30)).toBe(false);
  });

  test("stops at the prompt even when ps splits it into words", () => {
    const env = { CURSOR_INVOKED_AS: "cursor-agent" };
    const processes = (args: string[]) =>
      tree({
        30: { ppid: 10, argv: ["node", "/plugin/dist/capture.js"] },
        10: { ppid: 1, argv: ["cursor-agent", "--use-system-ca", "/x/index.js", ...args] },
      });
    expect(isCursorCliPrintMode(env, processes(["explain", "what", "the", "-p", "flag", "does"]), 30)).toBe(false);
    expect(isCursorCliPrintMode(env, processes(["--model", "gpt-5", "-p", "fix", "it"]), 30)).toBe(true);
    expect(hasPrintFlag(["-fp", "go"])).toBe(true);
    expect(hasPrintFlag(["--resume", "chat-1", "--print"])).toBe(true);
    expect(hasPrintFlag(["--output-format", "json", "fix", "-p"])).toBe(false);
  });

  test("orchestrator sessions count as interactive", () => {
    const headless = { is_background_agent: true };
    expect(sessionSkipReason(headless, config, {}, {})).toBe("headless");
    expect(sessionSkipReason(headless, config, {}, { CONDUCTOR_SESSION_ID: "s" })).toBeNull();
    expect(
      sessionSkipReason({}, { ...config, captureOrchestrated: false }, {}, { VK_WORKSPACE_ID: "w" }),
    ).toBe("orchestrated");
    expect(
      sessionSkipReason({ parent_tool_call_id: "t" }, config, {}, { CONDUCTOR_WORKSPACE_PATH: "/w" }),
    ).toBe("subagent");
  });

  test("recognises a Cursor subagent by its transcript location", () => {
    const transcript_path =
      "/home/u/.cursor/projects/home-u-app/agent-transcripts/b139/subagents/8cf9.jsonl";
    expect(sessionSkipReason({ transcript_path }, config, {}, {})).toBe("subagent");
    expect(
      sessionSkipReason(
        { transcript_path: "/home/u/.cursor/projects/home-u-subagents/agent-transcripts/b139/b139.jsonl" },
        config,
        {},
        {},
      ),
    ).toBeNull();
  });

  test("opt-in flags restore capture for each class", () => {
    expect(sessionSkipReason({ subagentType: "explore" }, { ...config, captureSubagents: true }, {}, {})).toBeNull();
    expect(sessionSkipReason({}, { ...config, captureHeadless: true }, { backgroundAgent: true }, {})).toBeNull();
    expect(sessionSkipReason({}, config, { backgroundAgent: true }, {})).toBe("headless");
  });

  test("env flags accept yes/on/no/off and override config both ways", () => {
    try {
      for (const [value, expected] of [["YES", true], ["on", true], ["1", true], ["No", false], ["off", false], ["0", false]] as const) {
        process.env.SUPERMEMORY_CAPTURE_HEADLESS = value;
        process.env.SUPERMEMORY_CAPTURE_ORCHESTRATED = value;
        expect(loadConfig("/nonexistent").captureHeadless).toBe(expected);
        expect(loadConfig("/nonexistent").captureOrchestrated).toBe(expected);
      }
      process.env.SUPERMEMORY_CAPTURE_HEADLESS = "maybe";
      expect(loadConfig("/nonexistent").captureHeadless).toBe(false);
    } finally {
      delete process.env.SUPERMEMORY_CAPTURE_HEADLESS;
      delete process.env.SUPERMEMORY_CAPTURE_ORCHESTRATED;
    }
  });
});
