import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const launcher = JSON.parse(fs.readFileSync("mcp.json", "utf-8")).mcpServers
  .supermemory as { command: string; args: string[] };

// The launcher is inlined in mcp.json because Cloud Agents cannot expand a path
// to a script file, so nothing else typechecks it. These run it as Cursor would.
function runLauncher(home: string, envRoot: string) {
  return Bun.spawnSync({
    cmd: [process.execPath, ...launcher.args],
    env: { ...process.env, HOME: home, CURSOR_PLUGIN_ROOT: envRoot } as Record<string, string>,
  });
}

function installAt(root: string, body = "console.log('STARTED:' + process.argv[2]);") {
  fs.mkdirSync(path.join(root, "dist"), { recursive: true });
  fs.writeFileSync(path.join(root, "dist", "cli.js"), body);
  return root;
}

const tmpHome = () => fs.mkdtempSync(path.join(os.tmpdir(), "sm-launch-"));

describe("mcp.json launcher", () => {
  test("starts the cli when CURSOR_PLUGIN_ROOT is unexpanded", () => {
    const home = tmpHome();
    installAt(path.join(home, ".cursor", "plugins", "local", "cursor-supermemory"));

    const res = runLauncher(home, "${CURSOR_PLUGIN_ROOT}");
    expect(res.stdout.toString()).toContain("STARTED:mcp");
    expect(res.exitCode).toBe(0);
  });

  test("prefers a valid CURSOR_PLUGIN_ROOT over the fallback", () => {
    const home = tmpHome();
    installAt(
      path.join(home, ".cursor", "plugins", "local", "cursor-supermemory"),
      "console.log('LOCAL');",
    );
    const envRoot = installAt(path.join(home, "explicit"), "console.log('EXPLICIT');");

    expect(runLauncher(home, envRoot).stdout.toString()).toContain("EXPLICIT");
  });

  test("finds a cached marketplace copy when there is no local install", () => {
    const home = tmpHome();
    installAt(
      path.join(home, ".cursor", "plugins", "cache", "cursor-public", "cursor-supermemory", "abc"),
    );

    expect(runLauncher(home, "${CURSOR_PLUGIN_ROOT}").stdout.toString()).toContain("STARTED:mcp");
  });

  test("exits non-zero with a readable message when nothing is installed", () => {
    const res = runLauncher(tmpHome(), "${CURSOR_PLUGIN_ROOT}");

    expect(res.exitCode).not.toBe(0);
    expect(res.stderr.toString()).toContain("could not locate the plugin install");
  });
});
