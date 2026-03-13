export interface DocFile {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  lastSavedAt?: number;
}

export interface SelectionContext {
  from: number;
  to: number;
  text: string;
  docPath: string;
  beforeText?: string;
  afterText?: string;
}

export interface EditRequest {
  docPath: string;
  selectedText: string;
  instruction: string;
  documentTitle?: string;
  beforeText?: string;
  afterText?: string;
  targetPlatform?: string;
}

export interface EditSuggestion {
  id: string;
  suggestedText: string;
  explanation?: string;
  createdAt: number;
  instruction: string;
  provider?: string;
  model?: string;
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
