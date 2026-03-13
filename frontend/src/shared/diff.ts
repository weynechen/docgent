import { diff_match_patch, type Diff } from "diff-match-patch";

export function buildDiff(oldText: string, newText: string): Diff[] {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);
  return diffs;
}
