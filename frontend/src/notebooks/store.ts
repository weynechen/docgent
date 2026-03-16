import { create } from "zustand";
import { createStore } from "zustand/vanilla";

import { startAgentChatRun } from "../ai/provider";
import type {
  AgentChatHistoryMessage,
  AgentChatMessage,
  AgentToolEvent,
  SelectionContext,
} from "../shared/types";
import { deletePendingEdit, readPendingEdits } from "./indexedDb";
import type {
  NotebookItemRecord,
  NotebookRecord,
  NotebookSourceRecord,
  NotebookStoreApi,
  NotebookSyncState,
} from "./types";
import { remoteNotebookStore } from "./remoteNotebookStore";
import { createNotebookSyncEngine } from "./syncEngine";

type AgentRunState = "idle" | "running" | "complete" | "error";

interface NotebookAiClient {
  startAgentChatRun: typeof startAgentChatRun;
}

export interface NotebookConflictState {
  notebookId: string;
  itemId: string;
  title: string;
  content: string;
  baseRevision: number;
}

export interface NotebookStoreState {
  isLoading: boolean;
  notebooks: NotebookRecord[];
  activeNotebook?: NotebookRecord;
  activeItem?: NotebookItemRecord;
  activeConflict?: NotebookConflictState;
  syncState: NotebookSyncState;
  selection?: SelectionContext;
  chatMessages: AgentChatMessage[];
  toolEvents: AgentToolEvent[];
  conversationId?: string;
  agentRunState: AgentRunState;
  isGenerating: boolean;
  loadNotebooks: () => Promise<void>;
  createNotebook: () => Promise<void>;
  renameNotebook: (notebookId: string, title: string) => Promise<void>;
  createItem: (type: "draft" | "note") => Promise<void>;
  renameItem: (itemId: string, title: string) => Promise<void>;
  createSource: (input: {
    type: "external_link" | "imported_file";
    title: string;
    sourceUrl?: string;
    mimeType?: string;
  }) => Promise<void>;
  setActiveNotebook: (notebookId: string) => void;
  setActiveItem: (itemId: string) => void;
  updateActiveItemContent: (content: string) => void;
  setSelection: (selection?: SelectionContext) => void;
  applyRemoteItem: (item: NotebookItemRecord) => void;
  flushActiveNotebook: () => Promise<void>;
  reloadConflictedItem: () => Promise<void>;
  keepLocalAsNewCopy: () => Promise<void>;
  sendChatMessage: (message: string) => Promise<void>;
}

function selectDefaultItem(notebook?: NotebookRecord) {
  return notebook?.items[0];
}

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function summarizeArgs(args: Record<string, unknown>) {
  const entries = Object.entries(args);
  if (entries.length === 0) {
    return "";
  }
  return entries
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(", ")
    .slice(0, 240);
}

function toHistory(messages: AgentChatMessage[]): AgentChatHistoryMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant" || message.role === "system")
    .filter((message) => message.status !== "error")
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function resetChatState() {
  return {
    selection: undefined,
    chatMessages: [],
    toolEvents: [],
    conversationId: undefined,
    agentRunState: "idle" as const,
    isGenerating: false,
  };
}

