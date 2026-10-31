import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import childProcess from "node:child_process";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type Server } from "node:http";
import { version as PLUGIN_VERSION } from "../package.json";

const CREDENTIALS_DIR = path.join(os.homedir(), ".supermemory-cursor");
export const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");
const CLIENT_FILE = path.join(CREDENTIALS_DIR, "oauth-client.json");
const LOCK_FILE = path.join(CREDENTIALS_DIR, "auth.lock");
export const AUTH_PORT = 19879;
const REDIRECT_URI = `http://127.0.0.1:${AUTH_PORT}/callback`;
const SCOPE = "openid profile email offline_access";
const REFRESH_TIMEOUT = 3_000;
const REFRESH_REQUEST_TIMEOUT = 10_000;
const REFRESH_SKEW = 60_000;
const configuredAuthTimeout = Number(process.env.SUPERMEMORY_AUTH_TIMEOUT);
const AUTH_TIMEOUT =
  Number.isFinite(configuredAuthTimeout) && configuredAuthTimeout > 0
    ? configuredAuthTimeout
    : 5 * 60_000;

// The browser only ever sees these fixed pages; error details stay in the terminal.
function page(title: string, message: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title} - Supermemory</title><style>
  body { background: #111; color: #fff; font-family: system-ui; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  h1 { font-size: 2rem; margin: 0 0 12px; } p { color: #aaa; }
</style></head><body><h1>${title}</h1><p>${message}</p></body></html>`;
}

const successHtml = (host: string) =>
  page(`Connected to ${host}!`, `You can close this tab and return to ${host}.`);
const deniedHtml = (host: string) =>
  page(
    "Authorization denied",
    `Supermemory was not connected. Return to ${host} and run login again to retry.`,
  );
const failedHtml = (host: string) => page("Connection failed", `Return to ${host} and run login again.`);

export interface AuthClient {
  id: "cursor" | "grok_bot";
  name: string;
  uri: string;
}

// The console's consent page names and draws the client from its registered client_uri.
const CLIENTS: Record<AuthClient["id"], AuthClient> = {
  cursor: { id: "cursor", name: "Cursor", uri: "https://github.com/supermemoryai/cursor-supermemory" },
  grok_bot: { id: "grok_bot", name: "Grok Bot", uri: "https://supermemory.ai/docs/integrations/grok-bot" },
};

const GROK_ENV = ["GROK_PLUGIN_ROOT", "GROK_SESSION_ID", "GROK_HOOK_EVENT", "GROK_WORKSPACE_ROOT"];

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

export interface OAuthConfig {
  apiBaseUrl: string;
  issuer: string;
  resource: string;
}

interface OAuthClient extends OAuthConfig {
  clientId: string;
  clientName?: string;
  redirectUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint: string;
}

export interface OAuthCredentials extends OAuthClient {
  type: "oauth";
  accessToken?: string;
  refreshToken?: string;
  expiresAt: number;
  savedAt?: string;
}

export type Credentials =
  | OAuthCredentials
  | { type?: undefined; apiKey: string; createdAt?: string };

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export function isAuthRequired(error: unknown): boolean {
  return error instanceof AuthError && error.code === "AUTH_REQUIRED";
}

export function isAuthPending(error: unknown): boolean {
  return error instanceof AuthError && error.code === "AUTH_PENDING";
}

export function authRequired(): AuthError {
  return new AuthError(
    "Supermemory authentication required. Run `cursor-supermemory login`, or set SUPERMEMORY_API_KEY.",
    "AUTH_REQUIRED",
  );
}

function readJson<T>(file: string): T | null {
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf-8"));
    return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : null;
  } catch {
    return null;
  }
}

export function loadCredentialData(): Credentials | null {
  const data = readJson<Credentials>(CREDENTIALS_FILE);
  return data?.type === "oauth" || (data as { apiKey?: unknown } | null)?.apiKey ? data : null;
}

// Never hand an OAuth token to a synchronous caller: it may need a refresh first.
export function loadCredentials(): string | undefined {
  const data = loadCredentialData();
  return data?.type === "oauth" ? undefined : data?.apiKey;
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  // Older releases created the directory with default permissions.
  fs.chmodSync(CREDENTIALS_DIR, 0o700);
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600, flag: "wx" });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

// Hooks and the MCP proxy run in separate processes. Reclaim only a lock whose
// owner is gone, and use a hard link to serialize reclamation of that inode.
function recoverAbandonedLock(): void {
  let recovery: string | undefined;
  let linked = false;
  try {
    const original = fs.statSync(LOCK_FILE);
    recovery = `${LOCK_FILE}.${original.dev}.${original.ino}.recovery`;
    fs.linkSync(LOCK_FILE, recovery);
    linked = true;
    const snapshot = fs.statSync(recovery);
    if (snapshot.ino !== original.ino || snapshot.dev !== original.dev) return;
    const owner = readJson<{ pid: number }>(recovery);
    let abandoned = false;
    if (owner && Number.isInteger(owner.pid) && owner.pid > 0) {
      try {
        process.kill(owner.pid, 0);
      } catch (error) {
        abandoned = (error as NodeJS.ErrnoException).code === "ESRCH";
      }
    } else {
      abandoned = Date.now() - snapshot.mtimeMs > 10 * 60_000;
    }
    if (abandoned) {
      const current = fs.statSync(LOCK_FILE);
      if (current.ino === original.ino && current.dev === original.dev) fs.unlinkSync(LOCK_FILE);
    }
  } catch (error) {
    if (!["ENOENT", "EEXIST"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
  } finally {
    if (linked && recovery) fs.rmSync(recovery, { force: true });
  }
}

async function withAuthLock<T>(
  action: (remaining: number) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  const deadline = Date.now() + timeoutMs;
  let descriptor: number | undefined;
  while (descriptor === undefined) {
    try {
      descriptor = fs.openSync(LOCK_FILE, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      recoverAbandonedLock();
      if (Date.now() >= deadline) throw new Error("Supermemory authentication is busy. Try again.");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  try {
    fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid }));
    return await action(Math.max(1, deadline - Date.now()));
  } finally {
    fs.closeSync(descriptor);
    fs.rmSync(LOCK_FILE, { force: true });
  }
}

function secureUrl(value: string): string {
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
  ) {
    throw new Error("OAuth requires HTTPS (HTTP is allowed only for loopback development).");
  }
  return url.toString().replace(/\/+$/, "");
}

export function getOAuthConfig(baseUrl: string, mcpUrl: string): OAuthConfig {
  const apiBaseUrl = secureUrl(baseUrl);
  return {
    apiBaseUrl,
    issuer: secureUrl(process.env.SUPERMEMORY_OAUTH_ISSUER || `${apiBaseUrl}/api/auth`),
    resource: secureUrl(mcpUrl),
  };
}

function sameConfig(credentials: Partial<OAuthConfig> | null, config: OAuthConfig): boolean {
  return (
    credentials?.apiBaseUrl === config.apiBaseUrl &&
    credentials?.issuer === config.issuer &&
    credentials?.resource === config.resource
  );
}

export function hasOAuthCredentials(config: OAuthConfig): boolean {
  const credentials = loadCredentialData();
  return (
    credentials?.type === "oauth" &&
    sameConfig(credentials, config) &&
    (!!credentials.refreshToken ||
      (!!credentials.accessToken && credentials.expiresAt > Date.now() + REFRESH_SKEW))
  );
}

function issuerEndpoint(value: string, issuer: string): string {
  const endpoint = secureUrl(value);
  if (new URL(endpoint).origin !== new URL(issuer).origin) {
    throw new Error("OAuth endpoint does not belong to the configured issuer.");
  }
  return endpoint;
}

async function oauthRequest(
  url: string | URL,
  options: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, { ...options, redirect: "error" });
  const body: unknown = await response.json().catch(() => null);
  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (!response.ok) {
    // Do not leak tokens or server response bodies through hook logs.
    const code = ["invalid_grant", "invalid_client", "access_denied"].includes(String(data.error))
      ? String(data.error)
      : "oauth_request_failed";
    throw new AuthError(
      `Supermemory authorization failed (${code}, HTTP ${response.status}).`,
      code,
    );
  }
  return data;
}

async function registerClient(
  config: OAuthConfig,
  signal: AbortSignal,
  authClient: AuthClient = CLIENTS.cursor,
): Promise<OAuthClient> {
  const clientName = `Supermemory for ${authClient.name}`;
  const saved = readJson<OAuthClient>(CLIENT_FILE);
  if (
    sameConfig(saved, config) &&
    saved?.clientId &&
    saved.redirectUri === REDIRECT_URI &&
    (saved.clientName ?? "Supermemory for Cursor") === clientName
  )
    return saved;
  const issuer = new URL(config.issuer);
  const metadata = await oauthRequest(
    new URL(`/.well-known/oauth-authorization-server${issuer.pathname.replace(/\/$/, "")}`, issuer),
    { signal },
  );
  if (metadata.issuer !== config.issuer)
    throw new Error("OAuth discovery returned an unexpected issuer.");
  const authorizationEndpoint = issuerEndpoint(
    String(metadata.authorization_endpoint),
    config.issuer,
  );
  const tokenEndpoint = issuerEndpoint(String(metadata.token_endpoint), config.issuer);
  const registrationEndpoint = issuerEndpoint(
    String(metadata.registration_endpoint),
    config.issuer,
  );
  const revocationEndpoint = issuerEndpoint(String(metadata.revocation_endpoint), config.issuer);
  const registration = await oauthRequest(registrationEndpoint, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: clientName,
      client_uri: authClient.uri,
      software_id: "cursor-supermemory",
      software_version: PLUGIN_VERSION,
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: SCOPE,
    }),
  });
  if (
    typeof registration.client_id !== "string" ||
    !registration.client_id ||
    registration.token_endpoint_auth_method !== "none"
  ) {
    throw new Error("OAuth registration did not return a public client.");
  }
  const client: OAuthClient = {
    ...config,
    clientId: registration.client_id,
    clientName,
    redirectUri: REDIRECT_URI,
    authorizationEndpoint,
    tokenEndpoint,
    revocationEndpoint,
  };
  signal.throwIfAborted();
  writeJson(CLIENT_FILE, client);
  return client;
}

async function exchangeToken(
  client: OAuthClient,
  parameters: Record<string, string>,
  signal: AbortSignal,
  previous?: OAuthCredentials,
): Promise<string> {
  const data = await oauthRequest(issuerEndpoint(client.tokenEndpoint, client.issuer), {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.clientId,
      resource: client.resource,
      ...parameters,
    }),
  });
  const refreshToken = data.refresh_token ?? previous?.refreshToken;
  if (
    typeof data.access_token !== "string" ||
    !data.access_token ||
    typeof data.token_type !== "string" ||
    data.token_type.toLowerCase() !== "bearer" ||
    typeof data.expires_in !== "number" ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0 ||
    typeof refreshToken !== "string" ||
    !refreshToken
  ) {
    throw new Error("OAuth returned an invalid token response.");
  }
  signal.throwIfAborted();
  const credentials: OAuthCredentials = {
    type: "oauth",
    apiBaseUrl: client.apiBaseUrl,
    issuer: client.issuer,
    resource: client.resource,
    clientId: client.clientId,
    redirectUri: client.redirectUri,
    authorizationEndpoint: client.authorizationEndpoint,
    tokenEndpoint: client.tokenEndpoint,
    revocationEndpoint: client.revocationEndpoint,
    accessToken: data.access_token,
    refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    savedAt: new Date().toISOString(),
  };
  writeJson(CREDENTIALS_FILE, credentials);
  return data.access_token;
}

// Never abort a refresh mid-flight: the server would rotate a refresh token we never
// stored, and the next refresh would fail with invalid_grant and sign the user out.
let pendingRefresh: Promise<string> | null = null;

function refreshCredentials(config: OAuthConfig): Promise<string> {
  if (pendingRefresh) return pendingRefresh;
  const refresh = withAuthLock(async (remaining) => {
    const credentials = loadCredentialData();
    if (credentials?.type !== "oauth" || !sameConfig(credentials, config)) throw authRequired();
    if (credentials.accessToken && credentials.expiresAt > Date.now() + REFRESH_SKEW)
      return credentials.accessToken;
    if (!credentials.refreshToken) throw authRequired();
    try {
      return await exchangeToken(
        credentials,
        { grant_type: "refresh_token", refresh_token: credentials.refreshToken },
        AbortSignal.timeout(remaining),
        credentials,
      );
    } catch (error) {
      if (error instanceof AuthError && ["invalid_grant", "invalid_client"].includes(error.code)) {
        const { accessToken: _access, refreshToken: _refresh, ...registration } = credentials;
        writeJson(CREDENTIALS_FILE, registration);
        if (error.code === "invalid_client") fs.rmSync(CLIENT_FILE, { force: true });
        throw authRequired();
      }
      throw error;
    }
  }, REFRESH_REQUEST_TIMEOUT).finally(() => {
    pendingRefresh = null;
  });
  // Callers may stop waiting before the refresh settles.
  refresh.catch(() => {});
  pendingRefresh = refresh;
  return refresh;
}

// Bounds only how long the caller waits; the refresh itself keeps running.
function waitFor<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      const error = new AuthError("Supermemory token refresh is still in progress.", "AUTH_PENDING");
      error.name = "TimeoutError";
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}

export async function getAccessToken(
  config: OAuthConfig,
  timeoutMs = REFRESH_TIMEOUT,
): Promise<string> {
  const saved = loadCredentialData();
  if (saved?.type !== "oauth" || !sameConfig(saved, config)) throw authRequired();
  if (saved.accessToken && saved.expiresAt > Date.now() + REFRESH_SKEW) return saved.accessToken;
  return waitFor(refreshCredentials(config), timeoutMs);
}

// Await before an explicit exit so rotated tokens from an in-flight refresh are saved.
export async function settleAuth(): Promise<void> {
  while (pendingRefresh) {
    await pendingRefresh.catch(() => {});
  }
}

export async function clearCredentials(): Promise<boolean> {
  return withAuthLock(async (remaining) => {
    const credentials = readJson<Credentials>(CREDENTIALS_FILE);
    if (credentials?.type === "oauth" && credentials.refreshToken) {
      await oauthRequest(issuerEndpoint(credentials.revocationEndpoint, credentials.issuer), {
        method: "POST",
        signal: AbortSignal.timeout(remaining),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: credentials.clientId,
          token: credentials.refreshToken,
          token_type_hint: "refresh_token",
        }),
      });
    }
    const existed = fs.existsSync(CREDENTIALS_FILE);
    fs.rmSync(CREDENTIALS_FILE, { force: true });
    return existed;
  }, REFRESH_TIMEOUT);
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // Called through the module object so tests can stub child_process.execFile.
    childProcess.execFile(command, args, { windowsHide: true }, (error) =>
      error ? reject(error) : resolve(),
    );
  });
}

export async function openUrl(url: string | URL): Promise<void> {
  const href = url.toString();
  if (!/^https?:\/\//i.test(href)) throw new Error("Refusing to open non-http URL");
  if (process.platform === "win32") {
    try {
      await run("rundll32.exe", ["url.dll,FileProtocolHandler", href]);
      return;
    } catch {}
    await run("cmd.exe", ["/c", "start", '""', href]);
    return;
  }
  await run(process.platform === "darwin" ? "open" : "xdg-open", [href]);
}

export async function startAuthFlow(
  config: OAuthConfig,
  timeoutMs = AUTH_TIMEOUT,
  { printUrl = false, authClient = detectClient() }: { printUrl?: boolean; authClient?: AuthClient } = {},
): Promise<string> {
  return withAuthLock(async (remaining) => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error("Authentication timed out")),
      remaining,
    );
    let server: Server | undefined;
    try {
      return await new Promise<string>((resolve, reject) => {
        let client: OAuthClient | undefined;
        let exchanging = false;
        const state = randomBytes(32).toString("base64url");
        const verifier = randomBytes(32).toString("base64url");
        controller.signal.addEventListener("abort", () => reject(controller.signal.reason), {
          once: true,
        });
        server = createServer(async (req, res) => {
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("Referrer-Policy", "no-referrer");
          let url: URL;
          try {
            url = new URL(req.url || "/", REDIRECT_URI);
          } catch {
            res.writeHead(400).end();
            return;
          }
          if (req.method !== "GET" || url.pathname !== "/callback") {
            res.writeHead(404).end();
            return;
          }
          const receivedState = Buffer.from(url.searchParams.get("state") || "");
          if (
            !client ||
            receivedState.length !== state.length ||
            !timingSafeEqual(receivedState, Buffer.from(state)) ||
            (url.searchParams.has("iss") && url.searchParams.get("iss") !== client.issuer)
          ) {
            res.writeHead(400).end("Invalid authorization state.");
            return;
          }
          if (exchanging) {
            res.writeHead(409).end();
            return;
          }
          exchanging = true;
          try {
            if (url.searchParams.has("error")) {
              throw new AuthError("Authorization was denied.", "access_denied");
            }
            const code = url.searchParams.get("code");
            if (!code) throw new Error("Authorization code missing.");
            const token = await exchangeToken(
              client,
              {
                grant_type: "authorization_code",
                code,
                code_verifier: verifier,
                redirect_uri: REDIRECT_URI,
              },
              controller.signal,
            );
            res
              .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
              .end(successHtml(authClient.name), () => resolve(token));
          } catch (error) {
            const denied = error instanceof AuthError && error.code === "access_denied";
            if (
              error instanceof AuthError &&
              error.code === "invalid_client" &&
              !controller.signal.aborted
            ) {
              fs.rmSync(CLIENT_FILE, { force: true });
            }
            // Reject once the page is flushed; closing the server drops open connections.
            res
              .writeHead(400, { "Content-Type": "text/html; charset=utf-8" })
              .end(denied ? deniedHtml(authClient.name) : failedHtml(authClient.name), () => reject(error));
          }
        });
        server.on("error", () =>
          reject(
            new Error(
              `Cannot open the authentication callback port ${AUTH_PORT}. Retry after other logins finish.`,
            ),
          ),
        );
        // Claim the callback port before registering, so a busy port fails fast.
        server.listen(AUTH_PORT, "127.0.0.1", async () => {
          try {
            const registered = await registerClient(config, controller.signal, authClient);
            const authorizationUrl = new URL(
              issuerEndpoint(registered.authorizationEndpoint, registered.issuer),
            );
            authorizationUrl.search = new URLSearchParams({
              client_id: registered.clientId,
              redirect_uri: REDIRECT_URI,
              response_type: "code",
              scope: SCOPE,
              resource: registered.resource,
              code_challenge: createHash("sha256").update(verifier).digest("base64url"),
              code_challenge_method: "S256",
              state,
              prompt: "consent",
            }).toString();
            client = registered;
            // The Supermemory CLI collects these links to approve several plugins on one consent screen.
            if (printUrl) {
              process.stdout.write(`SUPERMEMORY_AUTHORIZE_URL=${authorizationUrl}\n`);
              return;
            }
            process.stderr.write(
              `\nOpen this URL to connect Supermemory to ${authClient.name}:\n\n  ${authorizationUrl}\n\nWaiting...\n`,
            );
            openUrl(authorizationUrl).catch(() =>
              process.stderr.write("Could not open a browser. Open the URL above to continue.\n"),
            );
          } catch (error) {
            reject(error);
          }
        });
      });
    } finally {
      clearTimeout(timer);
      controller.abort();
      server?.close();
      server?.closeAllConnections();
    }
  }, timeoutMs);
}
