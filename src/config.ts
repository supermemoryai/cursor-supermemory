import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import {
  authRequired,
  getAccessToken,
  getOAuthConfig,
  hasOAuthCredentials,
  loadCredentialData,
  loadCredentials,
} from "./auth.ts";

export const DEFAULT_API_URL = "https://api.supermemory.ai";
export const DEFAULT_MCP_URL = "https://mcp.supermemory.ai/mcp";

export const GLOBAL_CONFIG_PATH = path.join(os.homedir(), ".config", "cursor", "supermemory.json");

export function getProjectConfigPath(cwd: string): string {
  return path.join(cwd, ".cursor", ".supermemory", "config.json");
}

export function writeConfig(updates: Partial<Omit<Config, "apiKey">>, scope: "project" | "global", cwd = process.cwd()): void {
  const filePath = scope === "project" ? getProjectConfigPath(cwd) : GLOBAL_CONFIG_PATH;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const existing = readJson(filePath) ?? {};
  fs.writeFileSync(filePath, JSON.stringify({ ...existing, ...updates }, null, 2));
}

export interface Config {
  apiKey: string | null;
  baseUrl: string | null;
  apiVersion?: "v5" | "legacy";
  similarityThreshold: number;
  maxMemories: number;
  maxProjectMemories: number;
  injectProfile: boolean;
  signalExtraction: boolean;
  signalKeywords: string[];
  signalTurnsBefore: number;
  repoContainerTag: string | null;
  userContainerTag: string | null;
  projectContainerTag: string | null;
}

const DEFAULTS: Omit<Config, "apiKey"> = {
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
  projectContainerTag: null,
};

function readJson(filePath: string): Record<string, any> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function findProjectConfig(cwd: string): Record<string, any> | null {
  let dir = cwd;
  while (true) {
    const configPath = path.join(dir, ".cursor", ".supermemory", "config.json");
    const data = readJson(configPath);
    if (data) return data;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function loadConfig(cwd?: string): Config {
  const projectConfig = findProjectConfig(cwd || process.cwd());
  const globalConfig = readJson(GLOBAL_CONFIG_PATH);

  const merged: Record<string, any> = { ...DEFAULTS, ...globalConfig, ...projectConfig };

  return {
    apiKey: process.env.SUPERMEMORY_API_KEY ?? merged.apiKey ?? null,
    baseUrl:
      process.env.SUPERMEMORY_API_URL ??
      process.env.SUPERMEMORY_BASE_URL ??
      merged.baseUrl ??
      null,
    apiVersion: process.env.SUPERMEMORY_API_VERSION ?? merged.apiVersion,
    similarityThreshold: merged.similarityThreshold,
    maxMemories: merged.maxMemories,
    maxProjectMemories: merged.maxProjectMemories,
    injectProfile: merged.injectProfile,
    signalExtraction: merged.signalExtraction,
    signalKeywords: Array.isArray(merged.signalKeywords)
      ? merged.signalKeywords.filter(
          (keyword: unknown): keyword is string => typeof keyword === "string",
        )
      : DEFAULTS.signalKeywords,
    signalTurnsBefore: merged.signalTurnsBefore,
    repoContainerTag: merged.repoContainerTag,
    userContainerTag: merged.userContainerTag,
    projectContainerTag: merged.projectContainerTag,
  };
}

// API keys (env, config, or a saved `{apiKey}` file) take precedence over OAuth.
export function getApiKey(config: Config): string | null {
  if (config.apiKey) return config.apiKey;
  return loadCredentials() ?? null;
}

export function getApiBaseUrl(config: Config): string {
  return config.baseUrl || DEFAULT_API_URL;
}

function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

// The OAuth resource (the MCP server URL tokens are issued for).
export function getMcpUrl(config: Config): string {
  if (process.env.SUPERMEMORY_MCP_URL) {
    const configured = normalizeUrl(process.env.SUPERMEMORY_MCP_URL);
    if (!configured) throw new Error("Invalid SUPERMEMORY_MCP_URL");
    return configured;
  }
  if (!config.baseUrl) return DEFAULT_MCP_URL;
  const api = new URL(config.baseUrl);
  if (api.hostname.startsWith("api.")) {
    api.hostname = api.hostname.replace(/^api\./, "mcp.");
    api.pathname = "/mcp";
    api.search = "";
    api.hash = "";
    return api.toString();
  }
  throw new Error("Set SUPERMEMORY_MCP_URL for OAuth or MCP on a custom Supermemory backend.");
}

export function getAuthType(config: Config): "api_key" | "oauth" | "none" {
  if (getApiKey(config)) return "api_key";
  return loadCredentialData()?.type === "oauth" ? "oauth" : "none";
}

export function isConfigured(config: Config): boolean {
  if (getApiKey(config)) return true;
  try {
    return hasOAuthCredentials(getOAuthConfig(getApiBaseUrl(config), getMcpUrl(config)));
  } catch {
    return false;
  }
}

// Resolve the bearer for each request so refreshes and logins in other processes are seen.
export async function getAuthToken(config: Config, timeoutMs?: number): Promise<string> {
  const apiKey = getApiKey(config);
  if (apiKey) return apiKey;
  if (loadCredentialData()?.type !== "oauth") throw authRequired();
  return getAccessToken(getOAuthConfig(getApiBaseUrl(config), getMcpUrl(config)), timeoutMs);
}
