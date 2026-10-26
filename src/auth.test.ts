import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  apiKeyFromCallbackUrl,
  buildAuthUrl,
  detectClient,
  listenForCallback,
} from "./auth.ts";

const root = join(import.meta.dir, "..");
const node = Bun.which("node") ?? "node";

test("login fails fast when the callback port is taken", async () => {
  const blocker = createServer();
  await new Promise<void>((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(19878, "127.0.0.1", resolve);
  });
  try {
    const result = await listenForCallback(detectClient("cursor"), 2_000);
    expect(result.success).toBe(false);
    expect(result.error).toContain("19878");
  } finally {
    await new Promise<void>((resolve, reject) => {
      blocker.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("detects Grok from --client, its hook variables or a ~/.grok install", () => {
  expect(detectClient("grok_bot", {}).id).toBe("grok_bot");
  expect(detectClient("Grok-Bot", {}).id).toBe("grok_bot");
  expect(detectClient("cursor", { GROK_SESSION_ID: "s1" }).id).toBe("cursor");
  expect(detectClient(null, { GROK_SESSION_ID: "s1" }, "/x/dist/cli.js").id).toBe("grok_bot");
  expect(
    detectClient(null, {}, "/home/box/.grok/installed-plugins/plugin-1/dist/cli.js").id,
  ).toBe("grok_bot");
  expect(detectClient(null, { GROK_API_KEY: "xai-1" }, "/x/dist/cli.js").id).toBe("cursor");
  expect(detectClient(null, { GROK_PLUGIN_ROOT: "${GROK_PLUGIN_ROOT}" }, "/x").id).toBe("cursor");
});

test("the auth URL names the client and the device for the approval page", () => {
  const url = new URL(buildAuthUrl(detectClient("grok_bot", {}), "/workspace"));
  expect(url.searchParams.get("client")).toBe("grok_bot");
  expect(url.searchParams.get("callback")).toBe("http://localhost:19878/callback");
  expect(url.searchParams.get("hostname")).toStartWith("Grok Bot - ");
  expect(url.searchParams.get("cwd")).toBe("/workspace");
  expect(url.searchParams.get("cli_version")).toMatch(/^\d+\.\d+\.\d+/);
});

test("reads the key from an undelivered callback address", () => {
  expect(
    apiKeyFromCallbackUrl(
      "http://localhost:19878/callback?apikey=sm_abc123&api_url=https%3A%2F%2Fapi.supermemory.ai",
    ),
  ).toBe("sm_abc123");
  expect(apiKeyFromCallbackUrl("http://localhost:19878/callback?apikey=nope")).toBeNull();
  expect(apiKeyFromCallbackUrl("not a url")).toBeNull();
});

test("login --no-wait returns while a detached listener finishes the sign-in", async () => {
  const home = mkdtempSync(join(tmpdir(), "cursor-supermemory-login-"));
  const port = 20_000 + Math.floor(Math.random() * 20_000);
  const env = {
    ...Bun.env,
    HOME: home,
    USERPROFILE: home,
    SUPERMEMORY_API_KEY: "",
    SUPERMEMORY_AUTH_PORT: String(port),
    SUPERMEMORY_AUTH_URL: "https://console.example.test/auth/connect",
    SUPERMEMORY_AUTH_TIMEOUT: "20000",
    PATH: "/nonexistent",
  };
  try {
    // An empty PATH means no browser opener, as on a headless Grok computer.
    const login = Bun.spawn(
      [node, join(root, "dist", "cli.js"), "login", "--no-wait", "--client", "grok_bot"],
      { env, stdout: "pipe", stderr: "pipe" },
    );
    expect(await login.exited).toBe(0);
    const output = await new Response(login.stdout).text();
    expect(output).toContain("connect Supermemory to Grok Bot");
    expect(output).toContain("client=grok_bot");

    // The login process is gone; the listener it left behind still answers.
    const callback = await fetch(`http://127.0.0.1:${port}/callback?apikey=sm_from_console`);
    expect(callback.status).toBe(200);
    expect(await callback.text()).toContain("Connected to Grok Bot!");
    const saved = JSON.parse(
      readFileSync(join(home, ".supermemory-cursor", "credentials.json"), "utf-8"),
    );
    expect(saved.apiKey).toBe("sm_from_console");

    await Bun.sleep(200);
    await expect(fetch(`http://127.0.0.1:${port}/pending`)).rejects.toThrow();
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("login --callback-url saves the key without a listener", async () => {
  const home = mkdtempSync(join(tmpdir(), "cursor-supermemory-login-"));
  try {
    const login = Bun.spawn(
      [
        node,
        join(root, "dist", "cli.js"),
        "login",
        "--callback-url",
        "http://localhost:19878/callback?apikey=sm_pasted&api_url=https%3A%2F%2Fapi.supermemory.ai",
      ],
      { env: { ...Bun.env, HOME: home, USERPROFILE: home }, stdout: "pipe" },
    );
    expect(await login.exited).toBe(0);
    const file = join(home, ".supermemory-cursor", "credentials.json");
    expect(existsSync(file)).toBe(true);
    expect(JSON.parse(readFileSync(file, "utf-8")).apiKey).toBe("sm_pasted");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
