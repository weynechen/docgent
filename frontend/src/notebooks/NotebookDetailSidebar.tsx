import { FilePenLine, FileText, FolderPen, Link2 } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import type { NotebookItemRecord, NotebookRecord } from "./types";

interface NotebookDetailSidebarProps {
  notebook: NotebookRecord;
  activeItemId?: string;
  onCreateItem: (type: "draft" | "note") => void;
  onRenameItem: (itemId: string, title: string) => Promise<void>;
  onCreateSource: () => void;
  onSelectItem: (itemId: string) => void;
}

interface ItemEditingState {
  id: string;
  value: string;
  initialValue: string;
}

export function NotebookDetailSidebar({
  notebook,
  activeItemId,
  onCreateItem,
  onRenameItem,
  onCreateSource,
  onSelectItem,
}: NotebookDetailSidebarProps) {
  const [editing, setEditing] = useState<ItemEditingState | null>(null);

  const beginItemRename = (item: NotebookItemRecord) => {
    setEditing({
      id: item.id,
      value: item.title,
      initialValue: item.title,
    });
  };

  const submitRename = async () => {
    if (!editing) {
      return;
    }

    const nextTitle = editing.value.trim();
    const pending = editing;
    setEditing(null);

    if (!nextTitle || nextTitle === pending.initialValue) {
      return;
    }

    await onRenameItem(pending.id, nextTitle);
  };

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitRename();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setEditing(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Notebook Contents</p>
        <p className="mt-1 text-xs text-slate-500">Items and sources live inside the current notebook.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <section>
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
            {notebook.items.map((item) => (
              editing?.id === item.id ? (
                <div
                  className={
                    item.id === activeItemId
                      ? "flex w-full items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-left text-white"
                      : "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-600"
                  }
                  key={item.id}
                >
                  <FileText size={14} className={item.id === activeItemId ? "text-white" : "text-slate-400"} />
                  <div className="min-w-0 flex-1">
                    <input
                      autoFocus
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-700 outline-none focus:border-primary"
                      onBlur={() => void submitRename()}
                      onChange={(event) =>
                        setEditing((current) => (current ? { ...current, value: event.target.value } : current))
                      }
                      onFocus={(event) => event.currentTarget.select()}
                      onKeyDown={handleRenameKeyDown}
                      value={editing.value}
                    />
                    <p className={item.id === activeItemId ? "mt-1 text-[10px] text-slate-300" : "mt-1 text-[10px] text-slate-400"}>
                      {item.type === "draft" ? "Draft" : "Note"}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  className={
                    item.id === activeItemId
                      ? "flex w-full items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-left text-white"
                      : "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-600 transition hover:bg-slate-200/60"
                  }
                  key={item.id}
                  onClick={() => onSelectItem(item.id)}
                  onDoubleClick={() => beginItemRename(item)}
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
              )
            ))}
          </div>
        </section>

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
            {notebook.sources.length > 0 ? (
              notebook.sources.map((source) => (
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
      </div>
    </div>
  );
}
