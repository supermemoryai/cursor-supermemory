import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const MAX_ENTRIES = 500;
const RECALL_WINDOW_MS = 10 * 60_000;

function guardDir(name: string): string {
  return join(homedir(), ".supermemory-cursor", name);
}

function textKey(containerTag: string, text: string): string {
  return createHash("sha256")
    .update(`${containerTag}\n${text.trim().replace(/\s+/g, " ")}`)
    .digest("hex");
}

function prune(dir: string, maxAgeMs?: number): void {
  const now = Date.now();
  readdirSync(dir)
    .flatMap((name) => {
      try {
        return [{ name, mtime: statSync(join(dir, name)).mtimeMs }];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.mtime - a.mtime)
    .forEach((entry, index) => {
      if (index >= MAX_ENTRIES || (maxAgeMs !== undefined && now - entry.mtime > maxAgeMs)) {
        rmSync(join(dir, entry.name), { force: true });
      }
    });
}

// O_EXCL file creation makes one process win when parallel workers race on the same key; failures fail open.
function claim(dir: string, key: string, maxAgeMs?: number): boolean {
  const file = join(dir, key);
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(file, "", { flag: "wx", mode: 0o600 });
    prune(dir, maxAgeMs);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") return true;
  }
  try {
    if (maxAgeMs === undefined || Date.now() - statSync(file).mtimeMs < maxAgeMs) {
      return false;
    }
    writeFileSync(file, "", { mode: 0o600 });
  } catch {}
  return true;
}

export function claimRecallQuery(containerTag: string, query: string): boolean {
  return claim(guardDir("recall-queries"), textKey(containerTag, query), RECALL_WINDOW_MS);
}

export function releaseRecallQuery(containerTag: string, query: string): void {
  rmSync(join(guardDir("recall-queries"), textKey(containerTag, query)), { force: true });
}

export function claimOpeningPrompt(containerTag: string, prompt: string): boolean {
  return claim(guardDir("opening-prompts"), textKey(containerTag, prompt));
}

export function releaseOpeningPrompt(containerTag: string, prompt: string): void {
  rmSync(join(guardDir("opening-prompts"), textKey(containerTag, prompt)), { force: true });
}

export function openingPromptMarker(containerTag: string, prompt: string): string {
  return `[opening prompt already captured from this machine, sha256:${textKey(containerTag, prompt).slice(0, 16)}]`;
}
