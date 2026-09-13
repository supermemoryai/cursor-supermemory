import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const launcher = JSON.parse(fs.readFileSync("mcp.json", "utf-8")).mcpServers
  .supermemory as { args: string[] };

// The launcher is a JSON string, so nothing else typechecks it.
test("starts the cli when CURSOR_PLUGIN_ROOT is unexpanded", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sm-launch-"));
  const dist = path.join(home, ".cursor", "plugins", "local", "cursor-supermemory", "dist");
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, "cli.js"), "console.log('STARTED:' + process.argv[2]);");

  const res = Bun.spawnSync({
    cmd: [process.execPath, ...launcher.args],
    env: { ...process.env, HOME: home, CURSOR_PLUGIN_ROOT: "${CURSOR_PLUGIN_ROOT}" } as Record<
      string,
      string
    >,
  });

  expect(res.stdout.toString()).toContain("STARTED:mcp");
  expect(res.exitCode).toBe(0);
});
