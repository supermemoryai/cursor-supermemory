import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { randomBytes } from "node:crypto";

const CREDENTIALS_DIR = path.join(os.homedir(), ".supermemory-cursor");
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");
const AUTH_URL = process.env.SUPERMEMORY_AUTH_URL || "https://app.supermemory.ai/auth/connect";

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
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
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

export async function startAuthFlow(
  timeoutMs = 120_000,
): Promise<{ success: boolean; apiKey?: string; error?: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const stateToken = randomBytes(16).toString("hex");

    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname !== "/callback") {
          return new Response("Not found", { status: 404 });
        }

        if (url.searchParams.get("state") !== stateToken) {
          return new Response("Invalid state", { status: 403 });
        }

        const apiKey = url.searchParams.get("apikey") || url.searchParams.get("api_key");
        if (!apiKey?.startsWith("sm_")) {
          return new Response("Invalid API key", { status: 400 });
        }

        saveCredentials(apiKey);
        settled = true;
        server.stop();
        clearTimeout(timer);
        resolve({ success: true, apiKey });

        return new Response(SUCCESS_HTML, {
          headers: { "Content-Type": "text/html" },
        });
      },
    });

    const callbackUrl = `http://127.0.0.1:${server.port}/callback?state=${stateToken}`;
    const authUrl = `${AUTH_URL}?callback=${encodeURIComponent(callbackUrl)}&client=cursor`;

    process.stderr.write(`\nOpen this URL to connect Supermemory to Cursor:\n\n  ${authUrl}\n\nWaiting...\n`);
    openUrl(authUrl).catch((error) => {
      process.stderr.write(`Failed to open browser automatically: ${error.message}\n`);
    });

    const timer = setTimeout(() => {
      if (!settled) {
        server.stop();
        resolve({ success: false, error: "Authentication timed out" });
      }
    }, timeoutMs);
  });
}

async function openUrl(url: string): Promise<void> {
  if (process.platform === "win32") {
    const result = await Bun.spawn(["cmd.exe", "/c", "start", "", url]).exited;
    if (result !== 0) throw new Error(`browser opener exited with code ${result}`);
    return;
  }

  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  const result = await Bun.spawn([opener, url]).exited;
  if (result !== 0) throw new Error(`browser opener exited with code ${result}`);
}
