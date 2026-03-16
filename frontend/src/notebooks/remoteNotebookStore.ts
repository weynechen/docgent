import type { NotebookItemRecord, NotebookSourceRecord, NotebookStoreApi, NotebookRecord } from "./types";

class NotebookApiError extends Error {
  code?: string;
}

async function parseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: { code?: string; message?: string } };
    const error = new NotebookApiError(payload.error?.message || fallback);
    error.code = payload.error?.code;
    return error;
  } catch {
    const text = await response.text();
    return new NotebookApiError(text || fallback);
  }
}

async function requestJson<T>(input: RequestInfo, init: RequestInit, fallback: string): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw await parseError(response, fallback);
  }
  return (await response.json()) as T;
}

function toItem(item: Omit<NotebookItemRecord, "isDirty">): NotebookItemRecord {
  return {
    ...item,
    isDirty: false,
  };
}

function toSource(source: NotebookSourceRecord): NotebookSourceRecord {
  return source;
}

function toNotebook(
  notebook: Omit<NotebookRecord, "items" | "sources"> & {
    items: Array<Omit<NotebookItemRecord, "isDirty">>;
    sources: NotebookSourceRecord[];
  },
): NotebookRecord {
  return {
    ...notebook,
    sources: notebook.sources.map(toSource),
    items: notebook.items.map(toItem),
  };
}

export const remoteNotebookStore: NotebookStoreApi = {
  async listNotebooks() {
    const notebooks = await requestJson<
      Array<
        Omit<NotebookRecord, "items" | "sources"> & {
          items: Array<Omit<NotebookItemRecord, "isDirty">>;
          sources: NotebookSourceRecord[];
        }
      >
    >(
      "/api/v1/notebooks",
      { method: "GET" },
      "Failed to load notebooks.",
    );
    return notebooks.map(toNotebook);
  },

  async getNotebook(notebookId) {
    const notebook = await requestJson<
      Omit<NotebookRecord, "items" | "sources"> & {
        items: Array<Omit<NotebookItemRecord, "isDirty">>;
        sources: NotebookSourceRecord[];
      }
    >(
      `/api/v1/notebooks/${notebookId}`,
      { method: "GET" },
      "Failed to load notebook.",
    );
    return toNotebook(notebook);
  },

  async createNotebook() {
    const notebook = await requestJson<
      Omit<NotebookRecord, "items" | "sources"> & {
        items: Array<Omit<NotebookItemRecord, "isDirty">>;
        sources: NotebookSourceRecord[];
      }
    >(
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

  async updateNotebook(input) {
    const notebook = await requestJson<
      Omit<NotebookRecord, "items" | "sources"> & {
        items: Array<Omit<NotebookItemRecord, "isDirty">>;
        sources: NotebookSourceRecord[];
      }
    >(
      `/api/v1/notebooks/${input.notebookId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: input.title,
        }),
      },
      "Failed to update notebook.",
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

  async createSource(input) {
    const source = await requestJson<NotebookSourceRecord>(
      `/api/v1/notebooks/${input.notebookId}/sources`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: input.type,
          title: input.title,
          sourceUrl: input.sourceUrl,
          mimeType: input.mimeType,
        }),
      },
      "Failed to create notebook source.",
    );
    return toSource(source);
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
