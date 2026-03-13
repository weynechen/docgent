import type {
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

interface RewriteStreamHandlers {
  onStatus?: (event: RewriteStatusEvent) => void;
  onResult?: (event: RewriteResultEvent) => void;
  onError?: (event: RewriteErrorEvent) => void;
  onDone?: (event: RewriteDoneEvent) => void;
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

export async function startRewriteSelectionRun(
  input: EditRequest,
  handlers: RewriteStreamHandlers,
): Promise<() => void> {
  const response = await fetch("/api/v1/ai/rewrite/runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let message = "Failed to start rewrite request.";
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      message = payload.error?.message || message;
    } catch {
      const text = await response.text();
      message = text || message;
    }
    throw new Error(message);
  }

  const { requestId } = (await response.json()) as RewriteRunResponse;
  const eventSource = new EventSource(`/api/v1/ai/rewrite/${requestId}/events`);

  const close = () => {
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
        handlers.onError?.(parsed);
        close();
        break;
      case "done":
        handlers.onDone?.(parsed);
        close();
        break;
    }
  };

  eventSource.onerror = () => {
    handlers.onError?.({
      type: "error",
      runId: requestId,
      code: "stream_disconnected",
      message: "Connection to the backend AI service was interrupted.",
      createdAt: Date.now(),
    });
    close();
  };

  return close;
}
