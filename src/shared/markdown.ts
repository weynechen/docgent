import type { JSONContent } from "@tiptap/react";

function paragraphNode(text: string): JSONContent {
  return {
    type: "paragraph",
    content: text
      ? [
          {
            type: "text",
            text,
          },
        ]
      : undefined,
  };
}

export function markdownToDoc(markdown: string): JSONContent {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const content: JSONContent[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];
  let codeBuffer: string[] = [];
  let inCode = false;

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) {
      return;
    }

    content.push(paragraphNode(paragraphBuffer.join(" ").trim()));
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (listBuffer.length === 0) {
      return;
    }

    content.push({
      type: "bulletList",
      content: listBuffer.map((item) => ({
        type: "listItem",
        content: [paragraphNode(item)],
      })),
    });
    listBuffer = [];
  };

  const flushCode = () => {
    if (codeBuffer.length === 0) {
      return;
    }

    content.push({
      type: "codeBlock",
      content: [
        {
          type: "text",
          text: codeBuffer.join("\n"),
        },
      ],
    });
    codeBuffer = [];
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCode) {
        flushCode();
      }
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      flushList();
      content.push({
        type: "heading",
        attrs: {
          level: headingMatch[1].length,
        },
        content: [
          {
            type: "text",
            text: headingMatch[2],
          },
        ],
      });
      continue;
    }

    const quoteMatch = /^>\s?(.*)$/.exec(line);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      content.push({
        type: "blockquote",
        content: [paragraphNode(quoteMatch[1])],
      });
      continue;
    }

    const listMatch = /^-\s+(.*)$/.exec(line);
    if (listMatch) {
      flushParagraph();
      listBuffer.push(listMatch[1]);
      continue;
    }

    paragraphBuffer.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushCode();

  return {
    type: "doc",
    content,
  };
}

function nodeText(node?: JSONContent): string {
  if (!node) {
    return "";
  }

  if (node.type === "text") {
    return node.text ?? "";
  }

  return (node.content ?? []).map(nodeText).join("");
}

function inlineText(node?: JSONContent): string {
  if (!node) {
    return "";
  }

  if (node.type === "text") {
    let value = node.text ?? "";
    const marks = node.marks ?? [];
    for (const mark of marks) {
      if (mark.type === "bold") {
        value = `**${value}**`;
      } else if (mark.type === "italic") {
        value = `*${value}*`;
      } else if (mark.type === "code") {
        value = `\`${value}\``;
      }
    }
    return value;
  }

  return (node.content ?? []).map(inlineText).join("");
}

export function docToMarkdown(doc: JSONContent | null | undefined): string {
  if (!doc?.content) {
    return "";
  }

  const blocks = doc.content.map((node) => {
    switch (node.type) {
      case "heading":
        return `${"#".repeat(node.attrs?.level ?? 1)} ${inlineText(node)}`;
      case "paragraph":
        return inlineText(node);
      case "blockquote":
        return node.content?.map((child) => `> ${inlineText(child)}`).join("\n") ?? "";
      case "bulletList":
        return (
          node.content
            ?.map((item) => {
              const firstParagraph = item.content?.find((child) => child.type === "paragraph");
              return `- ${inlineText(firstParagraph)}`;
            })
            .join("\n") ?? ""
        );
      case "codeBlock":
        return `\`\`\`\n${nodeText(node)}\n\`\`\``;
      default:
        return inlineText(node);
    }
  });

  return blocks.filter(Boolean).join("\n\n");
}
