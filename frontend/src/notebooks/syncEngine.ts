import { deletePendingEdit, readPendingEdits, type PendingEditRecord, writePendingEdit } from "./indexedDb";
import type { NotebookItemRecord, NotebookStoreApi, NotebookSyncState } from "./types";

interface NotebookSyncEngineOptions {
  remoteStore: NotebookStoreApi;
  onItemSaved: (item: NotebookItemRecord) => void;
  onConflict?: (edit: PendingEditRecord) => void;
  onSyncStateChange: (syncState: NotebookSyncState) => void;
  debounceMs?: number;
}

export function createNotebookSyncEngine({
  remoteStore,
  onItemSaved,
  onConflict,
  onSyncStateChange,
  debounceMs = 800,
}: NotebookSyncEngineOptions) {
  const timers = new Map<string, number>();

  function isRevisionConflict(error: unknown) {
    if (!(error instanceof Error)) {
      return false;
    }
    const errorWithCode = error as Error & { code?: string };
    return errorWithCode.code === "REVISION_CONFLICT" || error.message.includes("REVISION_CONFLICT");
  }

  async function flushPendingEdits(notebookId: string) {
    if (!window.navigator.onLine) {
      onSyncStateChange("offline");
      return;
    }

    const edits = await readPendingEdits(notebookId);
    for (const edit of edits) {
      try {
        const item = await remoteStore.updateItem({
          itemId: edit.itemId,
          content: edit.content,
          baseRevision: edit.baseRevision,
        });
        await deletePendingEdit(edit.notebookId, edit.itemId);
        onItemSaved(item);
        onSyncStateChange("saved");
      } catch (error) {
        if (isRevisionConflict(error)) {
          onConflict?.(edit);
          onSyncStateChange("conflict");
          return;
        }
        onSyncStateChange("sync_failed");
        return;
      }
    }
  }

  async function queueItemSync(item: NotebookItemRecord) {
    await writePendingEdit({
      notebookId: item.notebookId,
      itemId: item.id,
      content: item.content,
      baseRevision: item.serverRevision,
      updatedAt: Date.now(),
    });

    if (!window.navigator.onLine) {
      onSyncStateChange("offline");
      return;
    }

    onSyncStateChange("saving");
    const currentTimer = timers.get(item.notebookId);
    if (currentTimer) {
      window.clearTimeout(currentTimer);
    }

    const timerId = window.setTimeout(() => {
      void flushPendingEdits(item.notebookId);
    }, debounceMs);
    timers.set(item.notebookId, timerId);
  }

  return {
    queueItemSync,
    flushPendingEdits,
  };
}
