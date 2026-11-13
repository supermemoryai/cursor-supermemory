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

const VALUE_OPTIONS = new Set([
  "--api-key",
  "-H",
  "--header",
  "-e",
  "--endpoint",
  "--output-format",
  "--mode",
  "--model",
  "--sandbox",
  "--workspace",
  "--add-dir",
  "--plugin-dir",
  "--worktree-base",
]);
const OPTIONAL_VALUE_OPTIONS = new Set(["--resume", "-w", "--worktree"]);

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

// Reads cursor-agent options up to the first positional (the prompt), so prompt words never count as -p.
export function hasPrintFlag(args: string[]): boolean {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--" || arg === "-" || !arg.startsWith("-")) return false;
    if (arg === "-p" || arg === "--print") return true;
    if (arg.includes("=")) continue;
    const next = args[i + 1];
    const takesNext = (option: string) =>
      VALUE_OPTIONS.has(option) ||
      (OPTIONAL_VALUE_OPTIONS.has(option) && next !== undefined && !next.startsWith("-"));
    if (!arg.startsWith("--") && arg.length > 2) {
      const flags = arg.slice(1);
      const value = [...flags].findIndex((letter) => "Hew".includes(letter));
      if (flags.slice(0, value < 0 ? undefined : value).includes("p")) return true;
      if (value === flags.length - 1 && takesNext(`-${flags[value]}`)) i++;
      continue;
    }
    if (takesNext(arg)) i++;
  }
  return false;
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
      const script = proc.argv.slice(1).findIndex((arg) => !arg.startsWith("--")) + 1;
      return hasPrintFlag(
        proc.argv.slice(/[\\/]index\.js$/.test(proc.argv[script] ?? "") ? script + 1 : 1),
      );
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
