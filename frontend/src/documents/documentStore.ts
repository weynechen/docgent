import type { DocFile, WorkspaceTreeEntry } from "../shared/types";

const WORKSPACE_SESSION_KEY = "docgent-workspace-session";

interface WorkspaceCreateResponse {
  sessionId: string;
}

interface WorkspaceTreeResponse {
  sessionId: string;
  entries: WorkspaceTreeEntry[];
}

interface WorkspaceFileResponse {
  sessionId: string;
  path: string;
  name: string;
  content: string;
  revision: number;
  lastSavedAt: number;
}

export interface DocumentStore {
  getSessionId(): Promise<string>;
  listDocs(): Promise<DocFile[]>;
  openDoc(path: string): Promise<DocFile>;
  saveDoc(path: string, content: string, baseRevision: number): Promise<DocFile>;
}

async function parseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message || fallback;
  } catch {
    const text = await response.text();
    return text || fallback;
  }
}

async function createWorkspace(): Promise<string> {
  const response = await fetch("/api/v1/workspaces", { method: "POST" });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to create backend workspace."));
  }

  const payload = (await response.json()) as WorkspaceCreateResponse;
  window.localStorage.setItem(WORKSPACE_SESSION_KEY, payload.sessionId);
  return payload.sessionId;
}

async function ensureWorkspace(): Promise<string> {
  const stored = window.localStorage.getItem(WORKSPACE_SESSION_KEY);
  if (stored) {
    const probe = await fetch(`/api/v1/workspaces/${stored}/tree`);
    if (probe.ok) {
      return stored;
    }
    window.localStorage.removeItem(WORKSPACE_SESSION_KEY);
  }

  return createWorkspace();
}

function toDocFile(payload: WorkspaceFileResponse): DocFile {
  return {
    path: payload.path,
    name: payload.name,
    content: payload.content,
    revision: payload.revision,
    lastSavedAt: payload.lastSavedAt,
    isDirty: false,
  };
}

async function openRemoteDoc(path: string): Promise<DocFile> {
  const sessionId = await ensureWorkspace();
  const response = await fetch(`/api/v1/workspaces/${sessionId}/files?path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    throw new Error(await parseError(response, `Failed to open document: ${path}`));
  }

  return toDocFile((await response.json()) as WorkspaceFileResponse);
}

export const remoteDocumentStore: DocumentStore = {
  async getSessionId() {
    return ensureWorkspace();
  },

  async listDocs() {
    const sessionId = await ensureWorkspace();
    const response = await fetch(`/api/v1/workspaces/${sessionId}/tree`);
    if (!response.ok) {
      throw new Error(await parseError(response, "Failed to load workspace tree."));
    }

    const payload = (await response.json()) as WorkspaceTreeResponse;
    const fileEntries = payload.entries.filter((entry) => entry.nodeType === "file");

    return Promise.all(fileEntries.map((entry) => openRemoteDoc(entry.path)));
  },

  async openDoc(path) {
    return openRemoteDoc(path);
  },

  async saveDoc(path, content, baseRevision) {
    const sessionId = await ensureWorkspace();
    const response = await fetch(`/api/v1/workspaces/${sessionId}/files`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        docPath: path,
        content,
        baseRevision,
      }),
    });
    if (!response.ok) {
      throw new Error(await parseError(response, `Failed to save document: ${path}`));
    }

    return toDocFile((await response.json()) as WorkspaceFileResponse);
  },
};
