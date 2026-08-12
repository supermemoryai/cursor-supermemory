import { expect, test } from "bun:test";
import {
  explicitMemoryMetadata,
  sessionEndMemoryMetadata,
} from "./metadata.ts";

const timestamp = "2026-08-12T00:00:00.000Z";

test("MCP explicit personal and project writes use agent_scope only", () => {
  const common = {
    project: "cursor-supermemory",
    projectId: "0123456789abcdef",
    timestamp,
  };

  for (const scope of ["personal", "project"] as const) {
    const metadata = explicitMemoryMetadata({ ...common, scope });

    expect(metadata).toMatchObject({
      type: "memory",
      sm_project_id: common.projectId,
      agent_scope: scope,
      sm_capture_mode: "explicit",
    });
    expect(metadata).not.toHaveProperty("sm_scope");
  }
});

test("session-end writes use personal agent_scope only", () => {
  const metadata = sessionEndMemoryMetadata({
    project: "cursor-supermemory",
    projectId: "0123456789abcdef",
    sessionId: "session-123",
    timestamp,
  });

  expect(metadata).toMatchObject({
    type: "conversation",
    agent_scope: "personal",
    sm_capture_mode: "session_end",
    sessionId: "session-123",
  });
  expect(metadata).not.toHaveProperty("sm_scope");
});
