import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const launcher = JSON.parse(fs.readFileSync("mcp.json", "utf-8")).mcpServers
  .supermemory as { args: string[] };
const hooks = JSON.parse(fs.readFileSync("hooks/hooks.json", "utf-8")).hooks as Record<
  string,
  { command: string }[]
>;

// The launchers are JSON strings, so nothing else typechecks them.
function install(where: string[], marker: string) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sm-launch-"));
  const root = path.join(home, ...where);
  fs.mkdirSync(path.join(root, "dist"), { recursive: true });
  for (const file of ["cli.js", "capture.js"]) {
    fs.writeFileSync(
      path.join(root, "dist", file),
      `console.log("${marker}:${file}:" + (process.argv[2] || ""));`,
    );
  }
  return { home, root };
}

function runLauncher(home: string, env: Record<string, string>, pluginRootArg = "${CLAUDE_PLUGIN_ROOT}") {
  return Bun.spawnSync({
    cmd: [process.execPath, "-e", launcher.args[1] as string, pluginRootArg],
    env: { ...process.env, HOME: home, ...env } as Record<string, string>,
  });
}

test("starts the cli when CURSOR_PLUGIN_ROOT is unexpanded", () => {
  const { home } = install([".cursor", "plugins", "local", "cursor-supermemory"], "CURSOR");
  const res = runLauncher(home, { CURSOR_PLUGIN_ROOT: "${CURSOR_PLUGIN_ROOT}" });

  expect(res.stdout.toString()).toContain("CURSOR:cli.js:mcp");
  expect(res.exitCode).toBe(0);
});

test("starts the cli from a Grok install, where CURSOR_PLUGIN_ROOT never exists", () => {
  const { home } = install([".grok", "installed-plugins", "plugin-7a5399f3"], "GROK");
  const res = runLauncher(home, { CURSOR_PLUGIN_ROOT: "", CLAUDE_PLUGIN_ROOT: "", GROK_PLUGIN_ROOT: "" });

  expect(res.stdout.toString()).toContain("GROK:cli.js:mcp");
  expect(res.exitCode).toBe(0);
});

test("prefers the plugin root a host expanded into the argument", () => {
  const { home, root } = install(["somewhere", "else"], "ARGV");
  const res = runLauncher(home, { CURSOR_PLUGIN_ROOT: "", CLAUDE_PLUGIN_ROOT: "" }, root);

  expect(res.stdout.toString()).toContain("ARGV:cli.js:mcp");
  expect(res.exitCode).toBe(0);
});

test("reports a missing install instead of starting nothing", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sm-launch-"));
  const res = runLauncher(home, { CURSOR_PLUGIN_ROOT: "", CLAUDE_PLUGIN_ROOT: "", GROK_PLUGIN_ROOT: "" });

  expect(res.stderr.toString()).toContain("could not locate the plugin install");
  expect(res.exitCode).toBe(1);
});

test("hooks resolve the plugin root on every host", () => {
  const command = hooks.sessionEnd?.[0]?.command as string;
  const script = command.slice(command.indexOf("'") + 1, command.lastIndexOf("'"));

  // Hosts hand hooks the root through their own variable, never through a shared one.
  for (const [marker, variable] of [
    ["CURSOR", "CURSOR_PLUGIN_ROOT"],
    ["CLAUDE", "CLAUDE_PLUGIN_ROOT"],
    ["GROK", "GROK_PLUGIN_ROOT"],
  ] as const) {
    const { home, root } = install(["installs", marker], marker);
    const res = Bun.spawnSync({
      cmd: [process.execPath, "-e", script, "${CLAUDE_PLUGIN_ROOT}", "capture"],
      env: {
        ...process.env,
        HOME: home,
        CURSOR_PLUGIN_ROOT: "",
        CLAUDE_PLUGIN_ROOT: "",
        GROK_PLUGIN_ROOT: "",
        [variable]: root,
      } as Record<string, string>,
    });

    expect(res.stdout.toString()).toContain(`${marker}:capture.js:`);
    expect(res.exitCode).toBe(0);
  }
});

test("a hook with no plugin root anywhere fails open", () => {
  const command = hooks.preToolUse?.[0]?.command as string;
  const script = command.slice(command.indexOf("'") + 1, command.lastIndexOf("'"));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sm-launch-"));

  const res = Bun.spawnSync({
    cmd: [process.execPath, "-e", script, "${CLAUDE_PLUGIN_ROOT}", "approve-memory"],
    env: { ...process.env, HOME: home, CURSOR_PLUGIN_ROOT: "", CLAUDE_PLUGIN_ROOT: "" } as Record<
      string,
      string
    >,
  });

  expect(res.exitCode).toBe(0);
});
