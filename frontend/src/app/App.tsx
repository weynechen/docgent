import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useEditor } from "@tiptap/react";
import { FileText, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

import { SimpleEditor, createSimpleEditorExtensions } from "@/components/tiptap-templates/simple/simple-editor";
import { docToMarkdown, markdownToDoc } from "../shared/markdown";
import { NotebookSidebar } from "../notebooks/NotebookSidebar";
import { NotebookStatusBar } from "../notebooks/NotebookStatusBar";
import { useNotebookStore } from "../notebooks/store";

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
    syncState,
    loadNotebooks,
    createNotebook,
    createItem,
    setActiveNotebook,
    setActiveItem,
    updateActiveItemContent,
    flushActiveNotebook,
  } = useNotebookStore();
  const lastSerializedRef = useRef("");
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  const stats = useMemo(() => {
    const content = activeItem?.content ?? "";
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    return {
      words,
      characters: content.length,
    };
  }, [activeItem?.content]);

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

        <div className="flex-1 min-h-0 bg-white">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading notebook...</div>
          ) : activeItem ? (
            <SimpleEditor editor={editor} />
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
                <p className="text-[11px] text-slate-400">Notebook-aware AI wiring is the next migration step.</p>
              </div>
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                onClick={() => setIsRightCollapsed(true)}
                type="button"
              >
                <PanelRightClose size={15} />
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-[240px] rounded-2xl border border-dashed border-slate-300 bg-white/80 p-5 text-sm leading-relaxed text-slate-500">
                Current focus is notebook creation, editing, and reliable save semantics. AI chat will move to notebook item context after the save pipeline is in place.
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

export default App;