function buildRecoveredTitle(title: string) {
  return `${title} (Recovered)`;
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

function createNotebookState(remoteStore: NotebookStoreApi, aiClient: NotebookAiClient) {
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
      onConflict: (edit) => {
        const notebook = get().notebooks.find((entry) => entry.id === edit.notebookId);
        const item = notebook?.items.find((entry) => entry.id === edit.itemId);
        set({
          activeConflict: {
            notebookId: edit.notebookId,
            itemId: edit.itemId,
            title: item?.title ?? "Untitled",
            content: edit.content,
            baseRevision: edit.baseRevision,
          },
        });
      },
      onSyncStateChange: (syncState) => {
        set({ syncState });
      },
    });
    let activeChatStream: (() => void) | undefined;
    let pendingQueueWrite: Promise<void> | undefined;
    let loadNotebooksPromise: Promise<void> | undefined;

    const closeActiveChatStream = () => {
      activeChatStream?.();
      activeChatStream = undefined;
    };

    const mergeNotebook = (incomingNotebook: NotebookRecord, activeItemId?: string) => {
      const current = get();
      return {
        notebooks: current.notebooks.map((entry) => (entry.id === incomingNotebook.id ? incomingNotebook : entry)),
        activeNotebook: current.activeNotebook?.id === incomingNotebook.id ? incomingNotebook : current.activeNotebook,
        activeItem:
          current.activeNotebook?.id === incomingNotebook.id
            ? incomingNotebook.items.find((entry) => entry.id === activeItemId) ?? selectDefaultItem(incomingNotebook)
            : current.activeItem,
      };
    };

    const mergeSource = (source: NotebookSourceRecord) => {
      const current = get();
      const notebook = current.notebooks.find((entry) => entry.id === source.notebookId);
      if (!notebook) {
        return;
      }

      const updatedNotebook: NotebookRecord = {
        ...notebook,
        sources: [source, ...notebook.sources.filter((entry) => entry.id !== source.id)],
      };
      set({
        notebooks: current.notebooks.map((entry) => (entry.id === updatedNotebook.id ? updatedNotebook : entry)),
        activeNotebook: current.activeNotebook?.id === updatedNotebook.id ? updatedNotebook : current.activeNotebook,
      });
    };

    const loadNotebook = async (notebookId: string) => {
      return await remoteStore.getNotebook(notebookId);
    };

    return {
      isLoading: false,
      notebooks: [],
      syncState: "saved",
      chatMessages: [],
      toolEvents: [],
      agentRunState: "idle",
      isGenerating: false,

      async loadNotebooks() {
        if (loadNotebooksPromise) {
          await loadNotebooksPromise;
          return;
        }

        loadNotebooksPromise = (async () => {
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
            ...resetChatState(),
          });
          if (activeNotebook && window.navigator.onLine) {
            void syncEngine.flushPendingEdits(activeNotebook.id);
          }
        })();

        try {
          await loadNotebooksPromise;
        } finally {
          loadNotebooksPromise = undefined;
        }
      },

      async createNotebook() {
        closeActiveChatStream();
        const notebook = await remoteStore.createNotebook();
        set((state) => ({
          notebooks: [notebook, ...state.notebooks],
          activeNotebook: notebook,
          activeItem: selectDefaultItem(notebook),
          ...resetChatState(),
        }));
      },

      async renameNotebook(notebookId, title) {
        const nextTitle = title.trim();
        if (!nextTitle) {
          return;
        }

        closeActiveChatStream();
        const current = get();
        const renamedNotebook = await remoteStore.updateNotebook({
          notebookId,
          title: nextTitle,
        });
        const activeItemId =
          current.activeNotebook?.id === renamedNotebook.id ? current.activeItem?.id ?? selectDefaultItem(renamedNotebook)?.id : undefined;
        const merged = mergeNotebook(renamedNotebook, activeItemId);
        set(merged);
      },

      async createItem(type) {
        const notebook = get().activeNotebook;
        if (!notebook) {
          return;
        }

        closeActiveChatStream();
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
          ...resetChatState(),
        }));
      },

      async renameItem(itemId, title) {
        const nextTitle = title.trim();
        if (!nextTitle) {
          return;
        }

        const current = get();
        const activeNotebook = current.activeNotebook;
        if (!activeNotebook) {
          return;
        }

        const item = activeNotebook.items.find((entry) => entry.id === itemId);
        if (!item) {
          return;
        }

        closeActiveChatStream();
        const updatedItem = await remoteStore.updateItem({
          itemId,
          title: nextTitle,
          baseRevision: item.serverRevision,
        });
        const mergedItem: NotebookItemRecord = item.isDirty
          ? {
              ...item,
              title: updatedItem.title,
            }
          : updatedItem;
        const updatedNotebook: NotebookRecord = {
          ...activeNotebook,
          items: activeNotebook.items.map((entry) => (entry.id === mergedItem.id ? mergedItem : entry)),
        };
        set((state) => ({
          notebooks: state.notebooks.map((entry) => (entry.id === updatedNotebook.id ? updatedNotebook : entry)),
          activeNotebook: state.activeNotebook?.id === updatedNotebook.id ? updatedNotebook : state.activeNotebook,
          activeItem: state.activeItem?.id === mergedItem.id ? mergedItem : state.activeItem,
        }));
      },

      async createSource(input) {
        const notebook = get().activeNotebook;
        if (!notebook) {
          return;
        }

        const source = await remoteStore.createSource({
          notebookId: notebook.id,
          type: input.type,
          title: input.title,
          sourceUrl: input.sourceUrl,
          mimeType: input.mimeType,
        });
        mergeSource(source);
      },

      setActiveNotebook(notebookId) {
        closeActiveChatStream();
        const notebook = get().notebooks.find((entry) => entry.id === notebookId);
        if (!notebook) {
          return;
        }

        set({
          activeNotebook: notebook,
          activeItem: selectDefaultItem(notebook),
          ...resetChatState(),
        });
      },

      setActiveItem(itemId) {
        closeActiveChatStream();
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
          ...resetChatState(),
        });
      },

      updateActiveItemContent(content) {
        const { activeItem, activeNotebook, notebooks, activeConflict } = get();
        if (!activeItem || !activeNotebook) {
          return;
        }
        if (activeConflict?.itemId === activeItem.id) {
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
        pendingQueueWrite = syncEngine.queueItemSync(updatedItem);
        void pendingQueueWrite;
      },

      setSelection(selection) {
        set({ selection });
      },

      applyRemoteItem(item) {
        const { activeNotebook, activeItem, notebooks } = get();
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
          activeItem: activeItem?.id === updatedItem.id ? updatedItem : activeItem,
          syncState: "saved",
          notebooks: notebooks.map((entry) => (entry.id === updatedNotebook.id ? updatedNotebook : entry)),
        });
      },

      async flushActiveNotebook() {
        const notebook = get().activeNotebook;
        if (!notebook) {
          return;
        }

        if (pendingQueueWrite) {
          await pendingQueueWrite;
        }
        await syncEngine.flushPendingEdits(notebook.id);
      },

      async reloadConflictedItem() {
        const conflict = get().activeConflict;
        if (!conflict) {
          return;
        }

        const notebook = await loadNotebook(conflict.notebookId);
        await deletePendingEdit(conflict.notebookId, conflict.itemId);
        const merged = mergeNotebook(notebook, conflict.itemId);
        set({
          ...merged,
          activeConflict: undefined,
          syncState: "saved",
          ...resetChatState(),
        });
      },

      async keepLocalAsNewCopy() {
        const conflict = get().activeConflict;
        if (!conflict) {
          return;
        }

        const createdItem = await remoteStore.createItem({
          notebookId: conflict.notebookId,
          type: "draft",
          title: buildRecoveredTitle(conflict.title),
          content: conflict.content,
        });
        await deletePendingEdit(conflict.notebookId, conflict.itemId);
        const notebook = await loadNotebook(conflict.notebookId);
        const mergedNotebook = notebook.items.some((item) => item.id === createdItem.id)
          ? notebook
          : {
              ...notebook,
              items: [...notebook.items, createdItem],
            };
        const merged = mergeNotebook(mergedNotebook, createdItem.id);
        set({
          ...merged,
          activeConflict: undefined,
          syncState: "saved",
          ...resetChatState(),
        });
      },

      async sendChatMessage(message) {
        const { activeNotebook, activeItem, activeConflict, conversationId, chatMessages, isGenerating, selection } = get();
        const trimmed = message.trim();
        if (!activeNotebook || !activeItem || !trimmed || isGenerating) {
          return;
        }
        if (activeConflict?.itemId === activeItem.id) {
          return;
        }

        closeActiveChatStream();

        const userMessage: AgentChatMessage = {
          id: createMessageId("user"),
          role: "user",
          content: trimmed,
          status: "complete",
          createdAt: Date.now(),
        };
        const assistantMessageId = createMessageId("assistant");
        const assistantMessage: AgentChatMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          status: "streaming",
          createdAt: Date.now(),
        };

        set((state) => ({
          chatMessages: [...state.chatMessages, userMessage, assistantMessage],
          toolEvents: [],
          isGenerating: true,
          agentRunState: "running",
        }));

        if (pendingQueueWrite) {
          await pendingQueueWrite;
        }
        if (get().syncState === "saving" || get().activeItem?.isDirty) {
          await syncEngine.flushPendingEdits(activeNotebook.id);
        }

        const syncedItem = get().activeItem;
        const syncState = get().syncState;
        if (
          !syncedItem ||
          syncedItem.isDirty ||
          syncState === "offline" ||
          syncState === "sync_failed" ||
          syncState === "conflict"
        ) {
          set((state) => ({
            chatMessages: state.chatMessages.map((item) =>
              item.id === assistantMessageId
                ? {
                    ...item,
                    status: "error",
                    content: "Sync the current notebook item before starting AI collaboration.",
                  }
                : item,
            ),
            isGenerating: false,
            agentRunState: "error",
          }));
          return;
        }

        try {
          const stream = await aiClient.startAgentChatRun(
            {
              notebookId: activeNotebook.id,
              itemId: syncedItem.id,
              message: trimmed,
              history: toHistory([...chatMessages, userMessage]),
              conversationId,
              selection,
            },
            {
              onConversationCreated: (event) => {
                set({ conversationId: event.data.conversation_id });
              },
              onTextDelta: (event) => {
                set((state) => ({
                  chatMessages: state.chatMessages.map((item) =>
                    item.id === assistantMessageId
                      ? { ...item, content: item.content + event.data.content }
                      : item,
                  ),
                }));
              },
              onToolCall: (event) => {
                set((state) => ({
                  toolEvents: [
                    ...state.toolEvents,
                    {
                      id: createMessageId("tool"),
                      toolCallId: event.data.tool_call_id,
                      toolName: event.data.tool_name,
                      argsSummary: summarizeArgs(event.data.args),
                      status: "running",
                    },
                  ],
                }));
              },
              onToolResult: (event) => {
                set((state) => ({
                  toolEvents: state.toolEvents.map((item) =>
                    item.toolCallId === event.data.tool_call_id
                      ? { ...item, status: "complete", resultSummary: event.data.content }
                      : item,
                  ),
                }));
              },
              onNotebookItemUpdated: (event) => {
                get().applyRemoteItem({
                  id: event.data.item_id,
                  notebookId: event.data.notebook_id,
                  type: event.data.item_type,
                  title: event.data.title,
                  content: event.data.content,
                  contentFormat: event.data.content_format,
                  orderIndex: event.data.order_index,
                  serverRevision: event.data.revision,
                  isDirty: false,
                });
              },
              onFinalResult: (event) => {
                set((state) => ({
                  chatMessages: state.chatMessages.map((item) =>
                    item.id === assistantMessageId && !item.content
                      ? { ...item, content: event.data.output }
                      : item,
                  ),
                }));
              },
              onComplete: (event) => {
                closeActiveChatStream();
                set((state) => ({
                  conversationId: event.data.conversation_id ?? state.conversationId,
                  chatMessages: state.chatMessages.map((item) =>
                    item.id === assistantMessageId
                      ? {
                          ...item,
                          status: "complete",
                          content: item.content || "Completed.",
                        }
                      : item,
                  ),
                  isGenerating: false,
                  agentRunState: "complete",
                }));
              },
              onError: (event) => {
                closeActiveChatStream();
                set((state) => ({
                  chatMessages: state.chatMessages.map((item) =>
                    item.id === assistantMessageId
                      ? {
                          ...item,
                          status: "error",
                          content: item.content || event.data.message,
                        }
                      : item,
                  ),
                  isGenerating: false,
                  agentRunState: "error",
                }));
              },
            },
          );

          activeChatStream = stream.close;
        } catch (error) {
          set((state) => ({
            chatMessages: state.chatMessages.map((item) =>
              item.id === assistantMessageId
                ? {
                    ...item,
                    status: "error",
                    content: error instanceof Error ? error.message : "AI chat failed. Please retry.",
                  }
                : item,
            ),
            isGenerating: false,
            agentRunState: "error",
          }));
        }
      },
    };
  };
}

export function createNotebookStore(
  remoteStore: NotebookStoreApi,
  aiClient: NotebookAiClient = { startAgentChatRun },
) {
  return createStore<NotebookStoreState>(createNotebookState(remoteStore, aiClient));
}

export const useNotebookStore = create<NotebookStoreState>()(
  createNotebookState(remoteNotebookStore, { startAgentChatRun }),
);
