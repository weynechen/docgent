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
  docPath: string;
}

export interface EditRequest {
  sessionId: string;
  docPath: string;
  selectionStart: number;
  selectionEnd: number;
  instruction: string;
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
