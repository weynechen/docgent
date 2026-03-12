import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignLeft,
  ArrowUp,
  AtSign,
  Bold,
  FileEdit,
  FileText,
  Folder,
  History,
  Italic,
  Link as LinkIcon,
  List,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Plus,
  Save,
  Settings,
  Sparkles,
} from "lucide-react";
import { useWorkspaceStore } from "./store";
import { docToMarkdown, markdownToDoc } from "../shared/markdown";

const DEFAULT_LEFT_WIDTH = 250;
const DEFAULT_RIGHT_WIDTH = 320;
const MIN_LEFT_WIDTH = 180;
const MAX_LEFT_WIDTH = 420;
const MIN_RIGHT_WIDTH = 260;
const MAX_RIGHT_WIDTH = 480;

function App() {
  const {
    docs,
    activeDoc,
    activeDocPath,
    selection,
    currentSuggestion,
    isGenerating,
    versions,
    selectedVersionId,
    notice,
    lastAppliedChange,
    loadWorkspace,
    setActiveDoc,
    updateActiveDocContent,
    saveActiveDoc,
    setSelection,
    clearSuggestion,
    requestSuggestion,
    applySuggestion,
    rejectSuggestion,
    createVersion,
    loadVersions,
    selectVersion,
  } = useWorkspaceStore();
  const [instruction, setInstruction] = useState("");
  const lastSerializedRef = useRef("");
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  const stats = useMemo(() => {
    const content = activeDoc?.content ?? "";
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    return {
      words,
      characters: content.length,
    };
  }, [activeDoc?.content]);

  const selectedLineCount = useMemo(() => {
    if (!selection?.text) {
      return 0;
    }

    return selection.text.split(/\n/).filter((line) => line.trim()).length;
  }, [selection?.text]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: activeDoc ? markdownToDoc(activeDoc.content) : undefined,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-slate max-w-none text-lg leading-relaxed text-slate-700 focus:outline-none min-h-[520px]",
      },
    },
    onSelectionUpdate: ({ editor: instance }) => {
      if (!activeDocPath) {
        return;
      }

      const { from, to } = instance.state.selection;
      if (from === to) {
        setSelection(undefined);
        clearSuggestion();
        return;
      }

      const text = instance.state.doc.textBetween(from, to, "\n");
      setSelection({
        from: from - 1,
        to: to - 1,
        text,
        docPath: activeDocPath,
      });
    },
    onUpdate: ({ editor: instance }) => {
      const markdown = docToMarkdown(instance.getJSON());
      lastSerializedRef.current = markdown;
      if (markdown !== activeDoc?.content) {
        updateActiveDocContent(markdown);
      }
    },
  });

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!editor || !activeDoc) {
      return;
    }

    if (lastSerializedRef.current === activeDoc.content) {
      return;
    }

    editor.commands.setContent(markdownToDoc(activeDoc.content), { emitUpdate: false });
    lastSerializedRef.current = activeDoc.content;
  }, [editor, activeDoc]);

  useEffect(() => {
    if (!activeDocPath) {
      return;
    }

    void loadVersions(activeDocPath);
  }, [activeDocPath, loadVersions]);

  useEffect(() => {
    const handlePointerUp = () => {
      window.document.body.style.cursor = "";
      window.document.body.style.userSelect = "";
    };

    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, []);

  const handleRequestSuggestion = async (nextInstruction?: string) => {
    const content = nextInstruction ?? instruction;
    if (!content.trim()) {
      return;
    }

    setInstruction(content);
    await requestSuggestion(content);
  };

  const handleApplySuggestion = async () => {
    if (!editor || !currentSuggestion) {
      return;
    }

    const applied = await applySuggestion(({ from, to, text }) =>
      editor.chain().focus().insertContentAt({ from: from + 1, to: to + 1 }, text).run(),
    );

    if (applied) {
      await createVersion("AI rewrite applied", "ai");
    }
  };

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
    <div className="flex h-screen w-full bg-[#f6f6f8] text-slate-900 font-sans overflow-hidden">
      {!isLeftCollapsed ? (
        <>
          <aside
            className="border-r border-slate-200 flex flex-col bg-slate-50 shrink-0"
            style={{ width: leftWidth }}
          >
        <div className="p-4 flex items-center gap-3 border-b border-slate-200">
          <div className="bg-primary size-8 rounded flex items-center justify-center text-white">
            <FileEdit size={20} />
          </div>
          <h2 className="font-bold text-sm tracking-tight">Lexicon AI</h2>
          <button
            className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            onClick={() => setIsLeftCollapsed(true)}
            type="button"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-6">
          <section>
            <div className="px-3 mb-2 flex items-center justify-between mt-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Documents</span>
              <button
                className="text-slate-400 hover:text-primary transition-colors"
                onClick={() => void createVersion("Manual snapshot", "manual")}
                type="button"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-0.5">
              <div className="group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-default">
                <Folder size={18} className="text-slate-400" />
                <span className="text-sm font-medium">Drafts</span>
              </div>
              <div className="pl-6 space-y-0.5 border-l border-slate-200 ml-4">
                {docs.map((doc) => (
                  <button
                    className={
                      doc.path === activeDocPath
                        ? "flex w-full items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary cursor-pointer border-l-2 border-primary -ml-[1px]"
                        : "group flex w-full items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-200/50 transition-colors"
                    }
                    key={doc.path}
                    onClick={() => void setActiveDoc(doc.path)}
                    type="button"
                  >
                    <FileText size={18} className={doc.path === activeDocPath ? "" : "text-slate-400"} />
                    <span
                      className={
                        doc.path === activeDocPath
                          ? "text-sm font-semibold truncate"
                          : "text-sm text-slate-600 truncate"
                      }
                    >
                      {doc.name.replace(".md", "")}
                    </span>
                  </button>
                ))}
              </div>
              <div className="group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-default">
                <Folder size={18} className="text-slate-400" />
                <span className="text-sm font-medium">Research</span>
              </div>
            </div>
          </section>

          <section>
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Version History</span>
              <History size={16} className="text-slate-300" />
            </div>
            <div className="space-y-0.5">
              {versions.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-slate-400">No saved versions yet.</div>
              ) : (
                versions.slice(0, 6).map((version) => (
                  <button
                    className={
                      version.id === selectedVersionId
                        ? "group flex w-full flex-col items-start px-3 py-2 rounded-lg bg-slate-200/70 transition-colors"
                        : "group flex w-full flex-col items-start px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-200/50 transition-colors"
                    }
                    key={version.id}
                    onClick={() => selectVersion(version.id)}
                    type="button"
                  >
                    <span className="text-xs font-medium">{version.title ?? "Untitled version"}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(version.createdAt).toLocaleString()}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-100">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              JD
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold truncate">John Doe</p>
              <p className="text-[10px] text-slate-400">Local Workspace</p>
            </div>
            <button className="text-slate-400 hover:text-slate-600" onClick={() => void saveActiveDoc()} type="button">
              <Settings size={16} />
            </button>
          </div>
        </div>
          </aside>
          <div
            className="w-1 shrink-0 cursor-col-resize bg-slate-200/70 transition-colors hover:bg-primary/40"
            onPointerDown={startResize("left")}
            role="separator"
          />
        </>
      ) : null}

      <main className="flex-1 flex flex-col bg-white relative">
        <div className="h-10 shrink-0 border-b border-slate-200 bg-[#fbfbfc] flex items-center">
          <div className="flex w-full items-center gap-2 px-3">
            {isLeftCollapsed ? (
              <button
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                onClick={() => setIsLeftCollapsed(false)}
                type="button"
              >
                <PanelLeftOpen size={15} />
              </button>
            ) : null}

            <div className="min-w-0 max-w-[420px]">
              <button
                className="flex h-8 min-w-[160px] max-w-full items-center gap-2 rounded-t-md border border-b-0 border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                type="button"
              >
                <FileText size={14} className="shrink-0 text-slate-500" />
                <span className="truncate">{activeDoc?.name ?? "Untitled.md"}</span>
              </button>
            </div>

            <div className="flex-1 border-b border-slate-200 self-end" />

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

        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-white/80 backdrop-blur-md border border-slate-200 p-1 rounded-xl shadow-sm opacity-40 hover:opacity-100 transition-opacity">
          <button
            className={`p-1.5 rounded hover:bg-slate-100 text-slate-600${editor?.isActive("bold") ? " bg-slate-100" : ""}`}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            type="button"
          >
            <Bold size={16} />
          </button>
          <button
            className={`p-1.5 rounded hover:bg-slate-100 text-slate-600${editor?.isActive("italic") ? " bg-slate-100" : ""}`}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            type="button"
          >
            <Italic size={16} />
          </button>
          <button className="p-1.5 rounded hover:bg-slate-100 text-slate-300" type="button">
            <LinkIcon size={16} />
          </button>
          <div className="w-px h-4 bg-slate-200 mx-1"></div>
          <button
            className={`p-1.5 rounded hover:bg-slate-100 text-slate-600${editor?.isActive("bulletList") ? " bg-slate-100" : ""}`}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            type="button"
          >
            <List size={16} />
          </button>
          <button
            className="p-1.5 rounded hover:bg-primary/10 text-primary"
            onClick={() =>
              void handleRequestSuggestion(
                instruction || "Make this clearer while preserving the original judgment.",
              )
            }
            type="button"
          >
            <Sparkles size={16} />
          </button>
        </div>

        <div className="max-w-[800px] w-full mx-auto px-12 py-24 h-full overflow-y-auto custom-scrollbar">
          <input
            className="w-full text-4xl font-bold border-none focus:outline-none focus:ring-0 bg-transparent mb-12 placeholder:text-slate-300"
            type="text"
            readOnly
            value={activeDoc?.name.replace(".md", "") ?? ""}
          />
          <EditorContent editor={editor} />
        </div>

        <footer className="border-t border-slate-100 px-12 py-2 flex justify-between items-center text-[10px] text-slate-400 gap-4">
          <div className="flex gap-4">
            <span>{stats.words} words</span>
            <span>{stats.characters} characters</span>
          </div>
          <div className="flex gap-3 items-center min-w-0">
            {notice ? (
              <span className="truncate rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] text-slate-500 shadow-sm">
                {notice.message}
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${activeDoc?.isDirty ? "bg-amber-500" : "bg-emerald-500"}`}></span>
              {activeDoc?.isDirty ? "Unsaved changes" : "Saved locally"}
            </span>
            {lastAppliedChange ? <span>AI updated {new Date(lastAppliedChange.appliedAt).toLocaleTimeString()}</span> : null}
            <button className="inline-flex items-center gap-1 text-slate-500 hover:text-primary" onClick={() => void saveActiveDoc()} type="button">
              <Save size={12} />
              Save
            </button>
          </div>
        </footer>
      </main>

      {!isRightCollapsed ? (
        <>
          <div
            className="w-1 shrink-0 cursor-col-resize bg-slate-200/70 transition-colors hover:bg-primary/40"
            onPointerDown={startResize("right")}
            role="separator"
          />
          <aside
            className="border-l border-slate-200 bg-slate-50 flex flex-col shrink-0"
            style={{ width: rightWidth }}
          >
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white/50">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-tight">AI Chat</h3>
          </div>
          <button
            className="text-slate-400 cursor-pointer hover:text-slate-600"
            onClick={() => setIsRightCollapsed(true)}
            type="button"
          >
            <PanelRightClose size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          <div className="space-y-6">
            {selection ? (
              <div className="flex gap-3 justify-end">
                <div className="max-w-[85%] bg-white border border-slate-200 shadow-sm p-3 rounded-xl rounded-tr-sm">
                  <p className="text-xs text-slate-700 font-medium italic">"{selection.text}"</p>
                  <p className="text-xs text-slate-500 mt-2">
                    {instruction || "Make this clearer while preserving the original judgment."}
                  </p>
                </div>
              </div>
            ) : null}

            {currentSuggestion ? (
              <div className="flex gap-3">
                <div className="size-6 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <Sparkles size={14} />
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-xs leading-relaxed text-slate-600">Here is a revised version:</p>
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <p className="text-xs text-emerald-800 italic whitespace-pre-wrap">
                      "{currentSuggestion.suggestedText}"
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button className="text-[11px] font-bold text-primary hover:underline" onClick={() => void handleApplySuggestion()} type="button">
                      Apply
                    </button>
                    <button className="text-[11px] font-bold text-slate-400 hover:underline" onClick={() => rejectSuggestion()} type="button">
                      Discard
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="mb-3 flex items-center">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] text-slate-500 font-medium">
              <AlignLeft size={12} />
              {selection ? `${selectedLineCount} lines selected` : "No selection"}
            </div>
          </div>
          <div className="relative flex items-end gap-2">
            <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
              <textarea
                className="w-full p-3 text-xs bg-transparent border-none focus:outline-none focus:ring-0 resize-none placeholder:text-slate-400 min-h-[44px] max-h-32"
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="Ask or type command..."
                rows={1}
                value={instruction}
              ></textarea>
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex gap-1">
                  <button className="p-1.5 rounded hover:bg-slate-100 text-slate-400" type="button">
                    <Paperclip size={14} />
                  </button>
                  <button className="p-1.5 rounded hover:bg-slate-100 text-slate-400" type="button">
                    <AtSign size={14} />
                  </button>
                </div>
                <button
                  className="bg-primary text-white p-1.5 rounded-lg hover:opacity-90 transition-opacity shadow-sm disabled:opacity-40"
                  disabled={isGenerating || !selection}
                  onClick={() => void handleRequestSuggestion()}
                  type="button"
                >
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

export default App;
