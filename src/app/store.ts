import { create } from "zustand";
import { startRewriteSelectionRun } from "../ai/provider";
import { mockDocumentStore } from "../documents/documentStore";
import { localVersionStore } from "../documents/versionStore";
import type {
  AppliedChange,
  DocFile,
  EditSuggestion,
  RewriteStatusEvent,
  SelectionContext,
  VersionSnapshot,
} from "../shared/types";

type NoticeTone = "info" | "success" | "error";

interface Notice {
  message: string;
  tone: NoticeTone;
}

interface WorkspaceState {
  docs: DocFile[];
  activeDocPath?: string;
  activeDoc?: DocFile;
  selection?: SelectionContext;
  currentSuggestion?: EditSuggestion;
  agentStatusTrail: RewriteStatusEvent[];
  agentRunState: "idle" | "running" | "complete" | "error";
  isGenerating: boolean;
  versions: VersionSnapshot[];
  selectedVersionId?: string;
  lastAppliedChange?: AppliedChange;
  notice?: Notice;
  loadWorkspace: () => Promise<void>;
  setActiveDoc: (path: string) => Promise<void>;
  updateActiveDocContent: (content: string) => void;
  saveActiveDoc: () => Promise<void>;
  setSelection: (selection?: SelectionContext) => void;
  clearSuggestion: () => void;
  requestSuggestion: (instruction: string) => Promise<void>;
  applySuggestion: (
    updater: (args: { from: number; to: number; text: string }) => boolean,
  ) => Promise<boolean>;
  rejectSuggestion: () => void;
  createVersion: (title?: string, source?: "manual" | "ai") => Promise<void>;
  loadVersions: (docPath?: string) => Promise<void>;
  selectVersion: (versionId?: string) => void;
  restoreVersion: (
    versionId: string,
    updater: (content: string) => void,
  ) => Promise<void>;
  setNotice: (message: string, tone: NoticeTone) => void;
}

let activeRewriteStream: (() => void) | undefined;

