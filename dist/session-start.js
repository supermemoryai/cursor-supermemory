// src/config.ts
import path2 from "node:path";
import os2 from "node:os";
import fs2 from "node:fs";

// src/auth.ts
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
var CREDENTIALS_DIR = path.join(os.homedir(), ".supermemory-cursor");
var CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");
function loadCredentials() {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE))
      return null;
    const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
    if (data.apiKey)
      return data;
    return null;
  } catch {
    return null;
  }
}

// src/config.ts
var GLOBAL_CONFIG_PATH = path2.join(os2.homedir(), ".config", "cursor", "supermemory.json");
var DEFAULTS = {
  baseUrl: null,
  similarityThreshold: 0.55,
  maxMemories: 10,
  maxProjectMemories: 5,
  injectProfile: true,
  signalExtraction: false,
  signalKeywords: ["remember", "architecture", "decision", "bug", "fix"],
  signalTurnsBefore: 3,
  repoContainerTag: null,
  userContainerTag: null,
  projectContainerTag: null
};
function readJson(filePath) {
  try {
    if (!fs2.existsSync(filePath))
      return null;
    return JSON.parse(fs2.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
function findProjectConfig(cwd) {
  let dir = cwd;
  while (true) {
    const configPath = path2.join(dir, ".cursor", ".supermemory", "config.json");
    const data = readJson(configPath);
    if (data)
      return data;
    const parent = path2.dirname(dir);
    if (parent === dir)
      break;
    dir = parent;
  }
  return null;
}
function loadConfig(cwd) {
  const projectConfig = findProjectConfig(cwd || process.cwd());
  const globalConfig = readJson(GLOBAL_CONFIG_PATH);
  const merged = { ...DEFAULTS, ...globalConfig, ...projectConfig };
  return {
    apiKey: process.env.SUPERMEMORY_API_KEY ?? merged.apiKey ?? null,
    baseUrl: process.env.SUPERMEMORY_API_URL ?? process.env.SUPERMEMORY_BASE_URL ?? merged.baseUrl ?? null,
    similarityThreshold: merged.similarityThreshold,
    maxMemories: merged.maxMemories,
    maxProjectMemories: merged.maxProjectMemories,
    injectProfile: merged.injectProfile,
    signalExtraction: merged.signalExtraction,
    signalKeywords: Array.isArray(merged.signalKeywords) ? merged.signalKeywords.filter((keyword) => typeof keyword === "string") : DEFAULTS.signalKeywords,
    signalTurnsBefore: merged.signalTurnsBefore,
    repoContainerTag: merged.repoContainerTag,
    userContainerTag: merged.userContainerTag,
    projectContainerTag: merged.projectContainerTag
  };
}
function getApiKey(config) {
  if (config.apiKey)
    return config.apiKey;
  const creds = loadCredentials();
  return creds?.apiKey ?? null;
}

// src/tags.ts
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  realpathSync
} from "node:fs";
import { hostname, homedir, userInfo } from "node:os";
import {
  basename,
  dirname,
  join,
  resolve,
  sep
} from "node:path";
function sha256(input) {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}
function getGitRoot(directory) {
  const isolateWorktrees = process.env.SUPERMEMORY_ISOLATE_WORKTREES === "true";
  try {
    if (isolateWorktrees) {
      return execSync("git rev-parse --show-toplevel", {
        cwd: directory,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"]
      }).trim() || null;
    }
    const gitCommonDir = execSync("git rev-parse --git-common-dir", {
      cwd: directory,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    if (gitCommonDir === ".git") {
      return execSync("git rev-parse --show-toplevel", {
        cwd: directory,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"]
      }).trim() || null;
    }
    const resolvedCommonDir = resolve(directory, gitCommonDir);
    if (basename(resolvedCommonDir) === ".git" && !resolvedCommonDir.includes(`${sep}.git${sep}`)) {
      return dirname(resolvedCommonDir);
    }
    return execSync("git rev-parse --show-toplevel", {
      cwd: directory,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim() || null;
  } catch {
    return null;
  }
}
function getProjectBasePath(directory) {
  return getGitRoot(directory) || resolve(directory);
}
function getGitEmail(directory) {
  try {
    return execSync("git config user.email", {
      cwd: getProjectBasePath(directory),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim() || null;
  } catch {
    return null;
  }
}
function getMachineId() {
  return `${hostname()}_${userInfo().username}`;
}
function normalizeGitRemote(remoteUrl) {
  const raw = remoteUrl.trim();
  if (!raw)
    return null;
  let normalized;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      normalized = parsed.protocol === "file:" ? `file:${decodeURIComponent(parsed.pathname)}` : `${parsed.hostname.toLowerCase()}${parsed.port ? `:${parsed.port}` : ""}/${parsed.pathname.replace(/^\/+/, "")}`;
    } catch {
      normalized = raw;
    }
  } else {
    const scpStyle = raw.match(/^(?:[^@/]+@)?([^:]+):(.+)$/);
    normalized = scpStyle ? `${scpStyle[1].toLowerCase()}/${scpStyle[2]}` : `file:${resolve(raw)}`;
  }
  return normalized.replace(/[?#].*$/, "").replace(/\/+$/, "").replace(/\.git$/i, "").replace(/\/{2,}/g, "/").toLowerCase();
}
var repoInfoCache = new Map;
function getGitRepoInfo(directory) {
  const cached = repoInfoCache.get(directory);
  if (cached)
    return cached;
  try {
    const remoteUrl = execSync("git remote get-url origin", {
      cwd: directory,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    const normalizedRemote = normalizeGitRemote(remoteUrl);
    const displayRemote = remoteUrl.replace(/\/+$/, "").replace(/\.git$/i, "");
    const separator = Math.max(displayRemote.lastIndexOf("/"), displayRemote.lastIndexOf(":"));
    const result = {
      name: displayRemote.slice(separator + 1) || null,
      normalizedRemote
    };
    repoInfoCache.set(directory, result);
    return result;
  } catch {
    const result = { name: null, normalizedRemote: null };
    repoInfoCache.set(directory, result);
    return result;
  }
}
function readJson2(filePath) {
  try {
    if (!existsSync(filePath))
      return null;
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
function stripJsoncComments(content) {
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
      for (let cursor = index - 1;cursor >= 0 && content[cursor] === "\\"; cursor--) {
        backslashes++;
      }
      if (backslashes % 2 === 0)
        inString = !inString;
      result += char;
      index++;
      continue;
    }
    if (inString) {
      result += char;
      index++;
      continue;
    }
    if (!singleLineComment && !multiLineComment && char === "/" && next === "/") {
      singleLineComment = true;
      index += 2;
      continue;
    }
    if (!singleLineComment && !multiLineComment && char === "/" && next === "*") {
      multiLineComment = true;
      index += 2;
      continue;
    }
    if (singleLineComment) {
      if (char === `
`) {
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
      if (char === `
`)
        result += char;
      index++;
      continue;
    }
    result += char;
    index++;
  }
  return result.replace(/,\s*([}\]])/g, "$1");
}
function loadOpenCodeConfig() {
  const configDir = join(homedir(), ".config", "opencode");
  for (const filename of ["supermemory.jsonc", "supermemory.json"]) {
    try {
      const configPath = join(configDir, filename);
      if (!existsSync(configPath))
        continue;
      return JSON.parse(stripJsoncComments(readFileSync(configPath, "utf-8")));
    } catch {
      return null;
    }
  }
  return null;
}
function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function uniqueTags(tags) {
  return [
    ...new Set(tags.filter((tag) => typeof tag === "string" && tag.trim().length > 0))
  ];
}
function sanitizeRepoName(name) {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return sanitized.slice(0, 95).replace(/_+$/g, "") || "unknown";
}
function getProjectIdentity(directory) {
  const basePath = getProjectBasePath(directory);
  const { normalizedRemote } = getGitRepoInfo(basePath);
  const isolateWorktrees = process.env.SUPERMEMORY_ISOLATE_WORKTREES === "true";
  let localIdentity = basePath;
  try {
    localIdentity = realpathSync.native(basePath);
  } catch {}
  return sha256(!isolateWorktrees && normalizedRemote ? normalizedRemote : `path:${localIdentity}`);
}
function getProjectName(directory) {
  const basePath = getProjectBasePath(directory);
  return getGitRepoInfo(basePath).name || basename(basePath) || "unknown";
}
function getGeneratedRepoTag(directory) {
  const name = sanitizeRepoName(getProjectName(directory)).slice(0, 72).replace(/_+$/g, "");
  return `repo_${name || "unknown"}__${getProjectIdentity(directory)}`;
}
function getLegacyRepoTag(directory) {
  return `repo_${sanitizeRepoName(getProjectName(directory))}`;
}
function getLegacyCursorUserTags(directory, config) {
  const identities = uniqueTags([
    config.userContainerTag || process.env.SUPERMEMORY_USER_TAG || process.env.CURSOR_USER_EMAIL || getGitEmail(directory) || getMachineId()
  ]);
  return identities.map((identity) => `cursor_user_${sha256(identity)}`);
}
function getLegacyCursorProjectTags(directory, config) {
  const basePath = getProjectBasePath(directory);
  const identities = uniqueTags([
    config.projectContainerTag || process.env.SUPERMEMORY_PROJECT_TAG || basePath
  ]);
  return identities.map((identity) => `cursor_project_${sha256(identity)}`);
}
function getLegacyClaudeTags(directory) {
  const basePath = getProjectBasePath(directory);
  const projectHash = sha256(basePath);
  const config = readJson2(join(basePath, ".claude", ".supermemory-claude", "config.json"));
  return {
    personal: uniqueTags([
      stringValue(config?.personalContainerTag),
      `user_project_${projectHash}`,
      `claudecode_project_${projectHash}`
    ]),
    project: uniqueTags([
      stringValue(config?.repoContainerTag),
      getLegacyRepoTag(directory)
    ]),
    repoContainerTag: stringValue(config?.repoContainerTag)
  };
}
function getLegacyCodexTags(directory) {
  const config = readJson2(join(homedir(), ".codex", "supermemory.json"));
  const prefix = stringValue(config?.containerTagPrefix) || "codex";
  const userIdentity = getGitEmail(directory) || process.env.USER || process.env.USERNAME || hostname();
  const userHash = sha256(userIdentity);
  const projectHash = sha256(getProjectBasePath(directory));
  return {
    personal: uniqueTags([
      stringValue(config?.userContainerTag),
      `${prefix}_user_${userHash}`,
      `codex_user_${userHash}`
    ]),
    project: uniqueTags([
      stringValue(config?.projectContainerTag),
      `${prefix}_project_${projectHash}`,
      `codex_project_${projectHash}`
    ]),
    projectContainerTag: stringValue(config?.projectContainerTag)
  };
}
function getLegacyOpenCodeTags(directory) {
  const config = loadOpenCodeConfig();
  const prefix = stringValue(config?.containerTagPrefix) || "opencode";
  const userIdentity = getGitEmail(directory) || process.env.USER || process.env.USERNAME || "anonymous";
  const userHash = sha256(userIdentity);
  const projectHashes = [
    ...new Set([directory, resolve(directory), getProjectBasePath(directory)].map((value) => sha256(value)))
  ];
  return {
    personal: uniqueTags([
      stringValue(config?.userContainerTag),
      `${prefix}_user_${userHash}`,
      `opencode_user_${userHash}`
    ]),
    project: uniqueTags([
      stringValue(config?.projectContainerTag),
      ...projectHashes.flatMap((hash) => [
        `${prefix}_project_${hash}`,
        `opencode_project_${hash}`
      ])
    ]),
    projectContainerTag: stringValue(config?.projectContainerTag)
  };
}
function getResolvedTags(directory, config) {
  const generated = getGeneratedRepoTag(directory);
  const cursorPersonal = getLegacyCursorUserTags(directory, config);
  const cursorProjects = getLegacyCursorProjectTags(directory, config);
  const claude = getLegacyClaudeTags(directory);
  const codex = getLegacyCodexTags(directory);
  const opencode = getLegacyOpenCodeTags(directory);
  const canonical = config.repoContainerTag || process.env.SUPERMEMORY_REPO_TAG || claude.repoContainerTag || codex.projectContainerTag || opencode.projectContainerTag || generated;
  const personalReads = uniqueTags([
    canonical,
    generated,
    ...cursorPersonal,
    ...claude.personal,
    ...codex.personal,
    ...opencode.personal
  ]);
  const projectReads = uniqueTags([
    canonical,
    generated,
    ...cursorProjects,
    ...claude.project,
    ...codex.project,
    ...opencode.project
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
    legacyCursorProjects: cursorProjects
  };
}

// src/hook-api.ts
import { createHash as createHash2, createHmac } from "node:crypto";
var DEFAULT_BASE_URL = "https://api.supermemory.ai";
var REQUEST_TIMEOUT_MS = 3000;
var INTEGRITY_VERSION = 1;
var SEED = "7f2a9c4b8e1d6f3a5c0b9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a";
function sha2562(input) {
  return createHash2("sha256").update(input).digest("hex");
}
function headers(apiKey, containerTag) {
  const contentHash = sha2562(containerTag);
  const payload = [sha2562(apiKey), contentHash, INTEGRITY_VERSION].join(":");
  const signature = createHmac("sha256", SEED).update(payload).digest("base64url");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Content-Hash": contentHash,
    "X-Request-Integrity": `v${INTEGRITY_VERSION}.${signature}`,
    "x-sm-source": "cursor"
  };
}
async function post(baseUrl, apiKey, path3, containerTag, body) {
  const response = await fetch(`${(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "")}${path3}`, {
    method: "POST",
    headers: headers(apiKey, containerTag),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Supermemory request failed with HTTP ${response.status}`);
  }
  return response.json();
}
function getProfile(baseUrl, apiKey, containerTag, query, scope) {
  return post(baseUrl, apiKey, "/v4/profile", containerTag, {
    containerTag,
    ...query ? { q: query } : {},
    ...scope ? {
      filters: {
        AND: [{ key: "sm_scope", value: scope, filterType: "metadata" }]
      }
    } : {}
  });
}
async function getProfiles(baseUrl, apiKey, tags, query, canonicalScope) {
  const uniqueTags2 = [...new Set(tags.filter(Boolean))];
  const results = await Promise.allSettled(uniqueTags2.map((tag, index) => getProfile(baseUrl, apiKey, tag, query, index === 0 ? canonicalScope : undefined)));
  const profiles = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (profiles.length === 0) {
    const failure = results.find((result) => result.status === "rejected");
    throw failure?.reason ?? new Error("Supermemory is unreachable");
  }
  return profiles;
}

// src/context.ts
function formatSessionContext(profiles, maxItems, containerTag, projectName) {
  const statics = [
    ...new Set(profiles.flatMap((result) => Array.isArray(result?.profile?.static) ? result.profile.static : []))
  ].slice(0, maxItems);
  const dynamics = [
    ...new Set(profiles.flatMap((result) => Array.isArray(result?.profile?.dynamic) ? result.profile.dynamic : []))
  ].slice(0, maxItems);
  if (statics.length === 0 && dynamics.length === 0)
    return "";
  const sections = [];
  if (statics.length > 0) {
    sections.push(`## User Profile (Persistent)
${statics.map((fact) => `- ◪ ${fact}`).join(`
`)}`);
  }
  if (dynamics.length > 0) {
    sections.push(`## Recent Context
${dynamics.map((fact) => `- ◪ ${fact}`).join(`
`)}`);
  }
  return `<supermemory-context>
Recalled memory for this project (${projectName}). Every line marked ◪ comes from Supermemory. Preserve the mark when citing one, and call the source “Supermemory,” never generic memory.
This project's memory container: ${containerTag}

${sections.join(`

`)}
</supermemory-context>`;
}

// src/runtime.ts
async function readStdinText() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

// src/hooks/session-start.ts
var ok = () => process.stdout.write(JSON.stringify({}));
async function main() {
  const raw = await readStdinText();
  const input = JSON.parse(raw);
  const workspaceRoot = input.workspace_roots?.[0] || process.cwd();
  const config = loadConfig(workspaceRoot);
  const apiKey = getApiKey(config);
  if (!apiKey) {
    const pluginRoot = process.env.CURSOR_PLUGIN_ROOT;
    const loginCmd = pluginRoot ? `node "${pluginRoot}/dist/cli.js" login` : "node dist/cli.js login";
    process.stdout.write(JSON.stringify({
      additional_context: `<supermemory-status>Supermemory is not connected. Ask the user to run \`${loginCmd}\` before relying on persistent memory.</supermemory-status>`
    }));
    return;
  }
  if (input.user_email && !process.env.CURSOR_USER_EMAIL) {
    process.env.CURSOR_USER_EMAIL = input.user_email;
  }
  const tags = getResolvedTags(workspaceRoot, config);
  let profiles = [];
  try {
    profiles = config.injectProfile ? await getProfiles(config.baseUrl, apiKey, tags.allReads, tags.projectName) : [];
  } catch {
    process.stdout.write(JSON.stringify({
      additional_context: "<supermemory-status>Supermemory could not be reached. Continue without memory, and do not assume this project has no saved memories.</supermemory-status>"
    }));
    return;
  }
  const context = formatSessionContext(profiles, config.maxMemories, tags.canonical, tags.projectName);
  process.stdout.write(JSON.stringify(context ? { additional_context: context } : {}));
}
main().catch((err) => {
  console.error("[supermemory] session-start error:", err);
  ok();
});
