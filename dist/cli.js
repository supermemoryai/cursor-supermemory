// src/cli.ts
import { fileURLToPath } from "node:url";

// src/mcp-proxy.ts
import { createInterface } from "node:readline";

// src/config.ts
import path2 from "node:path";
import os2 from "node:os";
import fs2 from "node:fs";

// src/auth.ts
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
var CREDENTIALS_DIR = path.join(os.homedir(), ".supermemory-cursor");
var CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");
var AUTH_PORT = 19878;
var AUTH_URL = process.env.SUPERMEMORY_AUTH_URL || "https://console.supermemory.ai/auth/connect";
var SUCCESS_HTML = `<!DOCTYPE html>
<html><head><style>
  body { background: #111; color: #fff; font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  h1 { font-size: 2rem; }
</style></head><body><h1>Connected to Cursor!</h1></body></html>`;
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
function saveCredentials(apiKey) {
  fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 448 });
  const data = { apiKey, createdAt: new Date().toISOString() };
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2), { mode: 384 });
}
function clearCredentials() {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      fs.unlinkSync(CREDENTIALS_FILE);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
function openBrowser(url) {
  const platform = process.platform;
  const command = platform === "win32" ? "cmd" : platform === "darwin" ? "open" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(command, args, { stdio: "ignore", detached: true }).unref();
}
async function startAuthFlow(timeoutMs = 120000) {
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const finish = (result) => {
      if (settled)
        return;
      settled = true;
      if (timer)
        clearTimeout(timer);
      server.close();
      resolve(result);
    };
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${AUTH_PORT}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const apiKey = url.searchParams.get("apikey") || url.searchParams.get("api_key");
      if (!apiKey?.startsWith("sm_")) {
        res.writeHead(400);
        res.end("Invalid API key");
        return;
      }
      saveCredentials(apiKey);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(SUCCESS_HTML);
      finish({ success: true, apiKey });
    });
    server.on("error", (error) => {
      const detail = error.code === "EADDRINUSE" ? `Port ${AUTH_PORT} is already in use` : error.message;
      finish({ success: false, error: detail });
    });
    server.listen(AUTH_PORT, "127.0.0.1", () => {
      const callbackUrl = `http://localhost:${AUTH_PORT}/callback`;
      const authUrl = `${AUTH_URL}?callback=${encodeURIComponent(callbackUrl)}&client=cursor`;
      process.stderr.write(`
Open this URL to connect Supermemory to Cursor:

  ${authUrl}

Waiting...
`);
      openBrowser(authUrl);
    });
    timer = setTimeout(() => {
      finish({ success: false, error: "Authentication timed out" });
    }, timeoutMs);
  });
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

// src/mcp-proxy.ts
var MCP_URL = process.env.SUPERMEMORY_MCP_URL || "https://mcp.supermemory.ai/mcp";
var REQUEST_TIMEOUT_MS = 30000;
var sessionId = null;
function send(message) {
  process.stdout.write(`${JSON.stringify(message)}
`);
}
function sendError(id, code, message) {
  if (id === undefined || id === null)
    return;
  send({ jsonrpc: "2.0", id, error: { code, message } });
}
function emitSseData(body, write) {
  for (const event of body.split(`

`)) {
    for (const line of event.split(`
`)) {
      if (!line.startsWith("data:"))
        continue;
      const data = line.slice(5).trim();
      if (data)
        write(`${data}
`);
    }
  }
}
async function forward(message, apiKey) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream"
  };
  if (sessionId)
    headers["Mcp-Session-Id"] = sessionId;
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const nextSessionId = response.headers.get("mcp-session-id");
  if (nextSessionId)
    sessionId = nextSessionId;
  if (response.status === 202)
    return;
  if (!response.ok) {
    const body2 = await response.text().catch(() => "");
    sendError(message.id, -32000, `Supermemory MCP ${response.status}: ${body2.slice(0, 200) || "request failed"}`);
    return;
  }
  const body = await response.text();
  if (!body.trim())
    return;
  if ((response.headers.get("content-type") || "").includes("text/event-stream")) {
    emitSseData(body, (line) => process.stdout.write(line));
  } else {
    process.stdout.write(`${body.trim()}
`);
  }
}
function startMcpProxy() {
  const apiKey = getApiKey(loadConfig());
  let queue = Promise.resolve();
  const lines = createInterface({ input: process.stdin });
  lines.on("line", (line) => {
    if (!line.trim())
      return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    queue = queue.then(async () => {
      if (!apiKey) {
        sendError(message.id, -32001, "Supermemory is not authenticated. Run `cursor-supermemory login`, or set SUPERMEMORY_API_KEY.");
        return;
      }
      try {
        await forward(message, apiKey);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        sendError(message.id, -32000, `Supermemory MCP proxy error: ${detail}`);
      }
    });
  });
  lines.on("close", () => {
    queue.finally(() => process.exit(0));
  });
}

