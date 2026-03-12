declare module "diff-match-patch" {
  export type Diff = [number, string];

  export class diff_match_patch {
    diff_main(text1: string, text2: string): Diff[];
    diff_cleanupSemantic(diffs: Diff[]): void;
  }
}
