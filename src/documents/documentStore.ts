import type { DocFile } from "../shared/types";
import { sampleDocs } from "../shared/sampleDocs";

export interface DocumentStore {
  listDocs(): Promise<DocFile[]>;
  openDoc(path: string): Promise<DocFile>;
  saveDoc(path: string, content: string): Promise<void>;
}

const inMemoryDocs = new Map(
  sampleDocs.map((doc) => [
    doc.path,
    {
      ...doc,
      isDirty: false,
      lastSavedAt: Date.now(),
    },
  ]),
);

export const mockDocumentStore: DocumentStore = {
  async listDocs() {
    return [...inMemoryDocs.values()].map((doc) => ({ ...doc }));
  },

  async openDoc(path) {
    const doc = inMemoryDocs.get(path);
    if (!doc) {
      throw new Error(`Document not found: ${path}`);
    }

    return { ...doc };
  },

  async saveDoc(path, content) {
    const current = inMemoryDocs.get(path);
    if (!current) {
      throw new Error(`Document not found: ${path}`);
    }

    inMemoryDocs.set(path, {
      ...current,
      content,
      isDirty: false,
      lastSavedAt: Date.now(),
    });
  },
};
