import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotebookSidebar } from "./NotebookSidebar";
import type { NotebookRecord } from "./types";

function makeNotebook(): NotebookRecord {
  return {
    id: "nb-1",
    title: "Untitled notebook",
    createdAt: "2026-03-16T00:00:00.000Z",
    updatedAt: "2026-03-16T00:00:00.000Z",
    sources: [],
    items: [
      {
        id: "item-1",
        notebookId: "nb-1",
        type: "draft",
        title: "Untitled",
        content: "",
        contentFormat: "markdown",
        orderIndex: 0,
        serverRevision: 1,
        isDirty: false,
      },
    ],
  };
}

function findByText(container: HTMLElement, text: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>("*")).find((element) => element.textContent?.trim() === text);
}

async function typeIntoInput(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function blurInput(input: HTMLInputElement) {
  await act(async () => {
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    input.blur();
  });
}

async function pressKey(target: HTMLElement, key: string) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

async function doubleClick(target: HTMLElement) {
  await act(async () => {
    target.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
}

function renderSidebar() {
  const notebook = makeNotebook();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onRenameNotebook = vi.fn(async () => undefined);
  const onRenameItem = vi.fn(async () => undefined);

  act(() => {
    root.render(
      <NotebookSidebar
        activeItemId="item-1"
        activeNotebookId="nb-1"
        notebooks={[notebook]}
        onCreateItem={() => undefined}
        onCreateNotebook={() => undefined}
        onCreateSource={() => undefined}
        onRenameItem={onRenameItem}
        onRenameNotebook={onRenameNotebook}
        onSelectItem={() => undefined}
        onSelectNotebook={() => undefined}
      />,
    );
  });

  return { container, root, onRenameNotebook, onRenameItem };
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

describe("NotebookSidebar", () => {
  it("enters notebook rename mode on double click and submits on Enter", async () => {
    const { container, root, onRenameNotebook } = renderSidebar();
    const title = findByText(container, "Untitled notebook");
    expect(title).toBeDefined();

    await doubleClick(title!);

    const input = container.querySelector('input[value="Untitled notebook"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    await typeIntoInput(input!, "Renamed notebook");
    await pressKey(input!, "Enter");

    expect(onRenameNotebook).toHaveBeenCalledWith("nb-1", "Renamed notebook");
    cleanup(root, container);
  });

  it("submits item rename on blur", async () => {
    const { container, root, onRenameItem } = renderSidebar();
    const title = findByText(container, "Untitled");
    expect(title).toBeDefined();

    await doubleClick(title!);

    const input = container.querySelector('input[value="Untitled"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    await typeIntoInput(input!, "Draft v2");
    await blurInput(input!);

    expect(onRenameItem).toHaveBeenCalledWith("item-1", "Draft v2");
    cleanup(root, container);
  });

  it("cancels item rename on Escape", async () => {
    const { container, root, onRenameItem } = renderSidebar();
    const title = findByText(container, "Untitled");
    expect(title).toBeDefined();

    await doubleClick(title!);

    const input = container.querySelector('input[value="Untitled"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    await typeIntoInput(input!, "Draft v2");
    await pressKey(input!, "Escape");

    expect(onRenameItem).not.toHaveBeenCalled();
    cleanup(root, container);
  });
});
