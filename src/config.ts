import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { loadCredentials } from "./auth.ts";

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
  similarityThreshold: number;
  maxMemories: number;
  maxProjectMemories: number;
  injectProfile: boolean;
  repoContainerTag: string | null;
  userContainerTag: string | null;
  projectContainerTag: string | null;
}

const DEFAULTS: Omit<Config, "apiKey"> = {
  baseUrl: null,
  similarityThreshold: 0.3,
  maxMemories: 10,
  maxProjectMemories: 5,
  injectProfile: true,
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
    similarityThreshold: merged.similarityThreshold,
    maxMemories: merged.maxMemories,
    maxProjectMemories: merged.maxProjectMemories,
    injectProfile: merged.injectProfile,
    repoContainerTag: merged.repoContainerTag,
    userContainerTag: merged.userContainerTag,
    projectContainerTag: merged.projectContainerTag,
  };
}

export function getApiKey(config: Config): string | null {
  if (config.apiKey) return config.apiKey;

  const creds = loadCredentials();
  return creds?.apiKey ?? null;
}

export type ApiKeySource =
  | "SUPERMEMORY_API_KEY"
  | "project config"
  | "global config"
  | "browser credentials"
  | "not configured";

export function getApiKeySource(cwd = process.cwd()): ApiKeySource {
  const config = loadConfig(cwd);
  const effectiveKey = getApiKey(config);
  if (!effectiveKey) return "not configured";
  if (process.env.SUPERMEMORY_API_KEY === effectiveKey) {
    return "SUPERMEMORY_API_KEY";
  }

  const projectConfig = findProjectConfig(cwd);
  if (projectConfig?.apiKey === effectiveKey) return "project config";
  const globalConfig = readJson(GLOBAL_CONFIG_PATH);
  if (globalConfig?.apiKey === effectiveKey) return "global config";
  return "browser credentials";
}
