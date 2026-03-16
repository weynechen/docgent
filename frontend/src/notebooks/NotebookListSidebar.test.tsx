import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotebookListSidebar } from "./NotebookListSidebar";
import type { NotebookRecord } from "./types";

function makeNotebook(id: string, title: string): NotebookRecord {
  return {
    id,
    title,
    createdAt: "2026-03-16T00:00:00.000Z",
    updatedAt: "2026-03-16T00:00:00.000Z",
    sources: [
      {
        id: `${id}-source-1`,
        notebookId: id,
        type: "external_link",
        title: "Reference",
        sourceUrl: "https://example.com/reference",
        mimeType: null,
        createdAt: "2026-03-16T00:00:00.000Z",
        updatedAt: null,
      },
    ],
    items: [
      {
        id: `${id}-item-1`,
        notebookId: id,
        type: "draft",
        title: `${title} draft`,
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

async function doubleClick(target: HTMLElement) {
  await act(async () => {
    target.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
}

async function pressKey(target: HTMLElement, key: string) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
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
  const onEnterNotebook = vi.fn();
  const onRenameNotebook = vi.fn(async () => undefined);

  act(() => {
    root.render(
      <NotebookListSidebar
        activeNotebookId="nb-1"
        notebooks={[makeNotebook("nb-1", "LLM"), makeNotebook("nb-2", "Agents")]}
        onCreateNotebook={() => undefined}
        onEnterNotebook={onEnterNotebook}
        onRenameNotebook={onRenameNotebook}
      />,
    );
  });

  return { container, onEnterNotebook, onRenameNotebook, root };
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

describe("NotebookListSidebar", () => {
  it("shows notebook cards without leaking item and source sections", () => {
    const { container, root } = renderSidebar();

    expect(findByText(container, "LLM")).toBeDefined();
    expect(findByText(container, "Agents")).toBeDefined();
    expect(findByText(container, "LLM draft")).toBeUndefined();
    expect(findByText(container, "Items")).toBeUndefined();
    expect(findByText(container, "Sources")).toBeUndefined();

    cleanup(root, container);
  });

  it("opens the selected notebook", async () => {
    const { container, onEnterNotebook, root } = renderSidebar();
    const card = findByText(container, "Agents");

    await act(async () => {
      card?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onEnterNotebook).toHaveBeenCalledWith("nb-2");
    cleanup(root, container);
  });

  it("renames a notebook from the list view", async () => {
    const { container, onRenameNotebook, root } = renderSidebar();
    const title = findByText(container, "LLM");
    expect(title).toBeDefined();

    await doubleClick(title!);

    const input = container.querySelector('input[value="LLM"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    await typeIntoInput(input!, "LLM notes");
    await pressKey(input!, "Enter");

    expect(onRenameNotebook).toHaveBeenCalledWith("nb-1", "LLM notes");
    cleanup(root, container);
  });
});
