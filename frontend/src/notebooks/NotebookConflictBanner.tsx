import { AlertTriangle, CopyPlus, RotateCcw } from "lucide-react";

interface NotebookConflictBannerProps {
  title: string;
  onReload: () => void;
  onKeepLocal: () => void;
}

export function NotebookConflictBanner({
  title,
  onReload,
  onKeepLocal,
}: NotebookConflictBannerProps) {
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-5 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
            <AlertTriangle size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">Conflict detected in “{title}”.</p>
            <p className="text-xs leading-5 text-amber-800">
              The server version changed. Reload the latest server content, or save your local changes as a new draft copy before continuing.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-full bg-amber-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-950"
            onClick={onReload}
            type="button"
          >
            <RotateCcw size={14} />
            Reload server version
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-900 hover:border-amber-400"
            onClick={onKeepLocal}
            type="button"
          >
            <CopyPlus size={14} />
            Keep local as new copy
          </button>
        </div>
      </div>
    </div>
  );
}
