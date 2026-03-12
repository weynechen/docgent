import { loadSnapshots, saveSnapshots } from "../shared/storage";
import type { VersionSnapshot } from "../shared/types";

export interface VersionStore {
  createVersion(input: {
    docPath: string;
    content: string;
    title?: string;
    source: "manual" | "ai";
  }): Promise<string>;
  listVersions(docPath: string): Promise<VersionSnapshot[]>;
  getVersion(id: string): Promise<VersionSnapshot>;
  restoreVersion(id: string): Promise<{ content: string }>;
}

function buildId() {
  return `version-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const localVersionStore: VersionStore = {
  async createVersion(input) {
    const snapshots = loadSnapshots();
    const snapshot: VersionSnapshot = {
      id: buildId(),
      createdAt: Date.now(),
      ...input,
    };

    saveSnapshots([snapshot, ...snapshots]);
    return snapshot.id;
  },

  async listVersions(docPath) {
    const snapshots = loadSnapshots();
    return snapshots.filter((item) => item.docPath === docPath);
  },

  async getVersion(id) {
    const snapshot = loadSnapshots().find((item) => item.id === id);
    if (!snapshot) {
      throw new Error(`Version not found: ${id}`);
    }

    return snapshot;
  },

  async restoreVersion(id) {
    const snapshot = await this.getVersion(id);
    return { content: snapshot.content };
  },
};
