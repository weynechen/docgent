import type {
  AgentChatRequest,
  AgentCompleteEvent,
  AgentConversationCreatedEvent,
  AgentErrorEvent,
  AgentFinalResultEvent,
  AgentModelRequestStartEvent,
  AgentNotebookItemUpdatedEvent,
  AgentSocketEvent,
  AgentTextDeltaEvent,
  AgentToolCallEvent,
  AgentToolResultEvent,
  AgentUserPromptEvent,
  AgentWorkspaceFileUpdatedEvent,
  EditRequest,
  RewriteDoneEvent,
  RewriteErrorEvent,
  RewriteResultEvent,
  RewriteStatusEvent,
  RewriteStreamEvent,
} from "../shared/types";

interface RewriteRunResponse {
  requestId: string;
}

interface RewriteApplyResponse {
  runId: string;
  docPath: string;
  revision: number;
  content: string;
  appliedAt: number;
}

interface RewriteStreamHandlers {
  onStatus?: (event: RewriteStatusEvent) => void;
  onResult?: (event: RewriteResultEvent) => void;
  onError?: (event: RewriteErrorEvent) => void;
  onDone?: (event: RewriteDoneEvent) => void;
}

interface AgentChatHandlers {
  onConversationCreated?: (event: AgentConversationCreatedEvent) => void;
  onUserPrompt?: (event: AgentUserPromptEvent) => void;
  onModelRequestStart?: (event: AgentModelRequestStartEvent) => void;
  onTextDelta?: (event: AgentTextDeltaEvent) => void;
  onToolCall?: (event: AgentToolCallEvent) => void;
  onToolResult?: (event: AgentToolResultEvent) => void;
  onWorkspaceFileUpdated?: (event: AgentWorkspaceFileUpdatedEvent) => void;
  onNotebookItemUpdated?: (event: AgentNotebookItemUpdatedEvent) => void;
  onFinalResult?: (event: AgentFinalResultEvent) => void;
  onComplete?: (event: AgentCompleteEvent) => void;
  onError?: (event: AgentErrorEvent) => void;
}

function isRewriteStreamEvent(value: unknown): value is RewriteStreamEvent {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }

  const event = value as { type?: unknown };
  return (
    event.type === "status" ||
    event.type === "result" ||
    event.type === "error" ||
    event.type === "done"
  );
}

async function parseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message || fallback;
  } catch {
    const text = await response.text();
    return text || fallback;
  }
}

function isAgentSocketEvent(value: unknown): value is AgentSocketEvent {
  if (!value || typeof value !== "object" || !("type" in value) || !("data" in value)) {
    return false;
  }

  const event = value as { type?: unknown };
  return (
    event.type === "conversation_created" ||
    event.type === "user_prompt" ||
    event.type === "model_request_start" ||
    event.type === "text_delta" ||
    event.type === "tool_call" ||
    event.type === "tool_result" ||
    event.type === "workspace_file_updated" ||
    event.type === "notebook_item_updated" ||
    event.type === "final_result" ||
    event.type === "complete" ||
    event.type === "error"
  );
}

