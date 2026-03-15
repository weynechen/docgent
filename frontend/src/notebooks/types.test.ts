import { describe, expect, it } from "vitest";

import { emptyNotebookState } from "./types";

describe("notebook types", () => {
  it("starts with a saved sync state", () => {
    expect(emptyNotebookState.syncState).toBe("saved");
  });
});
