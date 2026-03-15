import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useEditor } from "@tiptap/react";
import { Bot, FileText, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, SendHorizontal } from "lucide-react";

import { NotebookConflictBanner } from "../notebooks/NotebookConflictBanner";
import { SimpleEditor, createSimpleEditorExtensions } from "@/components/tiptap-templates/simple/simple-editor";
import { NotebookSidebar } from "../notebooks/NotebookSidebar";
import { NotebookStatusBar } from "../notebooks/NotebookStatusBar";
import { useNotebookStore } from "../notebooks/store";
import { docToMarkdown, markdownToDoc } from "../shared/markdown";

const DEFAULT_LEFT_WIDTH = 270;
const DEFAULT_RIGHT_WIDTH = 320;
const MIN_LEFT_WIDTH = 220;
const MAX_LEFT_WIDTH = 420;
const MIN_RIGHT_WIDTH = 260;
const MAX_RIGHT_WIDTH = 480;

function App() {
  const {
    isLoading,
    notebooks,
    activeNotebook,
    activeItem,
    activeConflict,
    syncState,
    chatMessages,
    toolEvents,
    agentRunState,
    isGenerating,
    loadNotebooks,
    createNotebook,
    createItem,
    setActiveNotebook,
    setActiveItem,
    updateActiveItemContent,
    setSelection,
    flushActiveNotebook,
    reloadConflictedItem,
    keepLocalAsNewCopy,
    sendChatMessage,
  } = useNotebookStore();
  const lastSerializedRef = useRef("");
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [chatInput, setChatInput] = useState("");

  const stats = useMemo(() => {
    const content = activeItem?.content ?? "";
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    return {
      words,
      characters: content.length,
    };
  }, [activeItem?.content]);
  const isActiveConflict = activeConflict?.itemId === activeItem?.id;

  const editor = useEditor({
    extensions: createSimpleEditorExtensions(),
    content: activeItem ? markdownToDoc(activeItem.content) : undefined,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Notebook item editor",
        class: "simple-editor",
      },
    },
    onUpdate: ({ editor: instance }) => {
      const markdown = docToMarkdown(instance.getJSON());
      lastSerializedRef.current = markdown;
      if (markdown !== activeItem?.content) {
        updateActiveItemContent(markdown);
      }
    },
    onSelectionUpdate: ({ editor: instance }) => {
      const { from, to } = instance.state.selection;
      const text = instance.state.doc.textBetween(from, to, "\n");
      if (!activeItem || from === to || !text.trim()) {
        setSelection(undefined);
        return;
      }

      setSelection({
        start: from,
        end: to,
        text,
        itemId: activeItem.id,
      });
    },
  });

  useEffect(() => {
    void loadNotebooks();
  }, [loadNotebooks]);

  useEffect(() => {
    if (!editor || !activeItem) {
      return;
    }

    if (lastSerializedRef.current === activeItem.content) {
      return;
    }

    editor.commands.setContent(markdownToDoc(activeItem.content), { emitUpdate: false });
    lastSerializedRef.current = activeItem.content;
  }, [editor, activeItem]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!isActiveConflict);
  }, [editor, isActiveConflict]);

  useEffect(() => {
    const handlePointerUp = () => {
      window.document.body.style.cursor = "";
      window.document.body.style.userSelect = "";
    };

    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      void flushActiveNotebook();
    };
    const handlePageHide = () => {
      void flushActiveNotebook();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [flushActiveNotebook]);

  const startResize = (side: "left" | "right") => (event: ReactPointerEvent<HTMLDivElement>) => {
    const startX = event.clientX;
    const startWidth = side === "left" ? leftWidth : rightWidth;

    window.document.body.style.cursor = "col-resize";
    window.document.body.style.userSelect = "none";

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (side === "left") {
        const nextWidth = Math.min(
          MAX_LEFT_WIDTH,
          Math.max(MIN_LEFT_WIDTH, startWidth + (moveEvent.clientX - startX)),
        );
        setLeftWidth(nextWidth);
      } else {
        const nextWidth = Math.min(
          MAX_RIGHT_WIDTH,
          Math.max(MIN_RIGHT_WIDTH, startWidth - (moveEvent.clientX - startX)),
        );
        setRightWidth(nextWidth);
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.document.body.style.cursor = "";
      window.document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const submitChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextMessage = chatInput.trim();
    if (!nextMessage) {
      return;
    }

    setChatInput("");
    await sendChatMessage(nextMessage);
  };

  const handleReloadConflict = async () => {
    if (!activeConflict) {
      return;
    }

    const confirmed = window.confirm(
      "Reloading will discard the current unsynced local changes for this item and restore the latest server version. Continue?",
    );
    if (!confirmed) {
      return;
    }

    await reloadConflictedItem();
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f6f6f8] font-sans text-slate-900">
      {!isLeftCollapsed ? (
        <>
          <aside className="shrink-0 border-r border-slate-200 bg-slate-50" style={{ width: leftWidth }}>
            <NotebookSidebar
              activeItemId={activeItem?.id}
              activeNotebookId={activeNotebook?.id}
              notebooks={notebooks}
              onCreateItem={(type) => void createItem(type)}
              onCreateNotebook={() => void createNotebook()}
              onSelectItem={setActiveItem}
              onSelectNotebook={setActiveNotebook}
            />
          </aside>
          <div
            className="w-1 shrink-0 cursor-col-resize bg-slate-200/70 transition-colors hover:bg-primary/40"
            onPointerDown={startResize("left")}
            role="separator"
          />
        </>
      ) : null}

      <main className="relative flex flex-1 flex-col bg-white">
        <div className="flex h-10 shrink-0 items-center border-b border-slate-200 bg-[#fbfbfc]">
          <div className="flex w-full items-center gap-2 px-3">
            {isLeftCollapsed ? (
              <button
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                onClick={() => setIsLeftCollapsed(false)}
                type="button"
              >
                <PanelLeftOpen size={15} />
              </button>
            ) : (
              <button
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                onClick={() => setIsLeftCollapsed(true)}
                type="button"
              >
                <PanelLeftClose size={15} />
              </button>
            )}

            <div className="min-w-0 max-w-[420px]">
              <div className="flex h-8 min-w-[160px] max-w-full items-center gap-2 rounded-t-md border border-b-0 border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <FileText size={14} className="shrink-0 text-slate-500" />
                <span className="truncate">{activeItem?.title ?? "Untitled"}</span>
              </div>
            </div>

            <div className="flex-1 self-end border-b border-slate-200" />

            {isRightCollapsed ? (
              <button
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                onClick={() => setIsRightCollapsed(false)}
                type="button"
              >
                <PanelRightOpen size={15} />
              </button>
            ) : null}
          </div>
        </div>

        {isActiveConflict && activeItem ? (
          <NotebookConflictBanner
            onKeepLocal={() => void keepLocalAsNewCopy()}
            onReload={() => void handleReloadConflict()}
            title={activeItem.title}
          />
        ) : null}

        <div className="min-h-0 flex-1 bg-white">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading notebook...</div>
          ) : activeItem ? (
            <div className={isActiveConflict ? "h-full bg-slate-50/70" : "h-full"}>
              <SimpleEditor editor={editor} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">No notebook item selected.</div>
          )}
        </div>

        <NotebookStatusBar
          characters={stats.characters}
          isDirty={activeItem?.isDirty ?? false}
          syncState={syncState}
          words={stats.words}
        />
      </main>

      {!isRightCollapsed ? (
        <>
          <div
            className="w-1 shrink-0 cursor-col-resize bg-slate-200/70 transition-colors hover:bg-primary/40"
            onPointerDown={startResize("right")}
            role="separator"
          />
          <aside className="flex shrink-0 flex-col border-l border-slate-200 bg-slate-50" style={{ width: rightWidth }}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-white/60 p-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-tight">AI Panel</h3>
                <p className="text-[11px] text-slate-400">
                  {agentRunState === "running"
                    ? "Collaborating on the active notebook item."
                    : "Notebook-aware chat and write-back are active."}
                </p>
              </div>
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                onClick={() => setIsRightCollapsed(true)}
                type="button"
              >
                <PanelRightClose size={15} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {chatMessages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-5 text-sm leading-relaxed text-slate-500">
                    Ask the assistant to revise the active draft, summarize notes, or pull context from other notebook items.
                  </div>
                ) : (
                  chatMessages.map((message) => (
                    <div
                      className={
                        message.role === "user"
                          ? "ml-6 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white"
                          : "mr-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                      }
                      key={message.id}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        <Bot size={12} />
                        <span>{message.role === "user" ? "You" : "Assistant"}</span>
                      </div>
                      <div className="whitespace-pre-wrap leading-6">
                        {message.content || (message.status === "streaming" ? "Thinking..." : "")}
                      </div>
                    </div>
                  ))
                )}

                {toolEvents.length > 0 ? (
                  <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Tool Activity</p>
                    {toolEvents.map((event) => (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600" key={event.id}>
                        <div className="font-semibold text-slate-700">{event.toolName}</div>
                        <div className="mt-1 truncate">{event.argsSummary || "No arguments preview"}</div>
                        <div className="mt-1 text-slate-400">{event.resultSummary || event.status}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <form className="border-t border-slate-200 bg-white/70 p-4" onSubmit={(event) => void submitChat(event)}>
                <textarea
                  className="min-h-[96px] w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary"
                  disabled={!activeItem || isGenerating || isActiveConflict}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder={
                    isActiveConflict
                      ? "Resolve the conflict before asking AI to edit this item..."
                      : "Ask AI to refine the active item or use notebook context..."
                  }
                  value={chatInput}
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-400">
                    {isActiveConflict
                      ? "AI collaboration is paused until this conflict is resolved."
                      : syncState === "saved"
                      ? "AI reads the latest synced notebook item."
                      : "AI chat waits for the current item to sync first."}
                  </p>
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!activeItem || isGenerating || isActiveConflict || !chatInput.trim()}
                    type="submit"
                  >
                    <SendHorizontal size={14} />
                    {isGenerating ? "Working..." : "Send"}
                  </button>
                </div>
              </form>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

export default App;
