import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function readStdinText(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readStdinJson<T>(): Promise<T> {
  return JSON.parse(await readStdinText()) as T;
}

export function readTextFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

// Each host names the plugin's install path after itself: Cursor sets CURSOR_PLUGIN_ROOT,
// Claude Code and Grok set CLAUDE_PLUGIN_ROOT, and Grok also sets GROK_PLUGIN_ROOT. A value
// that still reads "${...}" means the host passed the token through without expanding it.
export function pluginRootFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return [env.CURSOR_PLUGIN_ROOT, env.CLAUDE_PLUGIN_ROOT, env.GROK_PLUGIN_ROOT].find(
    (value): value is string => !!value && !value.includes("${"),
  );
}

// Node realpaths the ESM entry but not argv[1]; compare resolved paths so a symlinked plugin dir still matches.
export function isMainModule(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return pathToFileURL(entry).href === metaUrl;
  }
}

export async function runHook<T>(
  handler: (input: T) => void | Promise<void>,
  fallback: Record<string, unknown> = { continue: true },
): Promise<void> {
  const write = process.stdout.write.bind(process.stdout);
  let answered = false;
  process.stdout.write = ((...args: Parameters<typeof write>) => {
    answered = true;
    return write(...args);
  }) as typeof process.stdout.write;
  try {
    await handler(await readStdinJson<T>());
  } catch (error) {
    if (process.env.SUPERMEMORY_DEBUG === "true") {
      console.error("[supermemory] hook failed:", error);
    }
    if (!answered) write(JSON.stringify(fallback));
  } finally {
    process.stdout.write = write;
  }
}
