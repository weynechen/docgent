import { describe, expect, it } from "vitest";

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
});
