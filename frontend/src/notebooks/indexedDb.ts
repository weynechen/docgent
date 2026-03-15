export interface PendingEditRecord {
  notebookId: string;
  itemId: string;
  content: string;
  baseRevision: number;
  updatedAt: number;
}

const DB_NAME = "docgent-notebooks";
const DB_VERSION = 1;
const PENDING_EDIT_STORE = "pending_edits";

function openNotebookDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error("Failed to open notebook database."));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PENDING_EDIT_STORE)) {
        const store = db.createObjectStore(PENDING_EDIT_STORE, {
          keyPath: ["notebookId", "itemId"],
        });
        store.createIndex("by_notebook", "notebookId", { unique: false });
      }
    };
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore, resolve: (value: T) => void, reject: (error?: unknown) => void) => void,
): Promise<T> {
  return openNotebookDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(PENDING_EDIT_STORE, mode);
        const store = transaction.objectStore(PENDING_EDIT_STORE);
        runner(store, resolve, reject);
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => reject(transaction.error ?? new Error("Notebook transaction failed."));
      }),
  );
}

export async function writePendingEdit(edit: PendingEditRecord): Promise<void> {
  await withStore<void>("readwrite", (store, resolve, reject) => {
    const request = store.put(edit);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function readPendingEdits(notebookId: string): Promise<PendingEditRecord[]> {
  return withStore<PendingEditRecord[]>("readonly", (store, resolve, reject) => {
    const index = store.index("by_notebook");
    const request = index.getAll(notebookId);
    request.onsuccess = () => resolve((request.result as PendingEditRecord[]) ?? []);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePendingEdit(notebookId: string, itemId: string): Promise<void> {
  await withStore<void>("readwrite", (store, resolve, reject) => {
    const request = store.delete([notebookId, itemId]);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearNotebookPersistence(): Promise<void> {
  await withStore<void>("readwrite", (store, resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
