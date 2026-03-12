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