function closeActiveRewriteStream() {
  activeRewriteStream?.();
  activeRewriteStream = undefined;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  docs: [],
  agentStatusTrail: [],
  agentRunState: "idle",
  isGenerating: false,
  versions: [],

  async loadWorkspace() {
    const docs = await mockDocumentStore.listDocs();
    const activeDoc = docs[0];
    const versions = activeDoc ? await localVersionStore.listVersions(activeDoc.path) : [];
    set({
      docs,
      activeDocPath: activeDoc?.path,
      activeDoc,
      versions,
    });
  },

  async setActiveDoc(path) {
    closeActiveRewriteStream();
    const activeDoc = await mockDocumentStore.openDoc(path);
    const versions = await localVersionStore.listVersions(path);
    set({
      activeDocPath: path,
      activeDoc,
      versions,
      selection: undefined,
      currentSuggestion: undefined,
      agentStatusTrail: [],
      agentRunState: "idle",
      isGenerating: false,
      selectedVersionId: undefined,
    });
  },

  updateActiveDocContent(content) {
    set((state) => {
      if (!state.activeDoc) {
        return state;
      }

      const updatedDoc: DocFile = {
        ...state.activeDoc,
        content,
        isDirty: true,
      };

      return {
        activeDoc: updatedDoc,
        docs: state.docs.map((doc) => (doc.path === updatedDoc.path ? updatedDoc : doc)),
      };
    });
  },

  async saveActiveDoc() {
    const { activeDoc } = get();
    if (!activeDoc) {
      return;
    }

    await mockDocumentStore.saveDoc(activeDoc.path, activeDoc.content);
    set((state) => {
      if (!state.activeDoc) {
        return state;
      }

      const savedDoc = {
        ...state.activeDoc,
        isDirty: false,
        lastSavedAt: Date.now(),
      };

      return {
        activeDoc: savedDoc,
        docs: state.docs.map((doc) => (doc.path === savedDoc.path ? savedDoc : doc)),
        notice: {
          message: "Document saved.",
          tone: "success",
        },
      };
    });
  },

  setSelection(selection) {
    closeActiveRewriteStream();
    set({
      selection,
      currentSuggestion: undefined,
      agentStatusTrail: [],
      agentRunState: "idle",
      isGenerating: false,
    });
  },

  clearSuggestion() {
    closeActiveRewriteStream();
    set({
      currentSuggestion: undefined,
      agentStatusTrail: [],
      agentRunState: "idle",
      isGenerating: false,
    });
  },

  async requestSuggestion(instruction) {
    const { activeDoc, selection } = get();
    if (!activeDoc || !selection?.text.trim()) {
      set({
        notice: {
          message: "Select a passage before asking AI to rewrite it.",
          tone: "error",
        },
      });
      return;
    }

    closeActiveRewriteStream();
    set({
      isGenerating: true,
      notice: undefined,
      currentSuggestion: undefined,
      agentStatusTrail: [],
      agentRunState: "running",
    });

    try {
      activeRewriteStream = await startRewriteSelectionRun({
        docPath: activeDoc.path,
        selectedText: selection.text,
        instruction,
        documentTitle: activeDoc.name,
        beforeText: selection.beforeText,
        afterText: selection.afterText,
      }, {
        onStatus: (event) => {
          set((state) => ({
            agentStatusTrail: [...state.agentStatusTrail, event],
            agentRunState: "running",
          }));
        },
        onResult: (event) => {
          set(() => ({
            currentSuggestion: {
              ...event.suggestion,
              statusTrail: get().agentStatusTrail.map((item) => item.status),
            },
            isGenerating: false,
            agentRunState: "complete",
          }));
        },
        onError: (event) => {
          closeActiveRewriteStream();
          set({
            isGenerating: false,
            agentRunState: "error",
            notice: {
              message: event.message,
              tone: "error",
            },
          });
        },
        onDone: () => {
          closeActiveRewriteStream();
          set((state) => ({
            isGenerating: false,
            agentRunState: state.currentSuggestion ? "complete" : state.agentRunState,
          }));
        },
      });
    } catch {
      set({
        isGenerating: false,
        agentRunState: "error",
        notice: {
          message: "AI rewrite failed. Please retry.",
          tone: "error",
        },
      });
    }
  },

  async applySuggestion(updater) {
    const { activeDoc, selection, currentSuggestion } = get();
    if (!activeDoc || !selection || !currentSuggestion) {
      return false;
    }

    const applied = updater({
      from: selection.from,
      to: selection.to,
      text: currentSuggestion.suggestedText,
    });

    if (!applied) {
      set({
        notice: {
          message: "Unable to apply the current suggestion.",
          tone: "error",
        },
      });
      return false;
    }

    closeActiveRewriteStream();
    set(() => {
      return {
        lastAppliedChange: {
          suggestionId: currentSuggestion.id,
          docPath: activeDoc.path,
          originalText: selection.text,
          appliedText: currentSuggestion.suggestedText,
          appliedAt: Date.now(),
        },
        currentSuggestion: undefined,
        selection: {
          ...selection,
          text: currentSuggestion.suggestedText,
          to: selection.from + currentSuggestion.suggestedText.length,
        },
        agentStatusTrail: [],
        agentRunState: "idle",
        notice: {
          message: "AI suggestion applied.",
          tone: "success",
        },
      };
    });

    return true;
  },

  rejectSuggestion() {
    closeActiveRewriteStream();
    set({
      currentSuggestion: undefined,
      agentStatusTrail: [],
      agentRunState: "idle",
      isGenerating: false,
      notice: {
        message: "Suggestion dismissed.",
        tone: "info",
      },
    });
  },

  async createVersion(title, source = "manual") {
    const { activeDoc } = get();
    if (!activeDoc) {
      return;
    }

    await localVersionStore.createVersion({
      docPath: activeDoc.path,
      content: activeDoc.content,
      title,
      source,
    });

    const versions = await localVersionStore.listVersions(activeDoc.path);
    set({
      versions,
      notice: {
        message: "Version snapshot created.",
        tone: "success",
      },
    });
  },

  async loadVersions(docPath) {
    const targetPath = docPath ?? get().activeDoc?.path;
    if (!targetPath) {
      return;
    }

    const versions = await localVersionStore.listVersions(targetPath);
    set({ versions });
  },

  selectVersion(versionId) {
    set({ selectedVersionId: versionId });
  },

  async restoreVersion(versionId, updater) {
    const { activeDoc } = get();
    if (!activeDoc) {
      return;
    }

    closeActiveRewriteStream();
    const restored = await localVersionStore.restoreVersion(versionId);
    updater(restored.content);
    set((state) => {
      if (!state.activeDoc) {
        return state;
      }

      const updatedDoc = {
        ...state.activeDoc,
        content: restored.content,
        isDirty: true,
      };

      return {
        activeDoc: updatedDoc,
        docs: state.docs.map((doc) => (doc.path === updatedDoc.path ? updatedDoc : doc)),
        currentSuggestion: undefined,
        selection: undefined,
        agentStatusTrail: [],
        agentRunState: "idle",
        isGenerating: false,
        notice: {
          message: "Version restored into the current document.",
          tone: "success",
        },
      };
    });
  },

  setNotice(message, tone) {
    set({
      notice: {
        message,
        tone,
      },
    });
  },
}));
