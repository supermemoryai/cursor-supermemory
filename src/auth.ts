import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";

const CREDENTIALS_DIR = path.join(os.homedir(), ".supermemory-cursor");
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");
const AUTH_URL = "https://app.supermemory.ai/auth/connect";

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

function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
        : ["xdg-open", [url]];
  const child = spawn(cmd, args, { stdio: "ignore", detached: true });
  child.on("error", () => {});
  child.unref();
}

export async function startAuthFlow(
  timeoutMs = 120_000,
): Promise<{ success: boolean; apiKey?: string; error?: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const stateToken = randomBytes(16).toString("hex");

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        res.writeHead(404).end("Not found");
        return;
      }

      if (url.searchParams.get("state") !== stateToken) {
        res.writeHead(403, { Connection: "close" }).end("Invalid state");
        return;
      }

      const apiKey = url.searchParams.get("apikey") || url.searchParams.get("api_key");
      if (!apiKey?.startsWith("sm_")) {
        res.writeHead(400).end("Invalid API key");
        return;
      }

      saveCredentials(apiKey);
      settled = true;
      res.writeHead(200, { "Content-Type": "text/html", Connection: "close" }).end(SUCCESS_HTML);
      clearTimeout(timer);
      server.close();
      resolve({ success: true, apiKey });
    });

    server.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ success: false, error: err.message });
    });

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      const callbackUrl = `http://127.0.0.1:${port}/callback?state=${stateToken}`;
      const authUrl = `${AUTH_URL}?callback=${encodeURIComponent(callbackUrl)}&client=cursor`;
      process.stderr.write(`\nOpen this URL to connect Supermemory to Cursor:\n\n  ${authUrl}\n\nWaiting...\n`);
      openBrowser(authUrl);
    });

    const timer = setTimeout(() => {
      if (!settled) {
        server.close();
        resolve({ success: false, error: "Authentication timed out" });
      }
    }, timeoutMs);
  });
}
