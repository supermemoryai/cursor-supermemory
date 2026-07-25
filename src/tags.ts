import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { hostname, homedir, userInfo } from "node:os";
import {
  basename,
  dirname,
  join,
  resolve,
  sep,
} from "node:path";
import type { Config } from "./config.ts";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export function getGitRoot(directory: string): string | null {
  const isolateWorktrees =
    process.env.SUPERMEMORY_ISOLATE_WORKTREES === "true";

  try {
    if (isolateWorktrees) {
      return (
        execSync("git rev-parse --show-toplevel", {
          cwd: directory,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }).trim() || null
      );
    }

    const gitCommonDir = execSync("git rev-parse --git-common-dir", {
      cwd: directory,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (gitCommonDir === ".git") {
      return (
        execSync("git rev-parse --show-toplevel", {
          cwd: directory,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }).trim() || null
      );
    }

    const resolvedCommonDir = resolve(directory, gitCommonDir);
    if (
      basename(resolvedCommonDir) === ".git" &&
      !resolvedCommonDir.includes(`${sep}.git${sep}`)
    ) {
      return dirname(resolvedCommonDir);
    }

    return (
      execSync("git rev-parse --show-toplevel", {
        cwd: directory,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim() || null
    );
  } catch {
    return null;
  }
}

function getProjectBasePath(directory: string): string {
  return getGitRoot(directory) || resolve(directory);
}

function getGitEmail(directory: string): string | null {
  try {
    return (
      execSync("git config user.email", {
        cwd: getProjectBasePath(directory),
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim() || null
    );
  } catch {
    return null;
  }
}

function getMachineId(): string {
  return `${hostname()}_${userInfo().username}`;
}

export function normalizeGitRemote(remoteUrl: string): string | null {
  const raw = remoteUrl.trim();
  if (!raw) return null;

  let normalized: string;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      normalized =
        parsed.protocol === "file:"
          ? `file:${decodeURIComponent(parsed.pathname)}`
          : `${parsed.hostname.toLowerCase()}${
              parsed.port ? `:${parsed.port}` : ""
            }/${parsed.pathname.replace(/^\/+/, "")}`;
    } catch {
      normalized = raw;
    }
  } else {
    const scpStyle = raw.match(/^(?:[^@/]+@)?([^:]+):(.+)$/);
    normalized = scpStyle
      ? `${scpStyle[1].toLowerCase()}/${scpStyle[2]}`
      : `file:${resolve(raw)}`;
  }

  return normalized
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "")
    .replace(/\/{2,}/g, "/")
    .toLowerCase();
}

const repoInfoCache = new Map<
  string,
  { name: string | null; normalizedRemote: string | null }
>();

function getGitRepoInfo(directory: string): {
  name: string | null;
  normalizedRemote: string | null;
} {
  const cached = repoInfoCache.get(directory);
  if (cached) return cached;

  try {
    const remoteUrl = execSync("git remote get-url origin", {
      cwd: directory,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const normalizedRemote = normalizeGitRemote(remoteUrl);
    const displayRemote = remoteUrl.replace(/\/+$/, "").replace(/\.git$/i, "");
    const separator = Math.max(
      displayRemote.lastIndexOf("/"),
      displayRemote.lastIndexOf(":"),
    );
    const result = {
      name: displayRemote.slice(separator + 1) || null,
      normalizedRemote,
    };
    repoInfoCache.set(directory, result);
    return result;
  } catch {
    const result = { name: null, normalizedRemote: null };
    repoInfoCache.set(directory, result);
    return result;
  }
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf-8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function stripJsoncComments(content: string): string {
  let result = "";
  let index = 0;
  let inString = false;
  let singleLineComment = false;
  let multiLineComment = false;

  while (index < content.length) {
    const char = content[index];
    const next = content[index + 1];

    if (!singleLineComment && !multiLineComment && char === '"') {
      let backslashes = 0;
      for (
        let cursor = index - 1;
        cursor >= 0 && content[cursor] === "\\";
        cursor--
      ) {
        backslashes++;
      }
      if (backslashes % 2 === 0) inString = !inString;
      result += char;
      index++;
      continue;
    }

    if (inString) {
      result += char;
      index++;
      continue;
    }

    if (
      !singleLineComment &&
      !multiLineComment &&
      char === "/" &&
      next === "/"
    ) {
      singleLineComment = true;
      index += 2;
      continue;
    }
    if (
      !singleLineComment &&
      !multiLineComment &&
      char === "/" &&
      next === "*"
    ) {
      multiLineComment = true;
      index += 2;
      continue;
    }
    if (singleLineComment) {
      if (char === "\n") {
        singleLineComment = false;
        result += char;
      }
      index++;
      continue;
    }
    if (multiLineComment) {
      if (char === "*" && next === "/") {
        multiLineComment = false;
        index += 2;
        continue;
      }
      if (char === "\n") result += char;
      index++;
      continue;
    }

    result += char;
    index++;
  }

  return result.replace(/,\s*([}\]])/g, "$1");
}

function loadOpenCodeConfig(): Record<string, unknown> | null {
  const configDir = join(homedir(), ".config", "opencode");
  for (const filename of ["supermemory.jsonc", "supermemory.json"]) {
    try {
      const configPath = join(configDir, filename);
      if (!existsSync(configPath)) continue;
      return JSON.parse(
        stripJsoncComments(readFileSync(configPath, "utf-8")),
      ) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function stringValue(
  value: unknown,
): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uniqueTags(
  tags: Array<string | null | undefined>,
): string[] {
  return [
    ...new Set(
      tags.filter(
        (tag): tag is string =>
          typeof tag === "string" && tag.trim().length > 0,
      ),
    ),
  ];
}

export function sanitizeRepoName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return sanitized.slice(0, 95).replace(/_+$/g, "") || "unknown";
}

export function getProjectIdentity(directory: string): string {
  const basePath = getProjectBasePath(directory);
  const { normalizedRemote } = getGitRepoInfo(basePath);
  const isolateWorktrees =
    process.env.SUPERMEMORY_ISOLATE_WORKTREES === "true";
  let localIdentity = basePath;
  try {
    localIdentity = realpathSync.native(basePath);
  } catch {}

  return sha256(
    !isolateWorktrees && normalizedRemote
      ? normalizedRemote
      : `path:${localIdentity}`,
  );
}

export function getProjectName(directory: string): string {
  const basePath = getProjectBasePath(directory);
  return getGitRepoInfo(basePath).name || basename(basePath) || "unknown";
}

export function getGeneratedRepoTag(directory: string): string {
  const name = sanitizeRepoName(getProjectName(directory))
    .slice(0, 72)
    .replace(/_+$/g, "");
  return `repo_${name || "unknown"}__${getProjectIdentity(directory)}`;
}

function getLegacyRepoTag(directory: string): string {
  return `repo_${sanitizeRepoName(getProjectName(directory))}`;
}

function getLegacyCursorUserTags(
  directory: string,
  config: Config,
): string[] {
  const identities = uniqueTags([
    config.userContainerTag ||
      process.env.SUPERMEMORY_USER_TAG ||
      process.env.CURSOR_USER_EMAIL ||
      getGitEmail(directory) ||
      getMachineId(),
  ]);
  return identities.map((identity) => `cursor_user_${sha256(identity)}`);
}

function getLegacyCursorProjectTags(
  directory: string,
  config: Config,
): string[] {
  const basePath = getProjectBasePath(directory);
  const identities = uniqueTags([
    config.projectContainerTag ||
      process.env.SUPERMEMORY_PROJECT_TAG ||
      basePath,
  ]);
  return identities.map((identity) => `cursor_project_${sha256(identity)}`);
}

function getLegacyClaudeTags(directory: string): {
  personal: string[];
  project: string[];
  repoContainerTag: string | null;
} {
  const basePath = getProjectBasePath(directory);
  const projectHash = sha256(basePath);
  const config = readJson(
    join(basePath, ".claude", ".supermemory-claude", "config.json"),
  );
  return {
    personal: uniqueTags([
      stringValue(config?.personalContainerTag),
      `user_project_${projectHash}`,
      `claudecode_project_${projectHash}`,
    ]),
    project: uniqueTags([
      stringValue(config?.repoContainerTag),
      getLegacyRepoTag(directory),
    ]),
    repoContainerTag: stringValue(config?.repoContainerTag),
  };
}

function getLegacyCodexTags(directory: string): {
  personal: string[];
  project: string[];
  projectContainerTag: string | null;
} {
  const config = readJson(join(homedir(), ".codex", "supermemory.json"));
  const prefix = stringValue(config?.containerTagPrefix) || "codex";
  const userIdentity =
    getGitEmail(directory) ||
    process.env.USER ||
    process.env.USERNAME ||
    hostname();
  const userHash = sha256(userIdentity);
  const projectHash = sha256(getProjectBasePath(directory));
  return {
    personal: uniqueTags([
      stringValue(config?.userContainerTag),
      `${prefix}_user_${userHash}`,
      `codex_user_${userHash}`,
    ]),
    project: uniqueTags([
      stringValue(config?.projectContainerTag),
      `${prefix}_project_${projectHash}`,
      `codex_project_${projectHash}`,
    ]),
    projectContainerTag: stringValue(config?.projectContainerTag),
  };
}

function getLegacyOpenCodeTags(directory: string): {
  personal: string[];
  project: string[];
  projectContainerTag: string | null;
} {
  const config = loadOpenCodeConfig();
  const prefix = stringValue(config?.containerTagPrefix) || "opencode";
  const userIdentity =
    getGitEmail(directory) ||
    process.env.USER ||
    process.env.USERNAME ||
    "anonymous";
  const userHash = sha256(userIdentity);
  const projectHashes = [
    ...new Set(
      [directory, resolve(directory), getProjectBasePath(directory)].map(
        (value) => sha256(value),
      ),
    ),
  ];
  return {
    personal: uniqueTags([
      stringValue(config?.userContainerTag),
      `${prefix}_user_${userHash}`,
      `opencode_user_${userHash}`,
    ]),
    project: uniqueTags([
      stringValue(config?.projectContainerTag),
      ...projectHashes.flatMap((hash) => [
        `${prefix}_project_${hash}`,
        `opencode_project_${hash}`,
      ]),
    ]),
    projectContainerTag: stringValue(config?.projectContainerTag),
  };
}

export interface ResolvedTags {
  canonical: string;
  user: string;
  project: string;
  projectId: string;
  projectName: string;
  personalReads: string[];
  projectReads: string[];
  allReads: string[];
  legacyCursorPersonal: string[];
  legacyCursorProjects: string[];
}

export function getResolvedTags(
  directory: string,
  config: Config,
): ResolvedTags {
  const generated = getGeneratedRepoTag(directory);
  const cursorPersonal = getLegacyCursorUserTags(directory, config);
  const cursorProjects = getLegacyCursorProjectTags(directory, config);
  const claude = getLegacyClaudeTags(directory);
  const codex = getLegacyCodexTags(directory);
  const opencode = getLegacyOpenCodeTags(directory);
  const canonical =
    config.repoContainerTag ||
    process.env.SUPERMEMORY_REPO_TAG ||
    claude.repoContainerTag ||
    codex.projectContainerTag ||
    opencode.projectContainerTag ||
    generated;
  const personalReads = uniqueTags([
    canonical,
    generated,
    ...cursorPersonal,
    ...claude.personal,
    ...codex.personal,
    ...opencode.personal,
  ]);
  const projectReads = uniqueTags([
    canonical,
    generated,
    ...cursorProjects,
    ...claude.project,
    ...codex.project,
    ...opencode.project,
  ]);

  return {
    canonical,
    user: canonical,
    project: canonical,
    projectId: getProjectIdentity(directory),
    projectName: getProjectName(directory),
    personalReads,
    projectReads,
    allReads: uniqueTags([...personalReads, ...projectReads]),
    legacyCursorPersonal: cursorPersonal,
    legacyCursorProjects: cursorProjects,
  };
}

/** Backwards-compatible aliases for callers that have not moved to ResolvedTags. */
export function getUserTag(config: Config, directory = process.cwd()): string {
  return getResolvedTags(directory, config).canonical;
}

export function getProjectTag(
  workspaceRoot: string,
  config: Config,
): string {
  return getResolvedTags(workspaceRoot, config).canonical;
}
