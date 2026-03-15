export interface DocFile {
  path: string;
  name: string;
  content: string;
  revision: number;
  isDirty: boolean;
  lastSavedAt?: number;
}

export interface SelectionContext {
  start: number;
  end: number;
  text: string;
  docPath?: string;
  itemId?: string;
}

export interface EditRequest {
  sessionId: string;
  docPath: string;
  selectionStart: number;
  selectionEnd: number;
  instruction: string;
}

export interface AgentChatRequest {
  sessionId?: string;
  docPath?: string;
  notebookId?: string;
  itemId?: string;
  message: string;
  history: AgentChatHistoryMessage[];
  conversationId?: string;
  selection?: SelectionContext;
}

export interface AgentChatHistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: "streaming" | "complete" | "error";
  createdAt: number;
}

export interface AgentToolEvent {
  id: string;
  toolCallId: string;
  toolName: string;
  argsSummary: string;
  resultSummary?: string;
  status: "running" | "complete";
}

export interface ProposedEdit {
  docPath: string;
  beforeMarkdown: string;
  afterMarkdown: string;
  selectionStart: number;
  selectionEnd: number;
  baseRevision: number;
  changeSummary: string;
}

export interface EditSuggestion {
  id: string;
  explanation?: string;
  createdAt: number;
  instruction: string;
  provider?: string;
  model?: string;
  proposedEdits: ProposedEdit[];
  statusTrail?: RewriteStatus[];
}

export interface AppliedChange {
  suggestionId: string;
  docPath: string;
  originalText: string;
  appliedText: string;
  appliedAt: number;
}

export interface VersionSnapshot {
  id: string;
  docPath: string;
  title?: string;
  content: string;
  createdAt: number;
  source: "manual" | "ai";
}

export interface WorkspaceTreeEntry {
  path: string;
  name: string;
  nodeType: "file" | "directory";
}

export type RewriteStatus = "collecting_context" | "rewriting" | "finalizing";

export interface RewriteStatusEvent {
  type: "status";
  runId: string;
  status: RewriteStatus;
  message: string;
  createdAt: number;
}

export interface RewriteResultEvent {
  type: "result";
  runId: string;
  suggestion: EditSuggestion;
  createdAt: number;
}

export interface RewriteErrorEvent {
  type: "error";
  runId: string;
  code: string;
  message: string;
  createdAt: number;
}

export interface RewriteDoneEvent {
  type: "done";
  runId: string;
  createdAt: number;
}

export type RewriteStreamEvent =
  | RewriteStatusEvent
  | RewriteResultEvent
  | RewriteErrorEvent
  | RewriteDoneEvent;

export interface AgentConversationCreatedEvent {
  type: "conversation_created";
  data: {
    conversation_id: string;
  };
}

export interface AgentUserPromptEvent {
  type: "user_prompt";
  data: {
    content: string;
  };
}

export interface AgentModelRequestStartEvent {
  type: "model_request_start";
  data: Record<string, never>;
}

export interface AgentTextDeltaEvent {
  type: "text_delta";
  data: {
    content: string;
  };
}

export interface AgentToolCallEvent {
  type: "tool_call";
  data: {
    tool_name: string;
    args: Record<string, unknown>;
    tool_call_id: string;
  };
}

export interface AgentToolResultEvent {
  type: "tool_result";
  data: {
    tool_call_id: string;
    content: string;
    raw_content?: string;
  };
}

export interface AgentWorkspaceFileUpdatedEvent {
  type: "workspace_file_updated";
  data: {
    doc_path: string;
    revision: number;
    content: string;
    last_saved_at: number;
  };
}

export interface AgentNotebookItemUpdatedEvent {
  type: "notebook_item_updated";
  data: {
    item_id: string;
    notebook_id: string;
    revision: number;
    content: string;
    title: string;
    item_type: "draft" | "note";
    content_format: "markdown";
    order_index: number;
  };
}

export interface AgentFinalResultEvent {
  type: "final_result";
  data: {
    output: string;
  };
}

export interface AgentCompleteEvent {
  type: "complete";
  data: {
    conversation_id?: string;
  };
}

export interface AgentErrorEvent {
  type: "error";
  data: {
    message: string;
  };
}

export type AgentSocketEvent =
  | AgentConversationCreatedEvent
  | AgentUserPromptEvent
  | AgentModelRequestStartEvent
  | AgentTextDeltaEvent
  | AgentToolCallEvent
  | AgentToolResultEvent
  | AgentWorkspaceFileUpdatedEvent
  | AgentNotebookItemUpdatedEvent
  | AgentFinalResultEvent
  | AgentCompleteEvent
  | AgentErrorEvent;
