import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { randomBytes } from "node:crypto";

const CREDENTIALS_DIR = path.join(os.homedir(), ".supermemory-cursor");
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");
const AUTH_ATTEMPTED_FILE = path.join(CREDENTIALS_DIR, ".auth-attempted");
const LOGGED_OUT_FILE = path.join(CREDENTIALS_DIR, ".logged-out");
const AUTH_URL = process.env.SUPERMEMORY_AUTH_URL || "https://app.supermemory.ai/auth/connect";
const CURSOR_LOGO_FILE = path.join(import.meta.dir, "..", "assets", "cursor.png");

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Connected - Supermemory</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { min-height: 100%; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background:
        radial-gradient(circle at 50% 0%, rgba(75, 160, 250, 0.16), transparent 38%),
        #08090b;
      color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .card {
      width: min(440px, 100%);
      padding: 32px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      background: #14161a;
      box-shadow:
        inset 2px 2px 4px rgba(11, 15, 21, 0.7),
        0 24px 80px rgba(0, 0, 0, 0.28);
      text-align: center;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 32px;
      padding: 0 14px;
      margin-bottom: 22px;
      border: 1px solid rgba(34, 197, 94, 0.24);
      border-radius: 999px;
      background: rgba(34, 197, 94, 0.08);
      color: #4ade80;
      font-size: 13px;
      font-weight: 500;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 18px rgba(34, 197, 94, 0.7);
    }
    .logos {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      margin-bottom: 24px;
    }
    .logo-box {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      background: #080b0f;
    }
    .plus {
      color: #737373;
      font-size: 20px;
      font-weight: 500;
    }
    .cursor-logo {
      width: 34px;
      height: 34px;
      object-fit: contain;
      display: block;
    }
    .supermemory-mark {
      width: 28px;
      height: 28px;
      color: #fafafa;
    }
    h1 {
      margin-bottom: 8px;
      font-size: 26px;
      line-height: 1.18;
      font-weight: 650;
      letter-spacing: -0.02em;
    }
    p {
      color: #9ca3af;
      font-size: 15px;
      line-height: 1.55;
    }
    .hint {
      margin-top: 22px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      color: #737373;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="status"><span class="dot"></span><span>Connected</span></div>
    <div class="logos">
      <div class="logo-box" aria-label="Cursor"><img class="cursor-logo" src="/cursor.png" alt="Cursor" /></div>
      <span class="plus">+</span>
      <div class="logo-box" aria-label="Supermemory">
        <svg class="supermemory-mark" fill="none" viewBox="0 0 230 168" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path fill="currentColor" d="M205.864 66.263h-76.401V0h-24.684v71.897c0 7.636 3.021 14.97 8.391 20.373l62.383 62.777 17.454-17.564-46.076-46.365h58.948v-24.84l-.015-.015ZM12.872 30.517l46.075 46.365H0v24.84h76.4v66.264h24.685V96.089c0-7.637-3.021-14.97-8.39-20.374l-62.37-62.762-17.453 17.564Z"/>
        </svg>
      </div>
    </div>
    <h1>Cursor is connected</h1>
    <p>Supermemory is ready to provide persistent context inside Cursor.</p>
    <div class="hint">You can close this tab and return to Cursor.</div>
  </main>
</body>
</html>`;

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
  clearAuthAttempted();
  clearLoggedOutMarker();
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

export function hasAuthAttempted(): boolean {
  return fs.existsSync(AUTH_ATTEMPTED_FILE);
}

export function markAuthAttempted(): void {
  fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(AUTH_ATTEMPTED_FILE, new Date().toISOString());
}

export function clearAuthAttempted(): void {
  try {
    if (fs.existsSync(AUTH_ATTEMPTED_FILE)) fs.unlinkSync(AUTH_ATTEMPTED_FILE);
  } catch {}
}

export function isLoggedOut(): boolean {
  return fs.existsSync(LOGGED_OUT_FILE);
}

export function markLoggedOut(): void {
  fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(LOGGED_OUT_FILE, new Date().toISOString());
  clearAuthAttempted();
}

export function clearLoggedOutMarker(): void {
  try {
    if (fs.existsSync(LOGGED_OUT_FILE)) fs.unlinkSync(LOGGED_OUT_FILE);
  } catch {}
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

        if (url.pathname === "/cursor.png") {
          return new Response(Bun.file(CURSOR_LOGO_FILE), {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "no-store",
            },
          });
        }

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
    const result = await Bun.spawn(["rundll32.exe", "url.dll,FileProtocolHandler", url]).exited;
    if (result !== 0) throw new Error(`browser opener exited with code ${result}`);
    return;
  }

  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  const result = await Bun.spawn([opener, url]).exited;
  if (result !== 0) throw new Error(`browser opener exited with code ${result}`);
}
