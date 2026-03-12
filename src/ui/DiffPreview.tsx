import { buildDiff } from "../shared/diff";

interface DiffPreviewProps {
  original: string;
  suggested: string;
}

export function DiffPreview({ original, suggested }: DiffPreviewProps) {
  const diff = buildDiff(original, suggested);

  return (
    <div className="diff-preview">
      {diff.map(([op, text], index) => {
        if (!text) {
          return null;
        }

        const className =
          op === 1 ? "diff-added" : op === -1 ? "diff-removed" : "diff-unchanged";

        return (
          <span className={className} key={`${className}-${index}`}>
            {text}
          </span>
        );
      })}
    </div>
  );
}
