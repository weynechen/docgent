import { BookOpenText, NotebookPen, Plus } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import type { NotebookRecord } from "./types";

interface NotebookListSidebarProps {
  notebooks: NotebookRecord[];
  activeNotebookId?: string;
  onCreateNotebook: () => void;
  onEnterNotebook: (notebookId: string) => void;
  onRenameNotebook: (notebookId: string, title: string) => Promise<void>;
}

interface NotebookEditingState {
  id: string;
  value: string;
  initialValue: string;
}

function summarizeNotebook(notebook: NotebookRecord) {
  const itemCount = `${notebook.items.length} item${notebook.items.length === 1 ? "" : "s"}`;
  const sourceCount = `${notebook.sources.length} source${notebook.sources.length === 1 ? "" : "s"}`;
  return `${itemCount} · ${sourceCount}`;
}

export function NotebookListSidebar({
  notebooks,
  activeNotebookId,
  onCreateNotebook,
  onEnterNotebook,
  onRenameNotebook,
}: NotebookListSidebarProps) {
  const [editing, setEditing] = useState<NotebookEditingState | null>(null);

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

    await onRenameNotebook(pending.id, nextTitle);
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
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded bg-primary text-white">
            <NotebookPen size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold tracking-tight text-slate-800">Notebook Workspace</h2>
            <p className="text-[11px] text-slate-400">Choose a notebook, then step into its items and sources.</p>
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
        <div className="space-y-3">
          {notebooks.map((notebook) => {
            const isActive = notebook.id === activeNotebookId;

            if (editing?.id === notebook.id) {
              return (
                <div
                  className={isActive ? "rounded-2xl border border-primary/40 bg-primary/10 p-3" : "rounded-2xl border border-slate-200 bg-white p-3"}
                  key={notebook.id}
                >
                  <div className="flex items-center gap-2">
                    <BookOpenText size={15} className={isActive ? "text-primary" : "text-slate-400"} />
                    <input
                      autoFocus
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-700 outline-none focus:border-primary"
                      onBlur={() => void submitRename()}
                      onChange={(event) =>
                        setEditing((current) => (current ? { ...current, value: event.target.value } : current))
                      }
                      onFocus={(event) => event.currentTarget.select()}
                      onKeyDown={handleRenameKeyDown}
                      value={editing.value}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">{summarizeNotebook(notebook)}</p>
                </div>
              );
            }

            return (
              <button
                className={
                  isActive
                    ? "w-full rounded-2xl border border-primary/40 bg-primary/10 p-3 text-left"
                    : "w-full rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                }
                key={notebook.id}
                onClick={() => onEnterNotebook(notebook.id)}
                onDoubleClick={() =>
                  setEditing({
                    id: notebook.id,
                    value: notebook.title,
                    initialValue: notebook.title,
                  })
                }
                type="button"
              >
                <div className="flex items-start gap-3">
                  <div className={isActive ? "mt-0.5 rounded-lg bg-primary/15 p-2 text-primary" : "mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-500"}>
                    <BookOpenText size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{notebook.title}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{summarizeNotebook(notebook)}</p>
                    <p className="mt-3 text-[11px] font-medium text-slate-500">Open notebook</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