// src/hook-api.ts
import { createHash, createHmac } from "node:crypto";
var DEFAULT_BASE_URL = "https://api.supermemory.ai";
var REQUEST_TIMEOUT_MS2 = 3000;
var INTEGRITY_VERSION = 1;
var SEED = "7f2a9c4b8e1d6f3a5c0b9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a";
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
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS2)
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

// src/tags.ts
import { execSync } from "node:child_process";
import { createHash as createHash2 } from "node:crypto";
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
function sha2562(input) {
  return createHash2("sha256").update(input).digest("hex").slice(0, 16);
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

// src/mcp-install.ts
import fs3 from "node:fs";
import os3 from "node:os";
import path3 from "node:path";
var GLOBAL_MCP_PATH = path3.join(os3.homedir(), ".cursor", "mcp.json");
function writeGlobalMcpEntry(cliPath, configPath = GLOBAL_MCP_PATH) {
  let config = {};
  try {
    config = JSON.parse(fs3.readFileSync(configPath, "utf-8"));
  } catch {
    config = {};
  }
  const servers = config.mcpServers && typeof config.mcpServers === "object" ? config.mcpServers : {};
  const existing = servers.supermemory && typeof servers.supermemory === "object" ? servers.supermemory : {};
  servers.supermemory = {
    ...existing,
    command: process.execPath,
    args: [cliPath, "mcp"]
  };
  config.mcpServers = servers;
  fs3.mkdirSync(path3.dirname(configPath), { recursive: true });
  fs3.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}
`);
  return configPath;
}

// src/cli.ts
var command = process.argv[2];
switch (command) {
  case "mcp":
    startMcpProxy();
    break;
  case "mcp-install": {
    const configPath = writeGlobalMcpEntry(fileURLToPath(import.meta.url));
    console.log(`Registered the supermemory MCP server in ${configPath}.`);
    console.log("Restart Cursor (or the cloud agent) to pick it up.");
    break;
  }
  case "login": {
    const existing = loadCredentials();
    if (existing) {
      console.log("Already authenticated. Use `logout` first to re-authenticate.");
      process.exit(0);
    }
    console.log("Opening browser to authenticate...");
    const result = await startAuthFlow();
    if (result.success) {
      console.log("Authenticated successfully.");
    } else {
      console.error(`Authentication failed: ${result.error}`);
      process.exit(1);
    }
    break;
  }
  case "logout": {
    const removed = clearCredentials();
    console.log(removed ? "Logged out." : "No credentials found.");
    break;
  }
  case "status": {
    const config = loadConfig();
    const apiKey = getApiKey(config);
    if (!apiKey) {
      console.log("Not authenticated. Run `cursor-supermemory login` to connect.");
      break;
    }
    const credentials = loadCredentials();
    if (credentials?.createdAt) {
      console.log(`Authenticated since ${credentials.createdAt}`);
    }
    console.log(`API key: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`);
    try {
      const tags = getResolvedTags(process.cwd(), config);
      await getProfile(config.baseUrl, apiKey, tags.canonical, "connectivity probe");
      console.log(`Connected to Supermemory (${tags.canonical}).`);
    } catch (error) {
      console.error(`Supermemory is unreachable: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
    break;
  }
  default:
    console.log(`cursor-supermemory — Persistent AI memory for Cursor

Commands:
  mcp          Proxy the hosted Supermemory MCP server over stdio
  mcp-install  Register the MCP server in ~/.cursor/mcp.json with an absolute path
  login        Authenticate with Supermemory
  logout       Remove stored credentials
  status       Show authentication status`);
    if (command)
      process.exit(1);
}
