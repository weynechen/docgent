import { Type, type Tool, stream, type AssistantMessage, type Model } from "@mariozechner/pi-ai";
import type { EditRequest, EditSuggestion, RewriteStatus, RewriteStreamEvent } from "../src/shared/types.js";

const MAX_CONTEXT_CHARS = 280;

const submitRewriteTool: Tool = {
  name: "submit_rewrite",
  description: "Return the final rewrite suggestion for the current selection.",
  parameters: Type.Object({
    suggestedText: Type.String({ minLength: 1 }),
    explanation: Type.String({ minLength: 1 }),
  }),
};

const rewriteSystemPrompt = [
  "You are a precise writing rewrite agent inside a docs-as-code editor.",
  "Your job is to improve the selected passage while preserving the user's meaning and factual claims.",
  "Use the surrounding context only to preserve continuity, not to expand scope.",
  "Prefer clarity, tighter wording, and smoother flow.",
  "Do not add new facts, references, or claims that are not implied by the selected text.",
  "When you are ready, call submit_rewrite exactly once with the final rewritten text and a short explanation.",
  "Never rewrite text outside the selected passage.",
].join(" ");

function createModel(): { model: Model<"openai-completions">; apiKey: string } {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  return {
    apiKey,
    model: {
      id: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      name: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      api: "openai-completions",
      provider: "openai-compatible",
      baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      compat: {
        supportsDeveloperRole: false,
      },
      reasoning: true,
      input: ["text"],
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
      contextWindow: 128000,
      maxTokens: 8192,
    },
  };
}

function trimContext(text: string | undefined): string {
  if (!text) {
    return "";
  }

  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= MAX_CONTEXT_CHARS) {
    return compact;
  }

  return compact.slice(-MAX_CONTEXT_CHARS);
}

function trimAfterContext(text: string | undefined): string {
  if (!text) {
    return "";
  }

  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= MAX_CONTEXT_CHARS) {
    return compact;
  }

  return compact.slice(0, MAX_CONTEXT_CHARS);
}

function createUserPrompt(input: EditRequest): string {
  return [
    `Document title: ${input.documentTitle ?? input.docPath}`,
    `Instruction: ${input.instruction}`,
    `Selected text:\n${input.selectedText}`,
    `Before context:\n${trimContext(input.beforeText) || "(none)"}`,
    `After context:\n${trimAfterContext(input.afterText) || "(none)"}`,
  ].join("\n\n");
}

function createStatusEvent(runId: string, status: RewriteStatus, message: string): RewriteStreamEvent {
  return {
    type: "status",
    runId,
    status,
    message,
    createdAt: Date.now(),
  };
}

function createResultEvent(
  runId: string,
  suggestion: EditSuggestion,
): RewriteStreamEvent {
  return {
    type: "result",
    runId,
    suggestion,
    createdAt: Date.now(),
  };
}

function createDoneEvent(runId: string): RewriteStreamEvent {
  return {
    type: "done",
    runId,
    createdAt: Date.now(),
  };
}

function createErrorEvent(runId: string, code: string, message: string): RewriteStreamEvent {
  return {
    type: "error",
    runId,
    code,
    message,
    createdAt: Date.now(),
  };
}

function getToolSuggestion(message: AssistantMessage, instruction: string): EditSuggestion | undefined {
  const toolCall = message.content.find(
    (item) => item.type === "toolCall" && item.name === "submit_rewrite",
  );

  if (!toolCall || toolCall.type !== "toolCall") {
    return undefined;
  }

  const suggestedText = String(toolCall.arguments.suggestedText ?? "").trim();
  const explanation = String(toolCall.arguments.explanation ?? "").trim();
  if (!suggestedText) {
    return undefined;
  }

  return {
    id: toolCall.id,
    suggestedText,
    explanation,
    createdAt: Date.now(),
    instruction,
    provider: message.provider,
    model: message.model,
  };
}

function getTextFallbackSuggestion(message: AssistantMessage, instruction: string): EditSuggestion | undefined {
  const text = message.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("")
    .trim();

  if (!text) {
    return undefined;
  }

  return {
    id: `fallback-${Date.now()}`,
    suggestedText: text,
    explanation: "Returned as plain text because the model did not call the submit_rewrite tool.",
    createdAt: Date.now(),
    instruction,
    provider: message.provider,
    model: message.model,
  };
}

export async function runRewriteAgent(
  runId: string,
  input: EditRequest,
  publish: (event: RewriteStreamEvent) => void,
): Promise<void> {
  try {
    publish(createStatusEvent(runId, "collecting_context", "Collecting the selected passage and nearby context."));

    const { model, apiKey } = createModel();
    const eventStream = stream(
      model,
      {
        systemPrompt: rewriteSystemPrompt,
        messages: [
          {
            role: "user",
            content: createUserPrompt(input),
            timestamp: Date.now(),
          },
        ],
        tools: [submitRewriteTool],
      },
      {
        apiKey,
        reasoning: "medium",
        maxTokens: 900,
        temperature: 0.3,
      },
    );

    let didPublishRewrite = false;
    let didPublishFinalize = false;
    let failedMessage: string | undefined;

    for await (const event of eventStream) {
      if (event.type === "error") {
        failedMessage = event.error.errorMessage || "The model request failed before producing a suggestion.";
        break;
      }

      if (!didPublishRewrite && (event.type === "thinking_start" || event.type === "text_start" || event.type === "toolcall_start")) {
        publish(createStatusEvent(runId, "rewriting", "The rewrite agent is generating and checking a candidate revision."));
        didPublishRewrite = true;
      }

      if (event.type === "toolcall_end" && event.toolCall.name === "submit_rewrite" && !didPublishFinalize) {
        publish(createStatusEvent(runId, "finalizing", "Preparing the final suggestion for review."));
        didPublishFinalize = true;
      }
    }

    if (failedMessage) {
      publish(createErrorEvent(runId, "model_request_failed", failedMessage));
      return;
    }

    const message = await eventStream.result();
    const suggestion =
      getToolSuggestion(message, input.instruction) ?? getTextFallbackSuggestion(message, input.instruction);

    if (!didPublishRewrite) {
      publish(createStatusEvent(runId, "rewriting", "The rewrite agent completed without streaming intermediate output."));
    }

    if (!didPublishFinalize) {
      publish(createStatusEvent(runId, "finalizing", "Preparing the final suggestion for review."));
    }

    if (!suggestion) {
      publish(createErrorEvent(runId, "empty_result", "The rewrite agent returned no suggestion."));
      return;
    }

    publish(createResultEvent(runId, suggestion));
    publish(createDoneEvent(runId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown rewrite error.";
    publish(createErrorEvent(runId, "rewrite_failed", message));
  }
}
