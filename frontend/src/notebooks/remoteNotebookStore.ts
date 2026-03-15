import type { NotebookItemRecord, NotebookStoreApi, NotebookRecord } from "./types";

async function parseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message || fallback;
  } catch {
    const text = await response.text();
    return text || fallback;
  }
}

async function requestJson<T>(input: RequestInfo, init: RequestInit, fallback: string): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(await parseError(response, fallback));
  }
  return (await response.json()) as T;
}

function toItem(item: Omit<NotebookItemRecord, "isDirty">): NotebookItemRecord {
  return {
    ...item,
    isDirty: false,
  };
}

function toNotebook(notebook: Omit<NotebookRecord, "items"> & { items: Array<Omit<NotebookItemRecord, "isDirty">> }): NotebookRecord {
  return {
    ...notebook,
    items: notebook.items.map(toItem),
  };
}

export const remoteNotebookStore: NotebookStoreApi = {
  async listNotebooks() {
    const notebooks = await requestJson<Array<Omit<NotebookRecord, "items"> & { items: Array<Omit<NotebookItemRecord, "isDirty">> }>>(
      "/api/v1/notebooks",
      { method: "GET" },
      "Failed to load notebooks.",
    );
    return notebooks.map(toNotebook);
  },

  async createNotebook() {
    const notebook = await requestJson<Omit<NotebookRecord, "items"> & { items: Array<Omit<NotebookItemRecord, "isDirty">> }>(
      "/api/v1/notebooks",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
      "Failed to create notebook.",
    );
    return toNotebook(notebook);
  },

  async createItem(input) {
    const item = await requestJson<Omit<NotebookItemRecord, "isDirty">>(
      `/api/v1/notebooks/${input.notebookId}/items`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: input.type,
          title: input.title,
          content: input.content ?? "",
          contentFormat: "markdown",
        }),
      },
      "Failed to create notebook item.",
    );
    return toItem(item);
  },

  async updateItem(input) {
    const item = await requestJson<Omit<NotebookItemRecord, "isDirty">>(
      `/api/v1/notebooks/items/${input.itemId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: input.title,
          content: input.content,
          baseRevision: input.baseRevision,
        }),
      },
      "Failed to update notebook item.",
    );
    return toItem(item);
  },
};
