import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function checksDir(): string {
  return join(homedir(), ".supermemory-cursor", "tag-checks");
}

function checksPath(canonicalTag: string): string {
  const id = createHash("sha256").update(canonicalTag).digest("hex").slice(0, 32);
  return join(checksDir(), `${id}.json`);
}

function readTagChecks(canonicalTag: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(readFileSync(checksPath(canonicalTag), "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export function recordTagChecks(
  canonicalTag: string,
  hasMemories: Record<string, boolean>,
): void {
  if (Object.keys(hasMemories).length === 0) return;
  try {
    mkdirSync(checksDir(), { recursive: true, mode: 0o700 });
    const filePath = checksPath(canonicalTag);
    const tempPath = `${filePath}.${process.pid}.tmp`;
    writeFileSync(
      tempPath,
      `${JSON.stringify({ ...readTagChecks(canonicalTag), ...hasMemories })}\n`,
      { mode: 0o600 },
    );
    renameSync(tempPath, filePath);
  } catch {}
}

export function getRecallTags(
  canonicalTag: string,
  readTags: string[],
): string[] {
  const checks = readTagChecks(canonicalTag);
  return readTags.filter(
    (tag) => tag === canonicalTag || checks[tag] !== false,
  );
}
