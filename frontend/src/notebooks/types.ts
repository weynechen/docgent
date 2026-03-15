export type NotebookSyncState = "saving" | "saved" | "offline" | "sync_failed" | "conflict";
export type NotebookItemType = "draft" | "note";
export type NotebookSourceType = "external_link" | "imported_file";

export interface NotebookItemRecord {
  id: string;
  notebookId: string;
  type: NotebookItemType;
  title: string;
  content: string;
  contentFormat: "markdown";
  orderIndex: number;
  serverRevision: number;
  isDirty: boolean;
}

export interface NotebookRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string | null;
  sources: NotebookSourceRecord[];
  items: NotebookItemRecord[];
}

export interface NotebookSourceRecord {
  id: string;
  notebookId: string;
  type: NotebookSourceType;
  title: string;
  sourceUrl: string | null;
  mimeType: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface NotebookUiState {
  syncState: NotebookSyncState;
}

export interface NotebookStoreApi {
  listNotebooks(): Promise<NotebookRecord[]>;
  getNotebook(notebookId: string): Promise<NotebookRecord>;
  createNotebook(): Promise<NotebookRecord>;
  createItem(input: { notebookId: string; type: NotebookItemType; title: string; content?: string }): Promise<NotebookItemRecord>;
  createSource(input: {
    notebookId: string;
    type: NotebookSourceType;
    title: string;
    sourceUrl?: string;
    mimeType?: string;
  }): Promise<NotebookSourceRecord>;
  updateItem(input: { itemId: string; title?: string; content?: string; baseRevision: number }): Promise<NotebookItemRecord>;
}

export const emptyNotebookState: NotebookUiState = {
  syncState: "saved",
};
