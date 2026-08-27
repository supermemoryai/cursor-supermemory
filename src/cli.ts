import { startMcpServer } from "./mcp-server.ts";
import {
  loadCredentials,
  startAuthFlow,
  clearCredentials,
} from "./auth.ts";
import { loadConfig, getApiKey } from "./config.ts";
import { getProfile } from "./hook-api.ts";
import { getResolvedTags } from "./tags.ts";

const command = process.argv[2];

switch (command) {
  case "mcp":
    await startMcpServer();
    break;

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
  mcp      Start the MCP server (stdio)
  login    Authenticate with Supermemory
  logout   Remove stored credentials
  status   Show authentication status`);
    if (command) process.exit(1);
}
