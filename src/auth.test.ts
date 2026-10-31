import { expect, test } from "bun:test";
import { createServer } from "node:http";
import { AUTH_PORT, detectClient, getOAuthConfig, startAuthFlow } from "./auth.ts";

test("login fails fast when the callback port is taken", async () => {
  const blocker = createServer();
  await new Promise<void>((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(AUTH_PORT, "127.0.0.1", resolve);
  });
  try {
    await expect(
      startAuthFlow(
        getOAuthConfig("https://api.supermemory.ai", "https://mcp.supermemory.ai/mcp"),
        2_000,
      ),
    ).rejects.toThrow("19879");
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
  expect(detectClient("grok_bot", {}).uri).toBe("https://supermemory.ai/docs/integrations/grok-bot");
});
