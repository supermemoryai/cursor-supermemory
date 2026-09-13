import { fileURLToPath } from "node:url";
import { startMcpProxy } from "./mcp-proxy.ts";
import {
  loadCredentials,
  startAuthFlow,
  clearCredentials,
} from "./auth.ts";
import { loadConfig, getApiKey } from "./config.ts";
import { getProfile } from "./hook-api.ts";
import { getResolvedTags } from "./tags.ts";
import { writeGlobalMcpEntry } from "./mcp-install.ts";

const command = process.argv[2];

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
      await getProfile(
        config.baseUrl,
        apiKey,
        tags.canonical,
        "connectivity probe",
      );
      console.log(`Connected to Supermemory (${tags.canonical}).`);
    } catch (error) {
      console.error(
        `Supermemory is unreachable: ${error instanceof Error ? error.message : String(error)}`,
      );
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
    if (command) process.exit(1);
}
