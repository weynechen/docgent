import { create } from "zustand";
import {
  applyRewriteRun,
  discardRewriteRun,
  startAgentChatRun,
  startRewriteSelectionRun,
} from "../ai/provider";
import { remoteDocumentStore } from "../documents/documentStore";
import { localVersionStore } from "../documents/versionStore";
import type {
  AppliedChange,
  AgentChatHistoryMessage,
  AgentChatMessage,
  AgentToolEvent,
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
  sessionId?: string;
  docs: DocFile[];
  activeDocPath?: string;
  activeDoc?: DocFile;
  selection?: SelectionContext;
  currentSuggestion?: EditSuggestion;
  activeRunId?: string;
  agentStatusTrail: RewriteStatusEvent[];
  chatMessages: AgentChatMessage[];
  toolEvents: AgentToolEvent[];
  conversationId?: string;
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
  sendChatMessage: (message: string) => Promise<void>;
  applySuggestion: () => Promise<boolean>;
  rejectSuggestion: () => Promise<void>;
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
let activeChatStream: (() => void) | undefined;

function closeActiveRewriteStream() {
  activeRewriteStream?.();
  activeRewriteStream = undefined;
}

function closeActiveChatStream() {
  activeChatStream?.();
  activeChatStream = undefined;
}

function closeAllActiveStreams() {
  closeActiveRewriteStream();
  closeActiveChatStream();
}

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function summarizeArgs(args: Record<string, unknown>) {
  const entries = Object.entries(args);
  if (entries.length === 0) {
    return "";
  }
  return entries
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(", ")
    .slice(0, 240);
}

function toHistory(messages: AgentChatMessage[]): AgentChatHistoryMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant" || message.role === "system")
    .filter((message) => message.status !== "error")
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  docs: [],
  agentStatusTrail: [],
  chatMessages: [],
  toolEvents: [],
  agentRunState: "idle",
  isGenerating: false,
  versions: [],

  async loadWorkspace() {
    const sessionId = await remoteDocumentStore.getSessionId();
    const docs = await remoteDocumentStore.listDocs();
    const activeDoc = docs[0];
    const versions = activeDoc ? await localVersionStore.listVersions(activeDoc.path) : [];
    set({
      sessionId,
      docs,
      activeDocPath: activeDoc?.path,
      activeDoc,
      versions,
    });
  },

  async setActiveDoc(path) {
    closeAllActiveStreams();
    const activeDoc = await remoteDocumentStore.openDoc(path);
    const versions = await localVersionStore.listVersions(path);
    set((state) => ({
      sessionId: state.sessionId,
      activeDocPath: path,
      activeDoc,
      docs: state.docs.map((doc) => (doc.path === activeDoc.path ? activeDoc : doc)),
      versions,
      chatMessages: [],
      conversationId: undefined,
      selection: undefined,
      currentSuggestion: undefined,
      activeRunId: undefined,
      agentStatusTrail: [],
      toolEvents: [],
      agentRunState: "idle",
      isGenerating: false,
      selectedVersionId: undefined,
    }));
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

    try {
      const savedDoc = await remoteDocumentStore.saveDoc(
        activeDoc.path,
        activeDoc.content,
        activeDoc.revision,
      );
      set((state) => ({
        activeDoc: savedDoc,
        docs: state.docs.map((doc) => (doc.path === savedDoc.path ? savedDoc : doc)),
        notice: {
          message: "Document saved to the backend workspace.",
          tone: "success",
        },
      }));
    } catch (error) {
      set({
        notice: {
          message: error instanceof Error ? error.message : "Failed to save document.",
          tone: "error",
        },
      });
    }
  },

  setSelection(selection) {
    set({
      selection,
      currentSuggestion: undefined,
      activeRunId: undefined,
      agentStatusTrail: [],
    });
  },

  clearSuggestion() {
    closeActiveRewriteStream();
    set({
      currentSuggestion: undefined,
      activeRunId: undefined,
      agentStatusTrail: [],
      toolEvents: [],
      agentRunState: "idle",
      isGenerating: false,
    });
  },

  async requestSuggestion(instruction) {
    const { activeDoc, selection, sessionId } = get();
    if (!activeDoc || !selection?.text.trim() || !sessionId) {
      set({
        notice: {
          message: "Select a passage before asking AI to rewrite it.",
          tone: "error",
        },
      });
      return;
    }

    closeAllActiveStreams();
    set({
      isGenerating: true,
      notice: undefined,
      currentSuggestion: undefined,
      activeRunId: undefined,
      agentStatusTrail: [],
      agentRunState: "running",
    });

    try {
      const stream = await startRewriteSelectionRun(
        {
          sessionId,
          docPath: activeDoc.path,
          selectionStart: selection.start,
          selectionEnd: selection.end,
          instruction,
        },
        {
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
        },
      );

      activeRewriteStream = stream.close;
      set({ activeRunId: stream.runId });
    } catch (error) {
      set({
        isGenerating: false,
        agentRunState: "error",
        notice: {
          message: error instanceof Error ? error.message : "AI rewrite failed. Please retry.",
          tone: "error",
        },
      });
    }
  },

  async sendChatMessage(message) {
    const { activeDoc, sessionId, selection, conversationId, chatMessages, isGenerating } = get();
    const trimmed = message.trim();
    if (!activeDoc || !sessionId || !trimmed || isGenerating) {
      return;
    }

    closeAllActiveStreams();

    const userMessage: AgentChatMessage = {
      id: createMessageId("user"),
      role: "user",
      content: trimmed,
      status: "complete",
      createdAt: Date.now(),
    };
    const assistantMessageId = createMessageId("assistant");
    const assistantMessage: AgentChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      status: "streaming",
      createdAt: Date.now(),
    };
    const history = toHistory([...chatMessages, userMessage]);

    set((state) => ({
      chatMessages: [...state.chatMessages, userMessage, assistantMessage],
      toolEvents: [],
      isGenerating: true,
      agentRunState: "running",
      notice: undefined,
    }));

    let syncedDoc = activeDoc;
    if (activeDoc.isDirty) {
      try {
        syncedDoc = await remoteDocumentStore.saveDoc(
          activeDoc.path,
          activeDoc.content,
          activeDoc.revision,
        );
        set((state) => ({
          activeDoc: syncedDoc,
          docs: state.docs.map((doc) => (doc.path === syncedDoc.path ? syncedDoc : doc)),
        }));
      } catch (error) {
        set((state) => ({
          chatMessages: state.chatMessages.map((item) =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  status: "error",
                  content:
                    error instanceof Error
                      ? error.message
                      : "Failed to save document before AI chat.",
                }
              : item,
          ),
          isGenerating: false,
          agentRunState: "error",
          notice: {
            message: error instanceof Error ? error.message : "Failed to save document before AI chat.",
            tone: "error",
          },
        }));
        return;
      }
    }

    try {
      const stream = await startAgentChatRun(
        {
          sessionId,
          docPath: syncedDoc.path,
          message: trimmed,
          history,
          conversationId,
          selection,
        },
        {
          onConversationCreated: (event) => {
            set({ conversationId: event.data.conversation_id });
          },
          onTextDelta: (event) => {
            set((state) => ({
              chatMessages: state.chatMessages.map((item) =>
                item.id === assistantMessageId
                  ? { ...item, content: item.content + event.data.content }
                  : item,
              ),
            }));
          },
          onToolCall: (event) => {
            set((state) => ({
              toolEvents: [
                ...state.toolEvents,
                {
                  id: createMessageId("tool"),
                  toolCallId: event.data.tool_call_id,
                  toolName: event.data.tool_name,
                  argsSummary: summarizeArgs(event.data.args),
                  status: "running",
                },
              ],
            }));
          },
          onToolResult: (event) => {
            set((state) => ({
              toolEvents: state.toolEvents.map((item) =>
                item.toolCallId === event.data.tool_call_id
                  ? { ...item, status: "complete", resultSummary: event.data.content }
                  : item,
              ),
            }));
          },
          onFinalResult: (event) => {
            set((state) => ({
              chatMessages: state.chatMessages.map((item) =>
                item.id === assistantMessageId && !item.content
                  ? { ...item, content: event.data.output }
                  : item,
              ),
            }));
          },
          onWorkspaceFileUpdated: (event) => {
            set((state) => {
              const updatedDoc: DocFile | undefined =
                state.activeDoc?.path === event.data.doc_path
                  ? {
                      ...state.activeDoc,
                      content: event.data.content,
                      revision: event.data.revision,
                      isDirty: false,
                      lastSavedAt: event.data.last_saved_at,
                    }
                  : state.activeDoc;

              return {
                activeDoc: updatedDoc,
                docs: state.docs.map((doc) =>
                  doc.path === event.data.doc_path
                    ? {
                        ...doc,
                        content: event.data.content,
                        revision: event.data.revision,
                        isDirty: false,
                        lastSavedAt: event.data.last_saved_at,
                      }
                    : doc,
                ),
                notice: {
                  message: `AI updated ${event.data.doc_path} in the backend workspace.`,
                  tone: "success",
                },
              };
            });
          },
          onComplete: (event) => {
            closeActiveChatStream();
            set((state) => ({
              conversationId: event.data.conversation_id ?? state.conversationId,
              chatMessages: state.chatMessages.map((item) =>
                item.id === assistantMessageId
                  ? {
                      ...item,
                      status: "complete",
                      content: item.content || "Completed.",
                    }
                  : item,
              ),
              isGenerating: false,
              agentRunState: "complete",
            }));
          },
          onError: (event) => {
            closeActiveChatStream();
            set((state) => ({
              chatMessages: state.chatMessages.map((item) =>
                item.id === assistantMessageId
                  ? {
                      ...item,
                      status: "error",
                      content: item.content || event.data.message,
                    }
                  : item,
              ),
              isGenerating: false,
              agentRunState: "error",
              notice: {
                message: event.data.message,
                tone: "error",
              },
            }));
          },
        },
      );

      activeChatStream = stream.close;
    } catch (error) {
      set((state) => ({
        chatMessages: state.chatMessages.map((item) =>
          item.id === assistantMessageId
            ? {
                ...item,
                status: "error",
                content: error instanceof Error ? error.message : "AI chat failed. Please retry.",
              }
            : item,
        ),
        isGenerating: false,
        agentRunState: "error",
        notice: {
          message: error instanceof Error ? error.message : "AI chat failed. Please retry.",
          tone: "error",
        },
      }));
    }
  },

  async applySuggestion() {
    const { activeDoc, currentSuggestion, activeRunId, sessionId } = get();
    if (!activeDoc || !currentSuggestion || !activeRunId || !sessionId) {
      return false;
    }

    try {
      const applied = await applyRewriteRun(sessionId, activeRunId);
      closeActiveRewriteStream();

      const updatedDoc: DocFile = {
        ...activeDoc,
        content: applied.content,
        revision: applied.revision,
        isDirty: false,
        lastSavedAt: applied.appliedAt,
      };

      set((state) => ({
        activeDoc: updatedDoc,
        docs: state.docs.map((doc) => (doc.path === updatedDoc.path ? updatedDoc : doc)),
        lastAppliedChange: {
          suggestionId: currentSuggestion.id,
          docPath: updatedDoc.path,
          originalText: currentSuggestion.proposedEdits[0]?.beforeMarkdown ?? activeDoc.content,
          appliedText: updatedDoc.content,
          appliedAt: applied.appliedAt,
        },
        currentSuggestion: undefined,
        activeRunId: undefined,
        selection: undefined,
        agentStatusTrail: [],
        agentRunState: "idle",
        notice: {
          message: "AI suggestion applied to the backend workspace.",
          tone: "success",
        },
      }));

      return true;
    } catch (error) {
      set({
        notice: {
          message: error instanceof Error ? error.message : "Unable to apply the current suggestion.",
          tone: "error",
        },
      });
      return false;
    }
  },

  async rejectSuggestion() {
    const { activeRunId, sessionId } = get();
    closeActiveRewriteStream();

    if (activeRunId && sessionId) {
      try {
        await discardRewriteRun(sessionId, activeRunId);
      } catch {
        // Ignore discard failures in the MVP client; the backend will clean up the run.
      }
    }

    set({
      currentSuggestion: undefined,
      activeRunId: undefined,
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

    closeAllActiveStreams();
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
        activeRunId: undefined,
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
