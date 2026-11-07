import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "./config.ts";
import {
  getGeneratedRepoTag,
  getResolvedTags,
  normalizeGitRemote,
  sanitizeRepoName,
  sha256,
} from "./tags.ts";

function git(cwd: string, args: string) {
  execSync(`git -c user.email=t@example.com -c user.name=t ${args}`, { cwd, stdio: "ignore" });
}

describe("repository identity", () => {
  test("normalizes equivalent HTTPS and SSH remotes", () => {
    expect(
      normalizeGitRemote("https://github.com/SupermemoryAI/mono.git"),
    ).toBe("github.com/supermemoryai/mono");
    expect(normalizeGitRemote("git@github.com:SupermemoryAI/mono.git")).toBe(
      "github.com/supermemoryai/mono",
    );
  });

  test("sanitizes display names without losing repository identity", () => {
    expect(sanitizeRepoName("Codex Supermemory.js")).toBe(
      "codex_supermemory_js",
    );
    expect(sha256("github.com/supermemoryai/mono")).toHaveLength(16);
  });

  test("worktrees share the base repository tag, including bare repositories without a remote", () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "cursor-supermemory-tags-")));
    const base = join(root, "app");
    git(root, "init -q app");
    writeFileSync(join(base, "f"), "x");
    git(base, "add f");
    git(base, "commit -qm init");
    git(base, `worktree add -q ${join(root, "conductor", "osaka")} -b osaka`);
    expect(getGeneratedRepoTag(join(root, "conductor", "osaka"))).toBe(getGeneratedRepoTag(base));
    expect(getGeneratedRepoTag(base)).toBe(`repo_app__${sha256(`path:${base}`)}`);

    git(root, "clone -q --bare app app.git");
    const bare = join(root, "app.git");
    git(bare, "remote remove origin");
    git(bare, `worktree add -q ${join(root, "wt", "one")} -b one`);
    git(bare, `worktree add -q ${join(root, "wt", "two")} -b two`);
    const one = getResolvedTags(join(root, "wt", "one"), loadConfig(root));
    expect(one.canonical).toBe(getGeneratedRepoTag(join(root, "wt", "two")));
    expect(one.canonical).toBe(`repo_app_git__${sha256(`path:${bare}`)}`);
    expect(one.allReads).toContain(`repo_one__${sha256(`path:${join(root, "wt", "one")}`)}`);
  });
});
