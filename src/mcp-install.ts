import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const GLOBAL_MCP_PATH = path.join(os.homedir(), ".cursor", "mcp.json");

// For environments that resolve neither CURSOR_PLUGIN_ROOT nor a ~/.cursor/plugins copy.
export function writeGlobalMcpEntry(
  cliPath: string,
  configPath = GLOBAL_MCP_PATH,
): string {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    config = {};
  }

  const servers =
    config.mcpServers && typeof config.mcpServers === "object"
      ? (config.mcpServers as Record<string, unknown>)
      : {};
  const existing =
    servers.supermemory && typeof servers.supermemory === "object"
      ? (servers.supermemory as Record<string, unknown>)
      : {};

  servers.supermemory = {
    ...existing,
    command: process.execPath,
    args: [cliPath, "mcp"],
  };
  config.mcpServers = servers;

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return configPath;
}
