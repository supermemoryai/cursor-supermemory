export interface CursorHookInput {
  conversation_id?: string;
  generation_id?: string;
  hook_event_name?: string;
  is_background_agent?: boolean;
  mcp_server_name?: string;
  parent_conversation_id?: string;
  parent_tool_call_id?: string;
  prompt?: string;
  session_id?: string;
  status?: string;
  reason?: string;
  subagentType?: string;
  subagent_type?: string;
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
