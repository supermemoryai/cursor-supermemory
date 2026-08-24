import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { randomBytes } from "node:crypto";

const CREDENTIALS_DIR = path.join(os.homedir(), ".supermemory-cursor");
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");
const AUTH_URL = "https://app.supermemory.ai/auth/connect";
export const DEFAULT_API_URL = "https://api.supermemory.ai";
const SESSION_TIMEOUT_MS = 10_000;

const SUCCESS_HTML = `<!DOCTYPE html>
<html><head><style>
  body { background: #111; color: #fff; font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  h1 { font-size: 2rem; }
</style></head><body><h1>Connected to Cursor!</h1></body></html>`;

export function loadCredentials(): { apiKey: string; createdAt: string } | null {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
    if (data.apiKey) return data;
    return null;
  } catch {
    return null;
  }
}

export function saveCredentials(apiKey: string): void {
  fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  const data = { apiKey, createdAt: new Date().toISOString() };
  const temporaryFile = `${CREDENTIALS_FILE}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2), {
      mode: 0o600,
    });
    fs.renameSync(temporaryFile, CREDENTIALS_FILE);
  } finally {
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
  }
}

export function clearCredentials(): boolean {
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

export interface SessionIdentity {
  organizationId?: string;
  organizationName?: string;
  userEmail?: string;
}

export type BrowserAuthMode = "switch_organization";

export function createBrowserAuthUrl(
  callbackUrl: string,
  mode?: BrowserAuthMode,
): string {
  const switchMode = mode ? `&mode=${encodeURIComponent(mode)}` : "";
  return `${AUTH_URL}?callback=${encodeURIComponent(callbackUrl)}&client=cursor${switchMode}`;
}

export function parseAuthCallback(url: URL, expectedState: string): string {
  if (url.searchParams.get("state") !== expectedState) {
    throw new Error("Invalid callback state");
  }

  const apiKey =
    url.searchParams.get("apikey") || url.searchParams.get("api_key");
  if (!apiKey?.startsWith("sm_")) throw new Error("Invalid API key");
  return apiKey;
}

export async function verifyApiKey(
  apiKey: string,
  apiUrl = DEFAULT_API_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<SessionIdentity> {
  const response = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/v3/session`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "x-sm-source": "cursor",
    },
    signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Supermemory rejected the new credential (${response.status})`);
  }

  const data = (await response.json()) as {
    org?: { id?: unknown; name?: unknown };
    user?: { email?: unknown };
  };
  const identity: SessionIdentity = {
    organizationId:
      typeof data.org?.id === "string" ? data.org.id : undefined,
    organizationName:
      typeof data.org?.name === "string" ? data.org.name : undefined,
    userEmail:
      typeof data.user?.email === "string" ? data.user.email : undefined,
  };
  if (!identity.organizationId && !identity.organizationName) {
    throw new Error("The new credential did not resolve to an organization");
  }
  return identity;
}

export async function startAuthFlow(
  timeoutMs = 120_000,
  apiUrl =
    process.env.SUPERMEMORY_API_URL ??
    process.env.SUPERMEMORY_BASE_URL ??
    DEFAULT_API_URL,
  mode?: BrowserAuthMode,
): Promise<{
  success: boolean;
  apiKey?: string;
  identity?: SessionIdentity;
  error?: string;
}> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const state = randomBytes(16).toString("hex");

    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname !== "/callback") {
          return new Response("Not found", { status: 404 });
        }

        let apiKey: string;
        try {
          apiKey = parseAuthCallback(url, state);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Invalid callback";
          return new Response(message, {
            status: message === "Invalid callback state" ? 403 : 400,
          });
        }

        try {
          const identity = await verifyApiKey(apiKey, apiUrl);
          saveCredentials(apiKey);
          settled = true;
          server.stop();
          clearTimeout(timer);
          resolve({ success: true, apiKey, identity });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Credential verification failed";
          settled = true;
          server.stop();
          clearTimeout(timer);
          resolve({ success: false, error: message });
          return new Response(`Authentication failed: ${message}`, {
            status: 400,
          });
        }

        return new Response(SUCCESS_HTML, {
          headers: { "Content-Type": "text/html" },
        });
      },
    });

    const callbackUrl = `http://127.0.0.1:${server.port}/callback?state=${state}`;
    const authUrl = createBrowserAuthUrl(callbackUrl, mode);

    process.stderr.write(`\nOpen this URL to connect Supermemory to Cursor:\n\n  ${authUrl}\n\nWaiting...\n`);
    const opener = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
    Bun.$`${opener} ${authUrl}`.quiet().nothrow();

    timer = setTimeout(() => {
      if (!settled) {
        server.stop();
        resolve({ success: false, error: "Authentication timed out" });
      }
    }, timeoutMs);
  });
}
