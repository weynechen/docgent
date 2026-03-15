export type NotebookSyncState = "saving" | "saved" | "offline" | "sync_failed" | "conflict";
export type NotebookItemType = "draft" | "note";

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
  updatedAt: string;
  items: NotebookItemRecord[];
}

export interface NotebookUiState {
  syncState: NotebookSyncState;
}

export interface NotebookStoreApi {
  listNotebooks(): Promise<NotebookRecord[]>;
  getNotebook(notebookId: string): Promise<NotebookRecord>;
  createNotebook(): Promise<NotebookRecord>;
  createItem(input: { notebookId: string; type: NotebookItemType; title: string; content?: string }): Promise<NotebookItemRecord>;
  updateItem(input: { itemId: string; title?: string; content?: string; baseRevision: number }): Promise<NotebookItemRecord>;
}

export const emptyNotebookState: NotebookUiState = {
  syncState: "saved",
};
