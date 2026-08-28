import { describe, expect, test } from "bun:test";
import {
  formatRecall,
  selectRecallResults,
  shouldSkipPrompt,
} from "./prompt-recall.ts";

describe("prompt recall", () => {
  test("skips trivial and command prompts", () => {
    expect(shouldSkipPrompt("hi")).toBe(true);
    expect(shouldSkipPrompt("/supermemory-status")).toBe(true);
    expect(shouldSkipPrompt("continue the database migration")).toBe(false);
  });

  test("filters, sorts, and deduplicates recalled memories", () => {
    const profiles = [
      {
        searchResults: {
          results: [
            { memory: "Use Drizzle", similarity: 0.8 },
            { memory: "Ignore this", similarity: 0.2 },
            { memory: "Use Drizzle", similarity: 0.9 },
            { title: "Migration", content: "Expand then contract", similarity: 0.7 },
          ],
        },
      },
    ];
    const selected = selectRecallResults(profiles, []);
    expect(selected.fresh).toHaveLength(2);
    expect(selected.fresh[0]?.memory).toBe("Use Drizzle");
    expect(formatRecall(selected.fresh, "repo_example__1234")).toContain(
      "- ◪ Migration — Expand then contract",
    );
    expect(selectRecallResults(profiles, selected.hashes).fresh).toHaveLength(0);
  });
});
