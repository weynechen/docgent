import type { EditRequest, EditSuggestion } from "../shared/types";

export interface AIProvider {
  rewriteSelection(input: EditRequest): Promise<EditSuggestion>;
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function rewriteWithInstruction(text: string, instruction: string) {
  const compact = normalizeWhitespace(text);
  const lowerInstruction = instruction.toLowerCase();

  if (!compact) {
    return text;
  }

  if (lowerInstruction.includes("short") || lowerInstruction.includes("精简")) {
    return compact
      .replace(/\breally\b/gi, "")
      .replace(/\bvery\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  if (lowerInstruction.includes("expand") || lowerInstruction.includes("扩展")) {
    return `${compact} This keeps the original point but adds one more sentence to clarify the practical impact for the reader.`;
  }

  if (lowerInstruction.includes("formal") || lowerInstruction.includes("正式")) {
    return compact.replace(/\bI want\b/gi, "The goal is").replace(/\bcan't\b/gi, "cannot");
  }

  if (lowerInstruction.includes("口语") || lowerInstruction.includes("casual")) {
    return compact.replace(/\bdo not\b/gi, "don't").replace(/\bdoes not\b/gi, "doesn't");
  }

  return compact
    .replace(/^([a-z])/i, (char) => char.toUpperCase())
    .replace(/\.$/, "")
    .concat(".")
    .replace("That context switching slows thinking down.", "That constant context switching breaks momentum and makes it harder to finish a draft.");
}

export const mockAIProvider: AIProvider = {
  async rewriteSelection(input) {
    await new Promise((resolve) => window.setTimeout(resolve, 800));

    const suggestedText = rewriteWithInstruction(input.selectedText, input.instruction);
    return {
      id: `suggestion-${Date.now()}`,
      suggestedText,
      explanation: "Suggestion keeps the original claim, improves clarity, and avoids inventing new facts.",
      createdAt: Date.now(),
      instruction: input.instruction,
    };
  },
};
