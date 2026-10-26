import { fileURLToPath } from "node:url";
import { startMcpProxy } from "./mcp-proxy.ts";
import {
  apiKeyFromCallbackUrl,
  beginLogin,
  clearCredentials,
  detectClient,
  listenForCallback,
  LISTEN_TIMEOUT_MS,
  loadCredentials,
  saveCredentials,
  waitForCredentials,
} from "./auth.ts";
import { loadConfig, getApiKey } from "./config.ts";
import { getAccount, getProfile, resolveApiVersion } from "./hook-api.ts";
import { getResolvedTags } from "./tags.ts";
import { writeGlobalMcpEntry } from "./mcp-install.ts";

const command = process.argv[2];
const args = process.argv.slice(3);

function flag(name: string): boolean {
  return args.includes(name);
}

function option(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

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
    const callbackUrl = option("--callback-url");
    if (callbackUrl) {
      const apiKey = apiKeyFromCallbackUrl(callbackUrl);
      if (!apiKey) {
        console.error("That address has no Supermemory key in it.");
        process.exit(1);
      }
      saveCredentials(apiKey);
      console.log("Authenticated successfully.");
      break;
    }
    if (loadCredentials()) {
      console.log(
        "Already authenticated. Use `logout` first to re-authenticate.",
      );
      process.exit(0);
    }
    const client = detectClient(option("--client"));
    const { url, error } = await beginLogin(client, fileURLToPath(import.meta.url));
    if (error) {
      console.error(`Authentication failed: ${error}`);
      process.exit(1);
    }
    const minutes = Math.round(LISTEN_TIMEOUT_MS / 60_000);
    console.log(`Open this URL to connect Supermemory to ${client.name}:\n\n  ${url}\n`);
    const wait = flag("--wait") || (!flag("--no-wait") && !!process.stdout.isTTY);
    if (!wait) {
      console.log(
        `The sign-in stays open for ${minutes} minutes. After approving, run \`status\` to confirm.`,
      );
      break;
    }
    console.log("Waiting...");
    if (await waitForCredentials()) {
      console.log("Authenticated successfully.");
    } else {
      console.error("Authentication failed: the sign-in closed before it was approved.");
      process.exit(1);
    }
    break;
  }

  case "login-listen": {
    const result = await listenForCallback(detectClient(option("--client")));
    process.exit(result.success ? 0 : 1);
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
      console.log("Not authenticated. Run `login` to connect.");
      break;
    }
    const credentials = loadCredentials();
    if (credentials?.createdAt) {
      console.log(`Authenticated since ${credentials.createdAt}`);
    }
    console.log("API key is configured.");
    try {
      const tags = getResolvedTags(process.cwd(), config);
      await getProfile(
        config.baseUrl,
        apiKey,
        tags.canonical,
        resolveApiVersion(config.baseUrl, config.apiVersion) === "legacy"
          ? "connectivity probe"
          : undefined,
        undefined,
        config.apiVersion,
      );
      console.log(`Connected to Supermemory (${tags.canonical}).`);
      const account = await getAccount(config.baseUrl, apiKey);
      const who = account.email ?? account.name;
      if (who) {
        console.log(`Account: ${who}${account.orgName ? ` (${account.orgName})` : ""}`);
      }
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
  login        Authenticate with Supermemory in the browser
                 --client cursor|grok_bot   Name the agent on the approval page
                 --no-wait / --wait         Return at once, or block until approved
                 --callback-url <url>       Finish from a callback the browser could not deliver
  logout       Remove stored credentials
  status       Show authentication status`);
    if (command) process.exit(1);
}
