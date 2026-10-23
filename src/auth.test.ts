import { expect, test } from "bun:test";
import { createServer } from "node:http";
import { AUTH_PORT, getOAuthConfig, startAuthFlow } from "./auth.ts";

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
