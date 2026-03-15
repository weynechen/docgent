import { BookOpenText, FilePenLine, FileText, FolderPen, Link2, NotebookPen, Plus } from "lucide-react";

import type { NotebookRecord } from "./types";

interface NotebookSidebarProps {
  notebooks: NotebookRecord[];
  activeNotebookId?: string;
  activeItemId?: string;
  onCreateNotebook: () => void;
  onCreateItem: (type: "draft" | "note") => void;
  onCreateSource: () => void;
  onSelectNotebook: (notebookId: string) => void;
  onSelectItem: (itemId: string) => void;
}

export function NotebookSidebar({
  notebooks,
  activeNotebookId,
  activeItemId,
  onCreateNotebook,
  onCreateItem,
  onCreateSource,
  onSelectNotebook,
  onSelectItem,
}: NotebookSidebarProps) {
  const activeNotebook = notebooks.find((entry) => entry.id === activeNotebookId);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded bg-primary text-white">
            <NotebookPen size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold tracking-tight text-slate-800">Notebook Workspace</h2>
            <p className="text-[11px] text-slate-400">Drafts and text notes live together.</p>
          </div>
        </div>
        <button
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
          onClick={onCreateNotebook}
          type="button"
        >
          <Plus size={14} />
          New notebook
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {notebooks.map((notebook) => (
            <button
              className={
                notebook.id === activeNotebookId
                  ? "w-full rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-left"
                  : "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300"
              }
              key={notebook.id}
              onClick={() => onSelectNotebook(notebook.id)}
              type="button"
            >
              <div className="flex items-center gap-2">
                <BookOpenText size={15} className={notebook.id === activeNotebookId ? "text-primary" : "text-slate-400"} />
                <span className="truncate text-sm font-semibold text-slate-700">{notebook.title}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">{notebook.items.length} items</p>
            </button>
          ))}
        </div>

        {activeNotebook ? (
          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Items</span>
              <div className="flex items-center gap-1">
                <button
                  className="rounded-md p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                  onClick={() => onCreateItem("draft")}
                  title="New draft"
                  type="button"
                >
                  <FilePenLine size={14} />
                </button>
                <button
                  className="rounded-md p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                  onClick={() => onCreateItem("note")}
                  title="New note"
                  type="button"
                >
                  <FolderPen size={14} />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {activeNotebook.items.map((item) => (
                <button
                  className={
                    item.id === activeItemId
                      ? "flex w-full items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-left text-white"
                      : "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-600 transition hover:bg-slate-200/60"
                  }
                  key={item.id}
                  onClick={() => onSelectItem(item.id)}
                  type="button"
                >
                  <FileText size={14} className={item.id === activeItemId ? "text-white" : "text-slate-400"} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className={item.id === activeItemId ? "text-[10px] text-slate-300" : "text-[10px] text-slate-400"}>
                      {item.type === "draft" ? "Draft" : "Note"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {activeNotebook ? (
          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Sources</span>
              <button
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                onClick={onCreateSource}
                title="Add external link"
                type="button"
              >
                <Link2 size={14} />
              </button>
            </div>
            <div className="space-y-1">
              {activeNotebook.sources.length > 0 ? (
                activeNotebook.sources.map((source) => (
                  <div
                    className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                    key={source.id}
                  >
                    <Link2 size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{source.title}</p>
                      <p className="truncate text-[10px] text-slate-400">
                        {source.type === "external_link" ? source.sourceUrl ?? "External link" : source.title}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-3 py-3 text-[11px] text-slate-400">
                  Add links now. File imports will attach to the same source lane later.
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
