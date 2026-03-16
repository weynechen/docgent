import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotebookDetailSidebar } from "./NotebookDetailSidebar";
import type { NotebookRecord } from "./types";

function makeNotebook(): NotebookRecord {
  return {
    id: "nb-1",
    title: "LLM",
    createdAt: "2026-03-16T00:00:00.000Z",
    updatedAt: "2026-03-16T00:00:00.000Z",
    sources: [
      {
        id: "source-1",
        notebookId: "nb-1",
        type: "external_link",
        title: "Reference link",
        sourceUrl: "https://example.com/reference",
        mimeType: null,
        createdAt: "2026-03-16T00:00:00.000Z",
        updatedAt: null,
      },
    ],
    items: [
      {
        id: "item-1",
        notebookId: "nb-1",
        type: "draft",
        title: "Browser Rename Item",
        content: "",
        contentFormat: "markdown",
        orderIndex: 0,
        serverRevision: 1,
        isDirty: false,
      },
      {
        id: "item-2",
        notebookId: "nb-1",
        type: "note",
        title: "Research excerpt",
        content: "",
        contentFormat: "markdown",
        orderIndex: 1,
        serverRevision: 1,
        isDirty: false,
      },
    ],
  };
}

function findByText(container: HTMLElement, text: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>("*")).find((element) => element.textContent?.trim() === text);
}

async function doubleClick(target: HTMLElement) {
  await act(async () => {
    target.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
}

async function blurInput(input: HTMLInputElement) {
  await act(async () => {
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    input.blur();
  });
}

async function typeIntoInput(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function renderSidebar() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onRenameItem = vi.fn(async () => undefined);

  act(() => {
    root.render(
      <NotebookDetailSidebar
        activeItemId="item-1"
        notebook={makeNotebook()}
        onCreateItem={() => undefined}
        onCreateSource={() => undefined}
        onRenameItem={onRenameItem}
        onSelectItem={() => undefined}
      />,
    );
  });

  return { container, onRenameItem, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("NotebookDetailSidebar", () => {
  it("shows only the current notebook contents", () => {
    const { container, root } = renderSidebar();

    expect(findByText(container, "Items")).toBeDefined();
    expect(findByText(container, "Sources")).toBeDefined();
    expect(findByText(container, "Browser Rename Item")).toBeDefined();
    expect(findByText(container, "Research excerpt")).toBeDefined();
    expect(findByText(container, "Reference link")).toBeDefined();
    expect(findByText(container, "LLM")).toBeUndefined();

    cleanup(root, container);
  });

  it("submits item rename on blur", async () => {
    const { container, onRenameItem, root } = renderSidebar();
    const title = findByText(container, "Browser Rename Item");
    expect(title).toBeDefined();

    await doubleClick(title!);

    const input = container.querySelector('input[value="Browser Rename Item"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    await typeIntoInput(input!, "Draft v2");
    await blurInput(input!);

    expect(onRenameItem).toHaveBeenCalledWith("item-1", "Draft v2");
    cleanup(root, container);
  });
});
