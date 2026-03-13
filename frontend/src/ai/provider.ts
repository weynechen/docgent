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
