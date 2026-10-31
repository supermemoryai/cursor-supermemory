import { fileURLToPath } from "node:url";
import { startMcpProxy } from "./mcp-proxy.ts";
import {
  clearCredentials,
  detectClient,
  getOAuthConfig,
  loadCredentialData,
  settleAuth,
  startAuthFlow,
} from "./auth.ts";
import {
  getApiBaseUrl,
  getApiKey,
  getAuthToken,
  getAuthType,
  getMcpUrl,
  isConfigured,
  loadConfig,
} from "./config.ts";
import { getAccount, getProfile, resolveApiVersion } from "./hook-api.ts";
import { getResolvedTags } from "./tags.ts";
import { writeGlobalMcpEntry } from "./mcp-install.ts";

const command = process.argv[2];

async function main(): Promise<void> {
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
      const config = loadConfig();
      const printUrl = process.argv.includes("--print-url");
      if (!printUrl) console.log("Opening browser to authenticate...");
      const flag = process.argv.indexOf("--client");
      await startAuthFlow(getOAuthConfig(getApiBaseUrl(config), getMcpUrl(config)), undefined, {
        printUrl,
        authClient: detectClient(flag >= 0 ? process.argv[flag + 1] : undefined),
      });
      console.log("Authenticated successfully.");
      if (getApiKey(config)) {
        console.log(
          "An environment/config API key still takes precedence. Remove it to use OAuth.",
        );
      }
      break;
    }

    case "logout": {
      const removed = await clearCredentials();
      console.log(removed ? "Logged out." : "No credentials found.");
      if (getApiKey(loadConfig())) {
        console.log("An environment/config API key is still configured and has not been removed.");
      }
      break;
    }

    case "status": {
      const config = loadConfig();
      const authType = getAuthType(config);
      console.log(`Authentication: ${authType}`);
      const credentials = loadCredentialData();
      if (authType === "oauth" && credentials?.type === "oauth") {
        console.log(`OAuth client: ${credentials.clientId}`);
      }
      if (!isConfigured(config)) {
        console.log(
          "Not authenticated. Run `cursor-supermemory login` to connect.",
        );
        break;
      }
      try {
        const tags = getResolvedTags(process.cwd(), config);
        await getProfile(
          config.baseUrl,
          () => getAuthToken(config),
          tags.canonical,
          resolveApiVersion(config.baseUrl, config.apiVersion) === "legacy"
            ? "connectivity probe"
            : undefined,
          undefined,
          config.apiVersion,
        );
        console.log(`Connected to Supermemory (${tags.canonical}).`);
        const account = await getAccount(config.baseUrl, () => getAuthToken(config));
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
  login        Authenticate with Supermemory (--client grok_bot names Grok Bot on the consent page)
  logout       Revoke and remove stored credentials
  status       Show authentication status`);
      if (command) process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  // Let a refresh that is still rotating tokens save them before exiting.
  await settleAuth();
  process.exit(1);
});
