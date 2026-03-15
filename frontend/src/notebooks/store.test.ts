import { describe, expect, it, vi } from "vitest";

import { createNotebookStore } from "./store";
import type { NotebookRecord, NotebookStoreApi } from "./types";

function makeNotebook(id: string, itemId: string): NotebookRecord {
  return {
    id,
    title: "Untitled notebook",
    createdAt: "2026-03-14T00:00:00.000Z",
    updatedAt: "2026-03-14T00:00:00.000Z",
    items: [
      {
        id: itemId,
        notebookId: id,
        type: "draft",
        title: "Untitled",
        content: "",
        contentFormat: "markdown",
        orderIndex: 0,
        serverRevision: 1,
        isDirty: false,
      },
    ],
  };
}

describe("notebook store", () => {
  it("creates a notebook and opens the seeded draft", async () => {
    const notebook = makeNotebook("nb-1", "item-1");
    const remoteStore: NotebookStoreApi = {
      listNotebooks: async () => [],
      createNotebook: async () => notebook,
      createItem: async () => notebook.items[0],
      updateItem: async () => notebook.items[0],
    };

    const store = createNotebookStore(remoteStore);

    await store.getState().createNotebook();

    expect(store.getState().activeNotebook?.title).toBe("Untitled notebook");
    expect(store.getState().activeItem?.type).toBe("draft");
  });

  it("switches the active item within the current notebook", async () => {
    const notebook = {
      ...makeNotebook("nb-1", "item-1"),
      items: [
        makeNotebook("nb-1", "item-1").items[0],
        {
          id: "item-2",
          notebookId: "nb-1",
          type: "note" as const,
          title: "Excerpt",
          content: "quoted text",
          contentFormat: "markdown" as const,
          orderIndex: 1,
          serverRevision: 1,
          isDirty: false,
        },
      ],
    };
    const remoteStore: NotebookStoreApi = {
      listNotebooks: async () => [notebook],
      createNotebook: async () => notebook,
      createItem: async () => notebook.items[0],
      updateItem: async () => notebook.items[0],
    };

    const store = createNotebookStore(remoteStore);
    await store.getState().loadNotebooks();
    store.getState().setActiveItem("item-2");

    expect(store.getState().activeItem?.id).toBe("item-2");
    expect(store.getState().activeItem?.type).toBe("note");
  });

  it("marks the active item dirty when content changes", async () => {
    const notebook = makeNotebook("nb-1", "item-1");
    const remoteStore: NotebookStoreApi = {
      listNotebooks: async () => [notebook],
      createNotebook: async () => notebook,
      createItem: async () => notebook.items[0],
      updateItem: async () => notebook.items[0],
    };

    const store = createNotebookStore(remoteStore);
    await store.getState().loadNotebooks();
    store.getState().updateActiveItemContent("# Draft");

    expect(store.getState().activeItem?.content).toBe("# Draft");
    expect(store.getState().activeItem?.isDirty).toBe(true);
  });

  it("sends chat with notebook context and applies AI item updates", async () => {
    const notebook = makeNotebook("nb-1", "item-1");
    const remoteStore: NotebookStoreApi = {
      listNotebooks: async () => [notebook],
      createNotebook: async () => notebook,
      createItem: async () => notebook.items[0],
      updateItem: async () => ({
        ...notebook.items[0],
        content: "# Draft synced",
        serverRevision: 2,
        isDirty: false,
      }),
    };
    const startAgentChatRun = vi.fn(async (_input, handlers) => {
      handlers.onConversationCreated?.({
        type: "conversation_created",
        data: { conversation_id: "conv-1" },
      });
      handlers.onTextDelta?.({
        type: "text_delta",
        data: { content: "I updated the draft." },
      });
      handlers.onNotebookItemUpdated?.({
        type: "notebook_item_updated",
        data: {
          item_id: "item-1",
          notebook_id: "nb-1",
          revision: 3,
          content: "# Draft updated by AI",
          title: "Untitled",
          item_type: "draft",
          content_format: "markdown",
          order_index: 0,
        },
      });
      handlers.onComplete?.({
        type: "complete",
        data: { conversation_id: "conv-1" },
      });
      return { close: () => undefined };
    });

    const store = createNotebookStore(remoteStore, { startAgentChatRun });
    await store.getState().loadNotebooks();
    store.getState().updateActiveItemContent("# Draft pending");
    await store.getState().sendChatMessage("Polish this draft.");

    expect(startAgentChatRun).toHaveBeenCalledWith(
      expect.objectContaining({
        notebookId: "nb-1",
        itemId: "item-1",
        message: "Polish this draft.",
      }),
      expect.any(Object),
    );
    expect(store.getState().conversationId).toBe("conv-1");
    expect(store.getState().activeItem?.content).toBe("# Draft updated by AI");
    expect(store.getState().activeItem?.serverRevision).toBe(3);
    const latestMessage = store.getState().chatMessages[store.getState().chatMessages.length - 1];
    expect(latestMessage?.content).toContain("I updated the draft.");
  });
});
