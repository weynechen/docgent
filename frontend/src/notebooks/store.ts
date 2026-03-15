import { create } from "zustand";
import { createStore } from "zustand/vanilla";

import { readPendingEdits } from "./indexedDb";
import type { NotebookItemRecord, NotebookRecord, NotebookStoreApi, NotebookSyncState } from "./types";
import { remoteNotebookStore } from "./remoteNotebookStore";
import { createNotebookSyncEngine } from "./syncEngine";

export interface NotebookStoreState {
  isLoading: boolean;
  notebooks: NotebookRecord[];
  activeNotebook?: NotebookRecord;
  activeItem?: NotebookItemRecord;
  syncState: NotebookSyncState;
  loadNotebooks: () => Promise<void>;
  createNotebook: () => Promise<void>;
  createItem: (type: "draft" | "note") => Promise<void>;
  setActiveNotebook: (notebookId: string) => void;
  setActiveItem: (itemId: string) => void;
  updateActiveItemContent: (content: string) => void;
  applyRemoteItem: (item: NotebookItemRecord) => void;
  flushActiveNotebook: () => Promise<void>;
}

function selectDefaultItem(notebook?: NotebookRecord) {
  return notebook?.items[0];
}

async function mergePendingEdits(notebooks: NotebookRecord[]): Promise<NotebookRecord[]> {
  const merged = await Promise.all(
    notebooks.map(async (notebook) => {
      const edits = await readPendingEdits(notebook.id);
      if (edits.length === 0) {
        return notebook;
      }

      return {
        ...notebook,
        items: notebook.items.map((item) => {
          const pending = edits.find((edit) => edit.itemId === item.id);
          if (!pending) {
            return item;
          }

          return {
            ...item,
            content: pending.content,
            isDirty: true,
          };
        }),
      };
    }),
  );

  return merged;
}

function createNotebookState(remoteStore: NotebookStoreApi) {
  return (
    set: (
      partial:
        | NotebookStoreState
        | Partial<NotebookStoreState>
        | ((state: NotebookStoreState) => NotebookStoreState | Partial<NotebookStoreState>),
    ) => void,
    get: () => NotebookStoreState,
  ): NotebookStoreState => {
    const syncEngine = createNotebookSyncEngine({
      remoteStore,
      onItemSaved: (item) => {
        get().applyRemoteItem(item);
      },
      onSyncStateChange: (syncState) => {
        set({ syncState });
      },
    });

    return {
      isLoading: false,
      notebooks: [],
      syncState: "saved",

      async loadNotebooks() {
        set({ isLoading: true });
        let notebooks = await remoteStore.listNotebooks();
        if (notebooks.length === 0) {
          const notebook = await remoteStore.createNotebook();
          notebooks = [notebook];
        }
        notebooks = await mergePendingEdits(notebooks);
        const activeNotebook = notebooks[0];
        set({
          isLoading: false,
          notebooks,
          activeNotebook,
          activeItem: selectDefaultItem(activeNotebook),
        });
        if (activeNotebook && window.navigator.onLine) {
          void syncEngine.flushPendingEdits(activeNotebook.id);
        }
      },

      async createNotebook() {
        const notebook = await remoteStore.createNotebook();
        set((state) => ({
          notebooks: [notebook, ...state.notebooks],
          activeNotebook: notebook,
          activeItem: selectDefaultItem(notebook),
        }));
      },

      async createItem(type) {
        const notebook = get().activeNotebook;
        if (!notebook) {
          return;
        }

        const item = await remoteStore.createItem({
          notebookId: notebook.id,
          type,
          title: type === "draft" ? "Untitled" : "Untitled note",
        });
        const updatedNotebook: NotebookRecord = {
          ...notebook,
          items: [...notebook.items, item],
        };

        set((state) => ({
          notebooks: state.notebooks.map((entry) => (entry.id === updatedNotebook.id ? updatedNotebook : entry)),
          activeNotebook: updatedNotebook,
          activeItem: item,
        }));
      },

      setActiveNotebook(notebookId) {
        const notebook = get().notebooks.find((entry) => entry.id === notebookId);
        if (!notebook) {
          return;
        }

        set({
          activeNotebook: notebook,
          activeItem: selectDefaultItem(notebook),
        });
      },

      setActiveItem(itemId) {
        const notebook = get().activeNotebook;
        if (!notebook) {
          return;
        }

        const item = notebook.items.find((entry) => entry.id === itemId);
        if (!item) {
          return;
        }

        set({
          activeItem: item,
        });
      },

      updateActiveItemContent(content) {
        const { activeItem, activeNotebook, notebooks } = get();
        if (!activeItem || !activeNotebook) {
          return;
        }

        const updatedItem: NotebookItemRecord = {
          ...activeItem,
          content,
          isDirty: true,
        };
        const updatedNotebook: NotebookRecord = {
          ...activeNotebook,
          items: activeNotebook.items.map((item) => (item.id === updatedItem.id ? updatedItem : item)),
        };

        set({
          syncState: "saving",
          activeItem: updatedItem,
          activeNotebook: updatedNotebook,
          notebooks: notebooks.map((notebook) => (notebook.id === updatedNotebook.id ? updatedNotebook : notebook)),
        });
        void syncEngine.queueItemSync(updatedItem);
      },

      applyRemoteItem(item) {
        const { activeNotebook, notebooks } = get();
        if (!activeNotebook) {
          return;
        }

        const updatedItem: NotebookItemRecord = {
          ...item,
          isDirty: false,
        };
        const updatedNotebook: NotebookRecord = {
          ...activeNotebook,
          items: activeNotebook.items.map((entry) => (entry.id === updatedItem.id ? updatedItem : entry)),
        };

        set({
          activeNotebook: updatedNotebook,
          activeItem: updatedItem,
          syncState: "saved",
          notebooks: notebooks.map((entry) => (entry.id === updatedNotebook.id ? updatedNotebook : entry)),
        });
      },

      async flushActiveNotebook() {
        const notebook = get().activeNotebook;
        if (!notebook) {
          return;
        }

        await syncEngine.flushPendingEdits(notebook.id);
      },
    };
  };
}

export function createNotebookStore(remoteStore: NotebookStoreApi) {
  return createStore<NotebookStoreState>(createNotebookState(remoteStore));
}

export const useNotebookStore = create<NotebookStoreState>()(createNotebookState(remoteNotebookStore));
