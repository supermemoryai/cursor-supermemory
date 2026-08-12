export type AgentScope = "personal" | "project";

interface MemoryMetadataInput {
  project: string;
  projectId: string;
  timestamp: string;
}

export function explicitMemoryMetadata(
  input: MemoryMetadataInput & { scope: AgentScope | null },
) {
  return {
    type: "memory",
    project: input.project,
    sm_project_id: input.projectId,
    ...(input.scope ? { agent_scope: input.scope } : {}),
    sm_capture_mode: "explicit",
    timestamp: input.timestamp,
  };
}

export function sessionEndMemoryMetadata(
  input: MemoryMetadataInput & { sessionId: string },
) {
  return {
    type: "conversation",
    project: input.project,
    sm_project_id: input.projectId,
    agent_scope: "personal" as const,
    sm_capture_mode: "session_end",
    sessionId: input.sessionId,
    timestamp: input.timestamp,
  };
}
