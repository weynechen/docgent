import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearNotebookPersistence, readPendingEdits, writePendingEdit } from "./indexedDb";
import { createNotebookSyncEngine } from "./syncEngine";
import type { NotebookItemRecord, NotebookStoreApi, NotebookSyncState } from "./types";

function makeItem(): NotebookItemRecord {
  return {
    id: "item-1",
    notebookId: "nb-1",
    type: "draft",
    title: "Untitled",
    content: "Draft",
    contentFormat: "markdown",
    orderIndex: 0,
    serverRevision: 1,
    isDirty: true,
  };
}

describe("notebook persistence", () => {
  beforeEach(async () => {
    await clearNotebookPersistence();
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("restores pending notebook edits after reload", async () => {
    await writePendingEdit({
      notebookId: "nb-1",
      itemId: "item-1",
      content: "offline draft",
      baseRevision: 1,
      updatedAt: 1710374400000,
    });

    const pending = await readPendingEdits("nb-1");

    expect(pending).toHaveLength(1);
    expect(pending[0]?.content).toBe("offline draft");
  });

  it("flushes pending edits and clears them after a successful sync", async () => {
    const savedStates: NotebookSyncState[] = [];
    const savedItems: NotebookItemRecord[] = [];
    const item = makeItem();
    const remoteStore: NotebookStoreApi = {
      getNotebook: async () => ({ id: "nb-1", title: "Notebook", createdAt: "", updatedAt: null, sources: [], items: [item] }),
      listNotebooks: async () => [],
      createNotebook: async () => ({ id: "nb-1", title: "Notebook", createdAt: "", updatedAt: null, sources: [], items: [] }),
      createItem: async () => item,
      createSource: async () => ({
        id: "source-1",
        notebookId: "nb-1",
        type: "external_link",
        title: "Reference link",
        sourceUrl: "https://example.com/reference",
        mimeType: null,
        createdAt: "",
        updatedAt: null,
      }),
      updateItem: async () => ({
        ...item,
        content: "Draft updated",
        serverRevision: 2,
        isDirty: false,
      }),
    };
    const engine = createNotebookSyncEngine({
      remoteStore,
      onItemSaved: (savedItem) => savedItems.push(savedItem),
      onSyncStateChange: (syncState) => savedStates.push(syncState),
    });

    await writePendingEdit({
      notebookId: "nb-1",
      itemId: "item-1",
      content: "Draft updated",
      baseRevision: 1,
      updatedAt: 1710374400000,
    });
    await engine.flushPendingEdits("nb-1");

    const pending = await readPendingEdits("nb-1");

    expect(savedStates[savedStates.length - 1]).toBe("saved");
    expect(savedItems[0]?.serverRevision).toBe(2);
    expect(pending).toHaveLength(0);
  });

  it("moves to conflict when the server rejects a stale revision", async () => {
    const savedStates: NotebookSyncState[] = [];
    const conflicts: string[] = [];
    const item = makeItem();
    const remoteStore: NotebookStoreApi = {
      getNotebook: async () => ({ id: "nb-1", title: "Notebook", createdAt: "", updatedAt: null, sources: [], items: [item] }),
      listNotebooks: async () => [],
      createNotebook: async () => ({ id: "nb-1", title: "Notebook", createdAt: "", updatedAt: null, sources: [], items: [] }),
      createItem: async () => item,
      createSource: async () => ({
        id: "source-1",
        notebookId: "nb-1",
        type: "external_link",
        title: "Reference link",
        sourceUrl: "https://example.com/reference",
        mimeType: null,
        createdAt: "",
        updatedAt: null,
      }),
      updateItem: async () => {
        throw Object.assign(
          new Error("Notebook item revision is outdated. Reload the latest item before saving."),
          { code: "REVISION_CONFLICT" },
        );
      },
    };
    const engine = createNotebookSyncEngine({
      remoteStore,
      onItemSaved: () => undefined,
      onConflict: (edit) => conflicts.push(edit.itemId),
      onSyncStateChange: (syncState) => savedStates.push(syncState),
    });

    await writePendingEdit({
      notebookId: "nb-1",
      itemId: "item-1",
      content: item.content,
      baseRevision: 1,
      updatedAt: 1710374400000,
    });
    await engine.flushPendingEdits("nb-1");

    expect(savedStates[savedStates.length - 1]).toBe("conflict");
    expect(conflicts).toEqual(["item-1"]);
  });
});
