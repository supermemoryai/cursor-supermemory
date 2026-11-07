import { describe, expect, test } from "bun:test";
import { normalizeGitRemote, sanitizeRepoName, sha256 } from "./tags.ts";

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
});
