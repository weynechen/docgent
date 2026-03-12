import { create } from "zustand";
import { mockAIProvider } from "../ai/provider";
import { mockDocumentStore } from "../documents/documentStore";
import { localVersionStore } from "../documents/versionStore";
import { docToMarkdown } from "../shared/markdown";
import type {
  AppliedChange,
  DocFile,
  EditSuggestion,
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

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  docs: [],
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
    const activeDoc = await mockDocumentStore.openDoc(path);
    const versions = await localVersionStore.listVersions(path);
    set({
      activeDocPath: path,
      activeDoc,
      versions,
      selection: undefined,
      currentSuggestion: undefined,
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
    set({
      selection,
    });
  },

  clearSuggestion() {
    set({
      currentSuggestion: undefined,
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

    set({ isGenerating: true, notice: undefined });
    try {
      const beforeText = activeDoc.content.slice(Math.max(0, selection.from - 140), selection.from);
      const afterText = activeDoc.content.slice(selection.to, selection.to + 140);
      const suggestion = await mockAIProvider.rewriteSelection({
        docPath: activeDoc.path,
        selectedText: selection.text,
        instruction,
        documentTitle: activeDoc.name,
        beforeText,
        afterText,
      });

      set({
        currentSuggestion: suggestion,
        isGenerating: false,
      });
    } catch {
      set({
        isGenerating: false,
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

    const stillMatches = activeDoc.content.slice(selection.from, selection.to) === selection.text;
    if (!stillMatches) {
      set({
        notice: {
          message: "Selection changed. Re-select the text before applying this suggestion.",
          tone: "error",
        },
      });
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

    set((state) => {
      if (!state.activeDoc) {
        return state;
      }

      const nextContent =
        state.activeDoc.content.slice(0, selection.from) +
        currentSuggestion.suggestedText +
        state.activeDoc.content.slice(selection.to);

      const updatedDoc = {
        ...state.activeDoc,
        content: nextContent,
        isDirty: true,
      };

      return {
        activeDoc: updatedDoc,
        docs: state.docs.map((doc) => (doc.path === updatedDoc.path ? updatedDoc : doc)),
        lastAppliedChange: {
          suggestionId: currentSuggestion.id,
          docPath: state.activeDoc.path,
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
        notice: {
          message: "AI suggestion applied.",
          tone: "success",
        },
      };
    });

    return true;
  },

  rejectSuggestion() {
    set({
      currentSuggestion: undefined,
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

export function exportCurrentMarkdown() {
  return docToMarkdown(null);
}
