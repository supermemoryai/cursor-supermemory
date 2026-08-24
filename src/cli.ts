import { startMcpServer } from "./mcp-server.ts";
import {
  loadCredentials,
  startAuthFlow,
  clearCredentials,
  DEFAULT_API_URL,
  verifyApiKey,
} from "./auth.ts";
import { getApiKey, getApiKeySource, loadConfig } from "./config.ts";

const command = process.argv[2];

function warnAboutCredentialOverride(organization: string): void {
  const source = getApiKeySource();
  if (source === "browser credentials") return;
  console.warn(
    `Warning: ${source} overrides the saved browser credential. Remove that API key override to use ${organization}.`,
  );
}

switch (command) {
  case "mcp":
    await startMcpServer();
    break;

  case "login": {
    const existing = loadCredentials();
    if (existing) {
      console.log(
        "Already authenticated. Use `cursor-supermemory switch-org` to choose another organization.",
      );
      process.exit(0);
    }
    console.log("Opening browser to authenticate...");
    const config = loadConfig();
    const result = await startAuthFlow(
      120_000,
      config.baseUrl ?? DEFAULT_API_URL,
    );
    if (result.success) {
      const organization =
        result.identity?.organizationName ??
        result.identity?.organizationId ??
        "the selected organization";
      console.log(
        `Authenticated successfully for ${organization}.`,
      );
      warnAboutCredentialOverride(organization);
    } else {
      console.error(`Authentication failed: ${result.error}`);
      process.exit(1);
    }
    break;
  }

  case "switch-org":
  case "switch-organization": {
    const previousCredentials = loadCredentials();
    console.log("Opening Supermemory to choose an organization...");
    const config = loadConfig();
    const result = await startAuthFlow(
      120_000,
      config.baseUrl ?? DEFAULT_API_URL,
    );
    if (!result.success) {
      console.error(`Organization switch failed: ${result.error}`);
      console.error(
        previousCredentials
          ? "Your previous browser credential is still saved."
          : "No credential was saved.",
      );
      process.exit(1);
    }

    const organization =
      result.identity?.organizationName ??
      result.identity?.organizationId ??
      "the selected organization";
    console.log(`Saved a verified credential for ${organization}.`);
    warnAboutCredentialOverride(organization);
    console.log(
      "Restart Cursor or run Developer: Reload Window before continuing so the MCP server uses the new credential.",
    );
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
    if (apiKey) {
      const creds = loadCredentials();
      if (creds?.apiKey === apiKey) {
        console.log(`Authenticated since ${creds.createdAt}`);
      }
      console.log(
        `API key: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)} (${getApiKeySource()})`,
      );
      try {
        const identity = await verifyApiKey(
          apiKey,
          config.baseUrl ?? DEFAULT_API_URL,
        );
        if (identity.organizationName || identity.organizationId) {
          console.log(
            `Organization: ${identity.organizationName ?? identity.organizationId}`,
          );
        }
        if (identity.userEmail) console.log(`Account: ${identity.userEmail}`);
      } catch (error) {
        console.log(
          `Connection: unavailable (${error instanceof Error ? error.message : "verification failed"})`,
        );
      }
    } else {
      console.log("Not authenticated. Run `cursor-supermemory login` to connect.");
    }
    break;
  }

  default:
    console.log(`cursor-supermemory — Persistent AI memory for Cursor

Commands:
  mcp      Start the MCP server (stdio)
  login    Authenticate with Supermemory
  switch-org  Choose and connect a different organization
  logout   Remove stored credentials
  status   Show authentication status`);
    if (command) process.exit(1);
}
