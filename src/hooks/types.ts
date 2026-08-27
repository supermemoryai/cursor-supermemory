export interface CursorHookInput {
  conversation_id?: string;
  generation_id?: string;
  hook_event_name?: string;
  prompt?: string;
  session_id?: string;
  status?: string;
  reason?: string;
  tool_name?: string;
  transcript_path?: string | null;
  workspace_roots?: string[];
}

export function workspaceRoot(input: CursorHookInput): string {
  return (
    input.workspace_roots?.[0] ||
    process.env.CURSOR_PROJECT_DIR ||
    process.cwd()
  );
}

export function conversationId(input: CursorHookInput): string {
  return input.conversation_id || input.session_id || "unknown";
}
