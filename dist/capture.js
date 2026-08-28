// src/hooks/capture.ts
import { createHash as createHash4 } from "node:crypto";

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

// src/hook-api.ts
import { createHash, createHmac } from "node:crypto";
var DEFAULT_BASE_URL = "https://api.supermemory.ai";
var REQUEST_TIMEOUT_MS = 3000;
var INTEGRITY_VERSION = 1;
var SEED = "7f2a9c4b8e1d6f3a5c0b9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a";
var AGENT_ENTITY_CONTEXT = `Shared coding-agent memory for one software repository.

RULES:
- Preserve durable context that helps Claude Code, Codex, OpenCode, or Cursor continue the work
- Condense assistant responses into decisions, outcomes, and reusable knowledge
- Keep user preferences and project facts concise and independently understandable

EXTRACT:
- User preferences, accepted decisions, durable workflows, actions, and learnings
- Architecture, conventions, implementation patterns, setup requirements, and decisions

SKIP:
- Generic assistant suggestions the user did not accept
- Transient command output and low-value implementation chatter
- Granular details that do not help future work`;
function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}
function headers(apiKey, containerTag) {
  const contentHash = sha256(containerTag);
  const payload = [sha256(apiKey), contentHash, INTEGRITY_VERSION].join(":");
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
function addMemory(baseUrl, apiKey, content, containerTag, metadata, options = {}) {
  return post(baseUrl, apiKey, "/v3/documents", containerTag, {
    content,
    containerTag,
    metadata: { sm_source: "cursor", ...metadata },
    customId: options.customId,
    entityContext: options.entityContext
  });
}

// src/hook-state.ts
import { createHash as createHash2 } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
function statePath(conversationId) {
  const id = createHash2("sha256").update(conversationId || "unknown").digest("hex").slice(0, 32);
  return join(homedir(), ".supermemory-cursor", "hook-state", `${id}.json`);
}
function readHookState(conversationId) {
  try {
    return JSON.parse(readFileSync(statePath(conversationId), "utf8"));
  } catch {
    return {};
  }
}
function writeHookState(conversationId, updates) {
  const filePath = statePath(conversationId);
  mkdirSync(join(homedir(), ".supermemory-cursor", "hook-state"), {
    recursive: true,
    mode: 448
  });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify({ ...readHookState(conversationId), ...updates })}
`, { mode: 384 });
  renameSync(tempPath, filePath);
}
function deleteHookState(conversationId) {
  rmSync(statePath(conversationId), { force: true });
}

// src/tags.ts
import { execSync } from "node:child_process";
import { createHash as createHash3 } from "node:crypto";
import {
  existsSync,
  readFileSync as readFileSync2,
  realpathSync
} from "node:fs";
import { hostname, homedir as homedir2, userInfo } from "node:os";
import {
  basename,
  dirname,
  join as join2,
  resolve,
  sep
} from "node:path";
function sha2562(input) {
  return createHash3("sha256").update(input).digest("hex").slice(0, 16);
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
    return JSON.parse(readFileSync2(filePath, "utf-8"));
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
  const configDir = join2(homedir2(), ".config", "opencode");
  for (const filename of ["supermemory.jsonc", "supermemory.json"]) {
    try {
      const configPath = join2(configDir, filename);
      if (!existsSync(configPath))
        continue;
      return JSON.parse(stripJsoncComments(readFileSync2(configPath, "utf-8")));
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
  return sha2562(!isolateWorktrees && normalizedRemote ? normalizedRemote : `path:${localIdentity}`);
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
  return identities.map((identity) => `cursor_user_${sha2562(identity)}`);
}
function getLegacyCursorProjectTags(directory, config) {
  const basePath = getProjectBasePath(directory);
  const identities = uniqueTags([
    config.projectContainerTag || process.env.SUPERMEMORY_PROJECT_TAG || basePath
  ]);
  return identities.map((identity) => `cursor_project_${sha2562(identity)}`);
}
function getLegacyClaudeTags(directory) {
  const basePath = getProjectBasePath(directory);
  const projectHash = sha2562(basePath);
  const config = readJson2(join2(basePath, ".claude", ".supermemory-claude", "config.json"));
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
  const config = readJson2(join2(homedir2(), ".codex", "supermemory.json"));
  const prefix = stringValue(config?.containerTagPrefix) || "codex";
  const userIdentity = getGitEmail(directory) || process.env.USER || process.env.USERNAME || hostname();
  const userHash = sha2562(userIdentity);
  const projectHash = sha2562(getProjectBasePath(directory));
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
  const userHash = sha2562(userIdentity);
  const projectHashes = [
    ...new Set([directory, resolve(directory), getProjectBasePath(directory)].map((value) => sha2562(value)))
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

// src/hooks/types.ts
function workspaceRoot(input) {
  return input.workspace_roots?.[0] || process.env.CURSOR_PROJECT_DIR || process.cwd();
}
function conversationId(input) {
  return input.conversation_id || input.session_id || "unknown";
}

// src/runtime.ts
import { readFile } from "node:fs/promises";
import { realpathSync as realpathSync2 } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
async function readStdinText() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function readStdinJson() {
  return JSON.parse(await readStdinText());
}
function readTextFile(filePath) {
  return readFile(filePath, "utf8");
}
function isMainModule(metaUrl) {
  const entry = process.argv[1];
  if (!entry)
    return false;
  try {
    return realpathSync2(entry) === realpathSync2(fileURLToPath(metaUrl));
  } catch {
    return pathToFileURL(entry).href === metaUrl;
  }
}
async function runHook(handler, fallback = { continue: true }) {
  const write = process.stdout.write.bind(process.stdout);
  let answered = false;
  process.stdout.write = (...args) => {
    answered = true;
    return write(...args);
  };
  try {
    await handler(await readStdinJson());
  } catch (error) {
    if (process.env.SUPERMEMORY_DEBUG === "true") {
      console.error("[supermemory] hook failed:", error);
    }
    if (!answered)
      write(JSON.stringify(fallback));
  } finally {
    process.stdout.write = write;
  }
}

// src/hooks/capture.ts
function cleanContent(text) {
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").replace(/<supermemory-(?:context|recall)>[\s\S]*?<\/supermemory-(?:context|recall)>/g, "").trim();
}
function textFromContent(content) {
  if (typeof content === "string")
    return cleanContent(content);
  if (!Array.isArray(content))
    return "";
  return content.flatMap((block) => {
    if (!block || typeof block !== "object")
      return [];
    const value = block;
    return value.type === "text" && typeof value.text === "string" ? [cleanContent(value.text)] : [];
  }).filter(Boolean).join(`
`);
}
function extractEntry(entry) {
  const role = entry.role ?? entry.type;
  if (role !== "user" && role !== "assistant")
    return null;
  const message = entry.message;
  const text = textFromContent(entry.content ?? message?.content);
  return text ? { role, text } : null;
}
function parseTranscript(text) {
  let entries = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed))
      entries = parsed;
  } catch {
    entries = text.split(`
`).filter(Boolean).flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  }
  return entries.flatMap((entry) => {
    const captured = extractEntry(entry);
    return captured ? [captured] : [];
  });
}
function selectCaptureEntries(entries, start, signalExtraction, signalKeywords, signalTurnsBefore) {
  const pending = entries.slice(start);
  if (!signalExtraction)
    return pending;
  const keywords = signalKeywords.map((keyword) => keyword.toLowerCase());
  const signalIndex = pending.findLastIndex((entry) => entry.role === "user" && keywords.some((keyword) => entry.text.toLowerCase().includes(keyword)));
  if (signalIndex < 0)
    return [];
  let first = signalIndex;
  let userTurns = Math.max(1, signalTurnsBefore);
  while (first > 0 && userTurns > 1) {
    first--;
    if (pending[first]?.role === "user")
      userTurns--;
  }
  return pending.slice(first);
}
function formatCapture(entries) {
  if (entries.length === 0)
    return "";
  const parts = [`<|turn_start|>${new Date().toISOString()}`];
  for (const entry of entries) {
    parts.push(`<|start|>${entry.role}<|message|>${entry.text}<|end|>`);
  }
  parts.push("<|turn_end|>");
  return parts.join(`

`);
}
async function capture(input) {
  if ([input.status, input.reason].some((value) => ["aborted", "error"].includes(value ?? ""))) {
    return;
  }
  const transcriptPath = input.transcript_path || process.env.CURSOR_TRANSCRIPT_PATH;
  if (!transcriptPath)
    return;
  try {
    const root = workspaceRoot(input);
    const config = loadConfig(root);
    const apiKey = getApiKey(config);
    if (!apiKey)
      return;
    const id = conversationId(input);
    const state = readHookState(id);
    const entries = parseTranscript(await readTextFile(transcriptPath));
    const capturedEntries = state.transcriptPath === transcriptPath ? state.capturedEntries ?? 0 : 0;
    const start = capturedEntries <= entries.length ? capturedEntries : 0;
    const selected = selectCaptureEntries(entries, start, config.signalExtraction, config.signalKeywords, config.signalTurnsBefore);
    const content = formatCapture(selected);
    if (content.length < 100)
      return;
    const tags = getResolvedTags(root, config);
    const generation = input.generation_id || createHash4("sha256").update(content).digest("hex").slice(0, 32);
    await addMemory(config.baseUrl, apiKey, content, tags.canonical, {
      type: "conversation",
      project: tags.projectName,
      sm_project_id: tags.projectId,
      sm_scope: "personal",
      sm_capture_mode: "stop",
      sessionId: id,
      timestamp: new Date().toISOString()
    }, {
      customId: `cursor:capture:${createHash4("sha256").update(`${id}:${generation}`).digest("hex")}`,
      entityContext: AGENT_ENTITY_CONTEXT
    });
    writeHookState(id, {
      capturedEntries: entries.length,
      transcriptPath
    });
  } catch (error) {
    if (process.env.SUPERMEMORY_DEBUG === "true") {
      console.error("[supermemory] capture failed:", error);
    }
  }
}
async function runCapture(input) {
  try {
    await capture(input);
  } finally {
    if (input.hook_event_name === "sessionEnd") {
      deleteHookState(conversationId(input));
    }
  }
}
if (isMainModule(import.meta.url)) {
  await runHook(runCapture, {});
}
export {
  selectCaptureEntries,
  runCapture,
  parseTranscript,
  formatCapture
};
