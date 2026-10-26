import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { version as PLUGIN_VERSION } from "../package.json";

const AUTH_PORT = Number(process.env.SUPERMEMORY_AUTH_PORT) || 19878;
const CALLBACK_URL = `http://localhost:${AUTH_PORT}/callback`;
const PENDING_MARKER = "supermemory-login";
const AUTH_URL =
  process.env.SUPERMEMORY_AUTH_URL ||
  "https://console.supermemory.ai/auth/connect";
const configuredTimeout = Number(process.env.SUPERMEMORY_AUTH_TIMEOUT);
export const LISTEN_TIMEOUT_MS =
  Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : 10 * 60_000;

export interface AuthClient {
  id: "cursor" | "grok_bot";
  name: string;
}

const CLIENTS: Record<AuthClient["id"], AuthClient> = {
  cursor: { id: "cursor", name: "Cursor" },
  grok_bot: { id: "grok_bot", name: "Grok Bot" },
};

const GROK_ENV = ["GROK_PLUGIN_ROOT", "GROK_SESSION_ID", "GROK_HOOK_EVENT", "GROK_WORKSPACE_ROOT"];

function credentialsDir(): string {
  return path.join(os.homedir(), ".supermemory-cursor");
}

function credentialsFile(): string {
  return path.join(credentialsDir(), "credentials.json");
}

function page(title: string, message: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title} - Supermemory</title><style>
  body { background: #111; color: #fff; font-family: system-ui; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  h1 { font-size: 2rem; margin: 0 0 12px; } p { color: #aaa; }
</style></head><body><h1>${title}</h1><p>${message}</p></body></html>`;
}

export function loadCredentials(): { apiKey: string; createdAt: string } | null {
  try {
    const file = credentialsFile();
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (data.apiKey) return data;
    return null;
  } catch {
    return null;
  }
}

export function saveCredentials(apiKey: string): void {
  fs.mkdirSync(credentialsDir(), { recursive: true, mode: 0o700 });
  const data = { apiKey, createdAt: new Date().toISOString() };
  fs.writeFileSync(credentialsFile(), JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function clearCredentials(): boolean {
  try {
    const file = credentialsFile();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// An explicit --client wins; otherwise Grok's own hook variables (not GROK_API_KEY) or a ~/.grok install mean Grok.
export function detectClient(
  requested?: string | null,
  env: NodeJS.ProcessEnv = process.env,
  entry = process.argv[1] ?? "",
): AuthClient {
  const key = requested?.trim().toLowerCase().replace(/[\s-]/g, "_");
  if (key === "grok" || key === "grok_bot" || key === "grokbot") return CLIENTS.grok_bot;
  if (key === "cursor") return CLIENTS.cursor;
  const grokEnv = GROK_ENV.some((name) => !!env[name] && !env[name]!.includes("${"));
  const grokInstall = entry.split(/[\\/]/).includes(".grok");
  return grokEnv || grokInstall ? CLIENTS.grok_bot : CLIENTS.cursor;
}

// The console shows these on its Request card and names the key after the device.
export function buildAuthUrl(client: AuthClient, cwd = process.cwd()): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    callback: CALLBACK_URL,
    client: client.id,
    hostname: `${client.name} - ${os.hostname()}`,
    os: `${os.platform()} ${os.release()}`,
    cwd,
    cli_version: PLUGIN_VERSION,
  }).toString();
  return url.toString();
}

// Reads the key out of a callback address the browser could not deliver, e.g. pasted from its address bar.
export function apiKeyFromCallbackUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const apiKey = url.searchParams.get("apikey") || url.searchParams.get("api_key");
    return apiKey?.startsWith("sm_") ? apiKey : null;
  } catch {
    return null;
  }
}

// Headless machines have no opener, and an unhandled spawn error would kill the caller.
function openBrowser(url: string): void {
  const platform = process.platform;
  const command =
    platform === "win32" ? "cmd" : platform === "darwin" ? "open" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(command, args, { stdio: "ignore", detached: true })
    .on("error", () => {})
    .unref();
}

async function probeListener(): Promise<"ours" | "other" | "free"> {
  try {
    const response = await fetch(`http://127.0.0.1:${AUTH_PORT}/pending`, {
      signal: AbortSignal.timeout(1_000),
    });
    return (await response.text()) === PENDING_MARKER ? "ours" : "other";
  } catch {
    return "free";
  }
}

// Serves the callback until a key arrives or the window closes. Runs in its own detached process.
export function listenForCallback(
  client: AuthClient,
  timeoutMs = LISTEN_TIMEOUT_MS,
): Promise<{ success: boolean; apiKey?: string; error?: string }> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: { success: boolean; apiKey?: string; error?: string }) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      server.close();
      resolve(result);
    };

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${AUTH_PORT}`);
      if (url.pathname === "/pending") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(PENDING_MARKER);
        return;
      }
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      if (url.searchParams.get("error") === "user_cancelled") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(page("Cancelled", "Supermemory was not connected. You can close this tab."), () =>
          finish({ success: false, error: "Sign-in was cancelled" }),
        );
        return;
      }

      const apiKey = apiKeyFromCallbackUrl(url.toString());
      if (!apiKey) {
        res.writeHead(400);
        res.end("Invalid API key");
        return;
      }

      saveCredentials(apiKey);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        page(`Connected to ${client.name}!`, "Supermemory is ready. You can close this tab."),
        () => finish({ success: true, apiKey }),
      );
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      const detail =
        error.code === "EADDRINUSE"
          ? `Port ${AUTH_PORT} is already in use`
          : error.message;
      finish({ success: false, error: detail });
    });

    server.listen(AUTH_PORT, "127.0.0.1");

    timer = setTimeout(() => {
      finish({ success: false, error: "Authentication timed out" });
    }, timeoutMs);
  });
}

// Starts (or reuses) the background listener so the sign-in outlives the shell command that began it.
export async function beginLogin(
  client: AuthClient,
  cliPath: string,
): Promise<{ url: string; error?: string }> {
  const url = buildAuthUrl(client);
  let state = await probeListener();
  if (state === "free") {
    spawn(process.execPath, [cliPath, "login-listen", "--client", client.id], {
      detached: true,
      stdio: "ignore",
    }).unref();
    for (let i = 0; i < 25 && state !== "ours"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      state = await probeListener();
    }
  }
  if (state !== "ours") {
    return { url, error: `Could not open the sign-in callback on port ${AUTH_PORT}` };
  }
  openBrowser(url);
  return { url };
}

export async function waitForCredentials(timeoutMs = LISTEN_TIMEOUT_MS): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (loadCredentials()) return true;
    if ((await probeListener()) !== "ours") return !!loadCredentials();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}
