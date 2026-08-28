import { expect, test } from "bun:test";
import { createServer } from "node:http";
import { startAuthFlow } from "./auth.ts";

test("login fails fast when the callback port is taken", async () => {
  const blocker = createServer();
  await new Promise<void>((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(19878, "127.0.0.1", resolve);
  });
  try {
    const result = await startAuthFlow(2_000);
    expect(result.success).toBe(false);
    expect(result.error).toContain("19878");
  } finally {
    await new Promise<void>((resolve, reject) => {
      blocker.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
