#!/usr/bin/env node
import { startMcpServer } from "./mcp-server.ts";
import {
  loadCredentials,
  startAuthFlow,
  clearCredentials,
} from "./auth.ts";

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
    const creds = loadCredentials();
    if (creds) {
      console.log(`Authenticated since ${creds.createdAt}`);
      console.log(`API key: ${creds.apiKey.slice(0, 6)}...${creds.apiKey.slice(-4)}`);
    } else {
      console.log("Not authenticated. Run /supermemory-setup or set SUPERMEMORY_API_KEY.");
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
