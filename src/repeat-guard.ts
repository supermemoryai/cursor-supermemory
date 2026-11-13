import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const MAX_ENTRIES = 500;
const RECALL_WINDOW_MS = 10 * 60_000;
const OPENING_WINDOW_MS = 24 * 60 * 60_000;
const MIN_OPENING_PROMPT_LENGTH = 200;

export interface AccountScope {
  backend: string;
  credential: string;
  containerTags: string[];
}

function guardDir(name: string): string {
  return join(homedir(), ".supermemory-cursor", name);
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function scopedKey(scope: AccountScope, text: string): string {
  return createHash("sha256")
    .update(
      [
        scope.backend,
        createHash("sha256").update(scope.credential).digest("hex"),
        [...new Set(scope.containerTags)].join(","),
        normalize(text),
      ].join("\n"),
    )
    .digest("hex");
}

function prune(dir: string, maxAgeMs: number): void {
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
      if (index >= MAX_ENTRIES || now - entry.mtime > maxAgeMs) {
        rmSync(join(dir, entry.name), { force: true });
      }
    });
}

function readFresh(file: string, maxAgeMs: number): string | null {
  try {
    if (Date.now() - statSync(file).mtimeMs > maxAgeMs) return null;
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

// Atomic write-then-rename; failures are swallowed so a guard never breaks a hook.
function record(dir: string, key: string, content: string, maxAgeMs: number): void {
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
    const tempPath = join(dir, `.${key}.${process.pid}.tmp`);
    writeFileSync(tempPath, content, { mode: 0o600 });
    chmodSync(tempPath, 0o600);
    renameSync(tempPath, join(dir, key));
    prune(dir, maxAgeMs);
  } catch {}
}

export function cachedRecall(scope: AccountScope, query: string): any[] | null {
  if (!scope.credential) return null;
  const cached = readFresh(join(guardDir("recall-queries"), scopedKey(scope, query)), RECALL_WINDOW_MS);
  try {
    const profiles = cached === null ? null : JSON.parse(cached);
    return Array.isArray(profiles) ? profiles : null;
  } catch {
    return null;
  }
}

export function cacheRecall(scope: AccountScope, query: string, profiles: any[]): void {
  if (!scope.credential) return;
  record(guardDir("recall-queries"), scopedKey(scope, query), JSON.stringify(profiles), RECALL_WINDOW_MS);
}

export function clearAccountCaches(): void {
  for (const name of ["recall-queries", "opening-prompts"]) {
    rmSync(guardDir(name), { recursive: true, force: true });
  }
}

export function wasOpeningPromptCaptured(scope: AccountScope, prompt: string): boolean {
  return (
    !!scope.credential &&
    normalize(prompt).length >= MIN_OPENING_PROMPT_LENGTH &&
    readFresh(join(guardDir("opening-prompts"), scopedKey(scope, prompt)), OPENING_WINDOW_MS) !== null
  );
}

export function recordOpeningPrompt(scope: AccountScope, prompt: string): void {
  if (!scope.credential || normalize(prompt).length < MIN_OPENING_PROMPT_LENGTH) return;
  record(guardDir("opening-prompts"), scopedKey(scope, prompt), "", OPENING_WINDOW_MS);
}

export function openingPromptMarker(scope: AccountScope, prompt: string): string {
  return `[opening prompt already captured from this machine, sha256:${scopedKey(scope, prompt).slice(0, 16)}]`;
}
