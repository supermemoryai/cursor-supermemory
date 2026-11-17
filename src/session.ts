import { createHash } from "node:crypto";
import {
  closeSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HEAD_BYTES = 4096;

interface SessionCursor {
  generation: number;
  headHash: string;
  offset: number;
}

export interface RawDelta {
  commit: () => void;
  generation: number;
  offset: number;
  raw: string;
}

function sessionDir(): string {
  return join(homedir(), ".supermemory-cursor", "session");
}

function cursorPath(sessionId: string): string {
  const id = createHash("sha256").update(sessionId).digest("hex").slice(0, 32);
  return join(sessionDir(), `${id}.json`);
}

function readCursor(sessionId: string): SessionCursor {
  try {
    const cursor = JSON.parse(readFileSync(cursorPath(sessionId), "utf8"));
    if (
      typeof cursor.offset === "number" &&
      typeof cursor.generation === "number"
    ) {
      return {
        generation: cursor.generation,
        headHash: typeof cursor.headHash === "string" ? cursor.headHash : "",
        offset: cursor.offset,
      };
    }
  } catch {}
  return { generation: 0, headHash: "", offset: 0 };
}

function writeCursor(sessionId: string, cursor: SessionCursor): void {
  mkdirSync(sessionDir(), { recursive: true, mode: 0o700 });
  const filePath = cursorPath(sessionId);
  const tempPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(cursor)}\n`, { mode: 0o600 });
  renameSync(tempPath, filePath);
}

function hashHead(fd: number, length: number): string {
  if (length <= 0) return "";
  const buffer = Buffer.alloc(length);
  readSync(fd, buffer, 0, length, 0);
  return createHash("sha256").update(buffer).digest("hex");
}

export function readRawDelta(
  transcriptPath: string,
  sessionId: string,
): RawDelta | null {
  const previous = readCursor(sessionId);
  const fd = openSync(transcriptPath, "r");
  try {
    const size = fstatSync(fd).size;
    const rewritten =
      size < previous.offset ||
      hashHead(fd, Math.min(HEAD_BYTES, previous.offset)) !== previous.headHash;
    const generation = previous.generation + (rewritten ? 1 : 0);
    const offset = rewritten ? 0 : previous.offset;
    if (size <= offset) return null;
    const buffer = Buffer.alloc(size - offset);
    readSync(fd, buffer, 0, buffer.length, offset);
    const end = buffer.lastIndexOf(0x0a) + 1;
    if (!end) return null;
    const next = {
      generation,
      headHash: hashHead(fd, Math.min(HEAD_BYTES, offset + end)),
      offset: offset + end,
    };
    return {
      commit: () => writeCursor(sessionId, next),
      generation,
      offset,
      raw: buffer.subarray(0, end).toString("utf8"),
    };
  } finally {
    closeSync(fd);
  }
}