function getWebSocketUrl(path: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

export async function startRewriteSelectionRun(
  input: EditRequest,
  handlers: RewriteStreamHandlers,
): Promise<{ runId: string; close: () => void }> {
  const response = await fetch(`/api/v1/workspaces/${input.sessionId}/agent/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to start rewrite request."));
  }

  const { requestId } = (await response.json()) as RewriteRunResponse;
  const eventSource = new EventSource(`/api/v1/workspaces/${input.sessionId}/agent/runs/${requestId}/events`);
  let settled = false;

  const close = () => {
    settled = true;
    eventSource.close();
  };

  eventSource.onmessage = (event) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data) as unknown;
    } catch {
      handlers.onError?.({
        type: "error",
        runId: requestId,
        code: "invalid_event",
        message: "Received an invalid event from the backend AI service.",
        createdAt: Date.now(),
      });
      close();
      return;
    }

    if (!isRewriteStreamEvent(parsed)) {
      handlers.onError?.({
        type: "error",
        runId: requestId,
        code: "unexpected_event",
        message: "Received an unsupported event from the backend AI service.",
        createdAt: Date.now(),
      });
      close();
      return;
    }

    switch (parsed.type) {
      case "status":
        handlers.onStatus?.(parsed);
        break;
      case "result":
        handlers.onResult?.(parsed);
        break;
      case "error":
        settled = true;
        handlers.onError?.(parsed);
        close();
        break;
      case "done":
        settled = true;
        handlers.onDone?.(parsed);
        close();
        break;
    }
  };

  eventSource.onerror = () => {
    if (settled) {
      return;
    }

    handlers.onError?.({
      type: "error",
      runId: requestId,
      code: "stream_disconnected",
      message: "Connection to the backend AI service was interrupted.",
      createdAt: Date.now(),
    });
    close();
  };

  return { runId: requestId, close };
}

export async function applyRewriteRun(sessionId: string, runId: string): Promise<RewriteApplyResponse> {
  const response = await fetch(`/api/v1/workspaces/${sessionId}/agent/runs/${runId}/apply`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to apply rewrite suggestion."));
  }
  return (await response.json()) as RewriteApplyResponse;
}

export async function discardRewriteRun(sessionId: string, runId: string): Promise<void> {
  const response = await fetch(`/api/v1/workspaces/${sessionId}/agent/runs/${runId}/discard`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to discard rewrite suggestion."));
  }
}

export async function startAgentChatRun(
  input: AgentChatRequest,
  handlers: AgentChatHandlers,
): Promise<{ close: () => void }> {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(getWebSocketUrl("/api/v1/ws/agent"));
    let settled = false;

    const close = () => {
      settled = true;
      socket.close();
    };

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          message: input.message,
          history: input.history,
          conversation_id: input.conversationId,
          session_id: input.sessionId,
          doc_path: input.docPath,
          notebook_id: input.notebookId,
          item_id: input.itemId,
          selection: input.selection,
        }),
      );
      resolve({ close });
    };

    socket.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data) as unknown;
      } catch {
        handlers.onError?.({
          type: "error",
          data: {
            message: "Received an invalid event from the backend agent service.",
          },
        });
        close();
        return;
      }

      if (!isAgentSocketEvent(parsed)) {
        handlers.onError?.({
          type: "error",
          data: {
            message: "Received an unsupported event from the backend agent service.",
          },
        });
        close();
        return;
      }

      switch (parsed.type) {
        case "conversation_created":
          handlers.onConversationCreated?.(parsed);
          break;
        case "user_prompt":
          handlers.onUserPrompt?.(parsed);
          break;
        case "model_request_start":
          handlers.onModelRequestStart?.(parsed);
          break;
        case "text_delta":
          handlers.onTextDelta?.(parsed);
          break;
        case "tool_call":
          handlers.onToolCall?.(parsed);
          break;
        case "tool_result":
          handlers.onToolResult?.(parsed);
          break;
        case "workspace_file_updated":
          handlers.onWorkspaceFileUpdated?.(parsed);
          break;
        case "notebook_item_updated":
          handlers.onNotebookItemUpdated?.(parsed);
          break;
        case "final_result":
          handlers.onFinalResult?.(parsed);
          break;
        case "complete":
          handlers.onComplete?.(parsed);
          close();
          break;
        case "error":
          handlers.onError?.(parsed);
          close();
          break;
      }
    };

    socket.onerror = () => {
      if (settled) {
        return;
      }
      reject(
        new Error(
          "Failed to connect to the backend agent service. Make sure the backend server is running and the dev proxy forwards WebSocket requests.",
        ),
      );
    };

    socket.onclose = () => {
      if (settled) {
        return;
      }
      handlers.onError?.({
        type: "error",
        data: {
          message: "Connection to the backend agent service was interrupted.",
        },
      });
    };
  });
}
