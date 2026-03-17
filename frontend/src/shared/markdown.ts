type JSONMark = {
  type: string;
};

type JSONContent = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: JSONMark[];
  content?: JSONContent[];
};

function textNode(text: string, marks?: NonNullable<JSONContent["marks"]>): JSONContent {
  return {
    type: "text",
    text,
    ...(marks ? { marks } : {}),
  };
}

function parseInline(text: string): JSONContent[] | undefined {
  if (!text) {
    return undefined;
  }

  const content: JSONContent[] = [];
  const tokenPattern = /(\*\*[^*]+?\*\*|`[^`]+?`|\*[^*]+?\*)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const matchText = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      content.push(textNode(text.slice(lastIndex, start)));
    }

    if (matchText.startsWith("**") && matchText.endsWith("**")) {
      content.push(textNode(matchText.slice(2, -2), [{ type: "bold" }]));
    } else if (matchText.startsWith("`") && matchText.endsWith("`")) {
      content.push(textNode(matchText.slice(1, -1), [{ type: "code" }]));
    } else if (matchText.startsWith("*") && matchText.endsWith("*")) {
      content.push(textNode(matchText.slice(1, -1), [{ type: "italic" }]));
    } else {
      content.push(textNode(matchText));
    }

    lastIndex = start + matchText.length;
  }

  if (lastIndex < text.length) {
    content.push(textNode(text.slice(lastIndex)));
  }

  return content.length > 0 ? content : undefined;
}

function paragraphNode(text: string): JSONContent {
  return {
    type: "paragraph",
    content: parseInline(text),
  };
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = parseTableRow(line);
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell))
  );
}

function createTableCell(type: "tableCell" | "tableHeader", text: string): JSONContent {
  return {
    type,
    content: [paragraphNode(text)],
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

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

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

    const nextLine = lines[index + 1];
    if (line.includes("|") && nextLine && isTableSeparator(nextLine)) {
      flushParagraph();
      flushList();

      const headerCells = parseTableRow(line);
      const rowNodes: JSONContent[] = [
        {
          type: "tableRow",
          content: headerCells.map((cell) => createTableCell("tableHeader", cell)),
        },
      ];

      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        rowNodes.push({
          type: "tableRow",
          content: parseTableRow(lines[index]).map((cell) => createTableCell("tableCell", cell)),
        });
        index += 1;
      }
      index -= 1;

      content.push({
        type: "table",
        content: rowNodes,
      });
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
        content: parseInline(headingMatch[2]),
      });
      continue;
    }

    const horizontalRuleMatch = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.exec(line);
    if (horizontalRuleMatch) {
      flushParagraph();
      flushList();
      content.push({
        type: "horizontalRule",
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
        return `${"#".repeat(typeof node.attrs?.level === "number" ? node.attrs.level : 1)} ${inlineText(node)}`;
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
      case "horizontalRule":
        return "---";
      case "table":
        return (
          node.content
            ?.map((row, rowIndex) => {
              const cells =
                row.content?.map((cell) => inlineText(cell.content?.[0])).join(" | ") ?? "";
              const line = `| ${cells} |`;
              if (rowIndex !== 0) {
                return line;
              }

              const separatorCells = row.content?.map(() => "---").join(" | ") ?? "";
              return `${line}\n| ${separatorCells} |`;
            })
            .join("\n") ?? ""
        );
      default:
        return inlineText(node);
    }
  });

  return blocks.filter(Boolean).join("\n\n");
}
