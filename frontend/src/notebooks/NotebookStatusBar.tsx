import type { NotebookSyncState } from "./types";

interface NotebookStatusBarProps {
  syncState: NotebookSyncState;
  isDirty: boolean;
  words: number;
  characters: number;
}

function statusCopy(syncState: NotebookSyncState, isDirty: boolean) {
  if (syncState === "saving") {
    return "Saving...";
  }
  if (syncState === "offline") {
    return "Offline changes";
  }
  if (syncState === "sync_failed") {
    return "Sync failed";
  }
  if (syncState === "conflict") {
    return "Conflict";
  }
  return isDirty ? "Unsaved local changes" : "Saved";
}

function statusDot(syncState: NotebookSyncState, isDirty: boolean) {
  if (syncState === "offline") {
    return "bg-amber-500";
  }
  if (syncState === "sync_failed" || syncState === "conflict") {
    return "bg-rose-500";
  }
  if (syncState === "saving" || isDirty) {
    return "bg-sky-500";
  }
  return "bg-emerald-500";
}

export function NotebookStatusBar({ syncState, isDirty, words, characters }: NotebookStatusBarProps) {
  return (
    <footer className="flex items-center justify-between gap-4 border-t border-slate-100 px-12 py-2 text-[10px] text-slate-400">
      <div className="flex gap-4">
        <span>{words} words</span>
        <span>{characters} characters</span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${statusDot(syncState, isDirty)}`}></span>
        <span>{statusCopy(syncState, isDirty)}</span>
      </div>
    </footer>
  );
}
