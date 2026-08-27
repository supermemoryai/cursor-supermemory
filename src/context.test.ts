import { expect, test } from "bun:test";
import { formatSessionContext } from "./context.ts";

test("formats and deduplicates Claude-style session context", () => {
  const context = formatSessionContext(
    [
      { profile: { static: ["Uses Bun"], dynamic: ["Fixing auth"] } },
      { profile: { static: ["Uses Bun"], dynamic: [] } },
    ],
    5,
    "repo_example__1234",
    "example",
  );
  expect(context.match(/Uses Bun/g)).toHaveLength(1);
  expect(context).toContain("- ◪ Fixing auth");
  expect(context).toContain("repo_example__1234");
});
