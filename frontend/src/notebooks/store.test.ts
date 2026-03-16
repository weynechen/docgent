import { describe, expect, it, vi } from "vitest";

import { readPendingEdits } from "./indexedDb";
import { createNotebookStore } from "./store";
import type { NotebookRecord, NotebookSourceRecord, NotebookStoreApi } from "./types";

function makeSource(notebookId: string, sourceId = "source-1"): NotebookSourceRecord {
  return {
    id: sourceId,
    notebookId,
    type: "external_link",
    title: "Reference link",
    sourceUrl: "https://example.com/reference",
    mimeType: null,
    createdAt: "2026-03-14T00:00:00.000Z",
    updatedAt: null,
  };
}

function makeNotebook(id: string, itemId: string): NotebookRecord {
  return {
    id,
    title: "Untitled notebook",
    createdAt: "2026-03-14T00:00:00.000Z",
    updatedAt: "2026-03-14T00:00:00.000Z",
    sources: [],
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

type RemoteStoreWithRename = NotebookStoreApi & {
  updateNotebook(input: { notebookId: string; title: string }): Promise<NotebookRecord>;
};

type StoreStateWithRename = ReturnType<ReturnType<typeof createNotebookStore>["getState"]> & {
  enterNotebook(notebookId: string): void;
  exitNotebookDetail(): void;
  renameNotebook(notebookId: string, title: string): Promise<void>;
  renameItem(itemId: string, title: string): Promise<void>;
};

function updateNotebookResult(notebook: NotebookRecord, title = notebook.title): NotebookRecord {
  return {
    ...notebook,
    title,
  };
}

describe("notebook store", () => {
  it("creates a notebook and opens the seeded draft", async () => {
    const notebook = makeNotebook("nb-1", "item-1");
    const remoteStore: NotebookStoreApi = {
      listNotebooks: async () => [],
      getNotebook: async () => notebook,
      createNotebook: async () => notebook,
      updateNotebook: async () => updateNotebookResult(notebook),
      createItem: async () => notebook.items[0],
      createSource: async () => makeSource(notebook.id),
      updateItem: async () => notebook.items[0],
    };

    const store = createNotebookStore(remoteStore);

    await store.getState().createNotebook();

    expect(store.getState().activeNotebook?.title).toBe("Untitled notebook");
    expect(store.getState().activeItem?.type).toBe("draft");
    expect(store.getState().workspaceView).toBe("notebook_list");
  });

  it("deduplicates concurrent first loads so only one notebook is created", async () => {
    const notebook = makeNotebook("nb-1", "item-1");
    const createNotebook = vi.fn(async () => notebook);
    const remoteStore: NotebookStoreApi = {
      listNotebooks: async () => [],
      getNotebook: async () => notebook,
      createNotebook,
      updateNotebook: async () => updateNotebookResult(notebook),
      createItem: async () => notebook.items[0],
      createSource: async () => makeSource(notebook.id),
      updateItem: async () => notebook.items[0],
    };

    const store = createNotebookStore(remoteStore);
    await Promise.all([store.getState().loadNotebooks(), store.getState().loadNotebooks()]);

    expect(createNotebook).toHaveBeenCalledTimes(1);
    expect(store.getState().notebooks).toHaveLength(1);
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
      getNotebook: async () => notebook,
      createNotebook: async () => notebook,
      updateNotebook: async () => updateNotebookResult(notebook),
      createItem: async () => notebook.items[0],
      createSource: async () => makeSource(notebook.id),
      updateItem: async () => notebook.items[0],
    };

    const store = createNotebookStore(remoteStore);
    await store.getState().loadNotebooks();
    store.getState().setActiveItem("item-2");

    expect(store.getState().activeItem?.id).toBe("item-2");
    expect(store.getState().activeItem?.type).toBe("note");
  });

  it("starts in notebook list view after loading notebooks", async () => {
    const notebook = makeNotebook("nb-1", "item-1");
    const remoteStore: NotebookStoreApi = {
      listNotebooks: async () => [notebook],
      getNotebook: async () => notebook,
      createNotebook: async () => notebook,
      updateNotebook: async () => updateNotebookResult(notebook),
      createItem: async () => notebook.items[0],
      createSource: async () => makeSource(notebook.id),
      updateItem: async () => notebook.items[0],
    };

    const store = createNotebookStore(remoteStore);
    await store.getState().loadNotebooks();

    expect(store.getState().workspaceView).toBe("notebook_list");
  });

  it("enters notebook detail without resetting the active item for the same notebook", async () => {
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
      getNotebook: async () => notebook,
      createNotebook: async () => notebook,
      updateNotebook: async () => updateNotebookResult(notebook),
      createItem: async () => notebook.items[0],
      createSource: async () => makeSource(notebook.id),
      updateItem: async () => notebook.items[0],
    };

    const store = createNotebookStore(remoteStore);
    await store.getState().loadNotebooks();
    store.getState().setActiveItem("item-2");
    (store.getState() as StoreStateWithRename).enterNotebook("nb-1");

    expect(store.getState().workspaceView).toBe("notebook_detail");
    expect(store.getState().activeItem?.id).toBe("item-2");
  });

  it("returns to notebook list view without losing the active notebook selection", async () => {
    const notebook = makeNotebook("nb-1", "item-1");
    const remoteStore: NotebookStoreApi = {
      listNotebooks: async () => [notebook],
      getNotebook: async () => notebook,
      createNotebook: async () => notebook,
      updateNotebook: async () => updateNotebookResult(notebook),
      createItem: async () => notebook.items[0],
      createSource: async () => makeSource(notebook.id),
      updateItem: async () => notebook.items[0],
    };

    const store = createNotebookStore(remoteStore);
    await store.getState().loadNotebooks();
    (store.getState() as StoreStateWithRename).enterNotebook("nb-1");
    (store.getState() as StoreStateWithRename).exitNotebookDetail();

    expect(store.getState().workspaceView).toBe("notebook_list");
    expect(store.getState().activeNotebook?.id).toBe("nb-1");
    expect(store.getState().activeItem?.id).toBe("item-1");
  });

  it("renames the active notebook and updates the notebook list", async () => {
    const notebook = makeNotebook("nb-1", "item-1");
    const remoteStore = {
      listNotebooks: async () => [notebook],
      getNotebook: async () => notebook,
      createNotebook: async () => notebook,
      createItem: async () => notebook.items[0],
      createSource: async () => makeSource(notebook.id),
      updateItem: async () => notebook.items[0],
      updateNotebook: async () => ({
        ...notebook,
        title: "Renamed notebook",
      }),
    } as RemoteStoreWithRename;

    const store = createNotebookStore(remoteStore);
    await store.getState().loadNotebooks();
    await (store.getState() as StoreStateWithRename).renameNotebook("nb-1", "Renamed notebook");

    expect(store.getState().activeNotebook?.title).toBe("Renamed notebook");
    expect(store.getState().notebooks[0]?.title).toBe("Renamed notebook");
  });

  it("renames the active item and updates the active notebook", async () => {
    const notebook = makeNotebook("nb-1", "item-1");
    const remoteStore = {
      listNotebooks: async () => [notebook],
      getNotebook: async () => notebook,
      createNotebook: async () => notebook,
      updateNotebook: async () => updateNotebookResult(notebook),
      createItem: async () => notebook.items[0],
      createSource: async () => makeSource(notebook.id),
      updateItem: async () => ({
        ...notebook.items[0],
        title: "Renamed draft",
      }),
    } as NotebookStoreApi;

    const store = createNotebookStore(remoteStore);
    await store.getState().loadNotebooks();
    await (store.getState() as StoreStateWithRename).renameItem("item-1", "Renamed draft");

    expect(store.getState().activeItem?.title).toBe("Renamed draft");
    expect(store.getState().activeNotebook?.items[0]?.title).toBe("Renamed draft");
  });

  it("preserves dirty content when renaming the active item", async () => {
    const notebook = makeNotebook("nb-1", "item-1");
    const remoteStore = {
      listNotebooks: async () => [notebook],
      getNotebook: async () => notebook,
      createNotebook: async () => notebook,
      updateNotebook: async () => updateNotebookResult(notebook),
      createItem: async () => notebook.items[0],
      createSource: async () => makeSource(notebook.id),
      updateItem: async () => ({
        ...notebook.items[0],
        title: "Renamed draft",
        content: "",
      }),
    } as NotebookStoreApi;

    const store = createNotebookStore(remoteStore);
    await store.getState().loadNotebooks();
    store.getState().updateActiveItemContent("# Local draft");
    await (store.getState() as StoreStateWithRename).renameItem("item-1", "Renamed draft");

    expect(store.getState().activeItem?.title).toBe("Renamed draft");
    expect(store.getState().activeItem?.content).toBe("# Local draft");
    expect(store.getState().activeItem?.isDirty).toBe(true);
  });

  it("marks the active item dirty when content changes", async () => {
    const notebook = makeNotebook("nb-1", "item-1");
    const remoteStore: NotebookStoreApi = {
      listNotebooks: async () => [notebook],
      getNotebook: async () => notebook,
      createNotebook: async () => notebook,
      updateNotebook: async () => updateNotebookResult(notebook),
      createItem: async () => notebook.items[0],
      createSource: async () => makeSource(notebook.id),
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
      getNotebook: async () => notebook,
      createNotebook: async () => notebook,
      updateNotebook: async () => updateNotebookResult(notebook),
      createItem: async () => notebook.items[0],
      createSource: async () => makeSource(notebook.id),
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

  it("reloads the conflicted item from the server after confirmation flow", async () => {
    const notebook = makeNotebook("nb-1", "item-1");
    const remoteNotebook = {
      ...notebook,
      items: [
        {
          ...notebook.items[0],
          content: "# Server version",
          serverRevision: 3,
        },
      ],
    };
    const remoteStore: NotebookStoreApi = {
      listNotebooks: async () => [notebook],
      getNotebook: async () => remoteNotebook,
      createNotebook: async () => notebook,
      updateNotebook: async () => updateNotebookResult(notebook),
      createItem: async () => notebook.items[0],
      createSource: async () => makeSource(notebook.id),
      updateItem: async () => {
        throw new Error("REVISION_CONFLICT");
      },
    };

    const store = createNotebookStore(remoteStore);
    await store.getState().loadNotebooks();
    store.getState().updateActiveItemContent("# Local conflict");
    await store.getState().flushActiveNotebook();

    expect(store.getState().activeConflict?.itemId).toBe("item-1");

    await store.getState().reloadConflictedItem();

    expect(store.getState().activeConflict).toBeUndefined();
    expect(store.getState().activeItem?.content).toBe("# Server version");
    expect(store.getState().activeItem?.serverRevision).toBe(3);
    expect(await readPendingEdits("nb-1")).toHaveLength(0);
  });

  it("keeps local conflicted content as a new recovered draft", async () => {
    const notebook = makeNotebook("nb-1", "item-1");
    let currentNotebook: NotebookRecord = {
      ...notebook,
      items: [
        {
          ...notebook.items[0],
          content: "# Server version",
          serverRevision: 3,
        },
      ],
    };
    const recoveredItem = {
      id: "item-2",
      notebookId: "nb-1",
      type: "draft" as const,
      title: "Untitled (Recovered)",
      content: "# Local conflict",
      contentFormat: "markdown" as const,
      orderIndex: 1,
      serverRevision: 1,
      isDirty: false,
    };
    const createItem = vi.fn(async (_input: unknown) => recoveredItem);
    const remoteStore: NotebookStoreApi = {
      listNotebooks: async () => [notebook],
      getNotebook: async () => currentNotebook,
      createNotebook: async () => notebook,
      updateNotebook: async () => updateNotebookResult(currentNotebook),
      createItem: vi.fn(async (input) => {
        const item = await createItem(input);
        currentNotebook = {
          ...currentNotebook,
          items: [...currentNotebook.items, item],
        };
        return item;
      }),
      createSource: async () => makeSource(notebook.id),
      updateItem: async () => {
        throw new Error("REVISION_CONFLICT");
      },
    };

    const store = createNotebookStore(remoteStore);
    await store.getState().loadNotebooks();
    store.getState().updateActiveItemContent("# Local conflict");
    await store.getState().flushActiveNotebook();

    await store.getState().keepLocalAsNewCopy();

    expect(createItem).toHaveBeenCalledWith({
      notebookId: "nb-1",
      type: "draft",
      title: "Untitled (Recovered)",
      content: "# Local conflict",
    });
    expect(store.getState().activeConflict).toBeUndefined();
    expect(store.getState().activeItem?.id).toBe("item-2");
    expect(store.getState().activeItem?.content).toBe("# Local conflict");
    expect(store.getState().activeNotebook?.items).toHaveLength(2);
    expect(await readPendingEdits("nb-1")).toHaveLength(0);
  });

  it("registers an external link source on the active notebook", async () => {
    const notebook = makeNotebook("nb-1", "item-1");
    const source = makeSource(notebook.id);
    const createSource = vi.fn(async () => source);
    const remoteStore: NotebookStoreApi = {
      listNotebooks: async () => [notebook],
      getNotebook: async () => notebook,
      createNotebook: async () => notebook,
      updateNotebook: async () => updateNotebookResult(notebook),
      createItem: async () => notebook.items[0],
      createSource,
      updateItem: async () => notebook.items[0],
    };

    const store = createNotebookStore(remoteStore);
    await store.getState().loadNotebooks();
    await store.getState().createSource({
      type: "external_link",
      title: "Reference link",
      sourceUrl: "https://example.com/reference",
    });

    expect(createSource).toHaveBeenCalledWith({
      notebookId: "nb-1",
      type: "external_link",
      title: "Reference link",
      sourceUrl: "https://example.com/reference",
    });
    expect(store.getState().activeNotebook?.sources).toEqual([source]);
  });
});
