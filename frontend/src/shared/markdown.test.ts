import { describe, expect, it } from "vitest";

import { docToMarkdown, markdownToDoc } from "./markdown";

describe("markdown conversion", () => {
  it("parses bold text inside bullet lists", () => {
    const doc = markdownToDoc("- item with **bold** text");
    const listItemParagraph = doc.content?.[0]?.content?.[0]?.content?.[0];
    const boldNode = listItemParagraph?.content?.[1];

    expect(listItemParagraph?.type).toBe("paragraph");
    expect(boldNode).toMatchObject({
      type: "text",
      text: "bold",
      marks: [{ type: "bold" }],
    });
  });

  it("parses horizontal rules", () => {
    const doc = markdownToDoc("Before\n\n---\n\nAfter");

    expect(doc.content?.[1]).toMatchObject({
      type: "horizontalRule",
    });
  });

  it("round-trips markdown tables", () => {
    const markdown = "| Name | Status |\n| --- | --- |\n| Doc | Ready |";
    const doc = markdownToDoc(markdown);

    expect(doc.content?.[0]).toMatchObject({
      type: "table",
    });
    expect(docToMarkdown(doc)).toBe(markdown);
  });
});
