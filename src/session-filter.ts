import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { Config } from "./config.ts";
import type { HookState } from "./hook-state.ts";
import type { CursorHookInput } from "./hooks/types.ts";

export type SkipReason = "subagent" | "headless" | "orchestrated";

interface ProcessInfo {
  ppid: number;
  argv: string[];
}

const ORCHESTRATOR_ENV = [
  "CONDUCTOR_WORKSPACE_PATH",
  "CONDUCTOR_SESSION_ID",
  "VK_WORKSPACE_ID",
];

// Cursor marks subagents with a parent id or an agent-transcripts/<parent>/subagents/ transcript; Grok sends subagentType only from subagents.
export function isSubagentSession(input: CursorHookInput): boolean {
  return Boolean(
    input.parent_conversation_id ||
      input.parent_tool_call_id ||
      input.subagentType ||
      input.subagent_type ||
      /[\\/]agent-transcripts[\\/][^\\/]+[\\/]subagents[\\/]/.test(input.transcript_path ?? ""),
  );
}

export function isOrchestratedSession(env: NodeJS.ProcessEnv = process.env): boolean {
  return ORCHESTRATOR_ENV.some((name) => !!env[name]);
}

function readProcess(pid: number): ProcessInfo | null {
  try {
    const argv = readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean);
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    return { ppid: Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]), argv };
  } catch {}
  try {
    const match = execFileSync("ps", ["-o", "ppid=,args=", "-p", String(pid)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .match(/^(\d+)\s+(.*)$/s);
    return match ? { ppid: Number(match[1]), argv: match[2].split(/\s+/) } : null;
  } catch {
    return null;
  }
}

// The cursor-agent launcher exports CURSOR_INVOKED_AS and execs node under that name, so the CLI's own argv carries -p/--print.
export function isCursorCliPrintMode(
  env: NodeJS.ProcessEnv = process.env,
  read: (pid: number) => ProcessInfo | null = readProcess,
  startPid = process.ppid,
): boolean {
  const invokedAs = env.CURSOR_INVOKED_AS;
  if (!invokedAs) return false;
  let pid = startPid;
  for (let depth = 0; depth < 8 && pid > 1; depth++) {
    const proc = read(pid);
    if (!proc) return false;
    if (proc.argv[0] && basename(proc.argv[0]) === invokedAs) {
      const end = proc.argv.indexOf("--");
      return proc.argv
        .slice(1, end < 0 ? undefined : end)
        .some((arg) => arg === "-p" || arg === "--print");
    }
    pid = proc.ppid;
  }
  return false;
}

export function sessionSkipReason(
  input: CursorHookInput,
  config: Config,
  state: HookState = {},
  env: NodeJS.ProcessEnv = process.env,
): SkipReason | null {
  if (!config.captureSubagents && isSubagentSession(input)) return "subagent";
  if (isOrchestratedSession(env)) {
    return config.captureOrchestrated ? null : "orchestrated";
  }
  if (config.captureHeadless) return null;
  if (input.is_background_agent === true || state.backgroundAgent) return "headless";
  return isCursorCliPrintMode(env) ? "headless" : null;
}
