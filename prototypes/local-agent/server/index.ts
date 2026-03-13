import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { runRewriteAgent } from "./rewrite-agent.js";
import type { EditRequest, RewriteStreamEvent } from "../../../frontend/src/shared/types.js";

interface RewriteRun {
  id: string;
  events: RewriteStreamEvent[];
  listeners: Set<ServerResponse>;
  finished: boolean;
  cleanupTimer?: NodeJS.Timeout;
}

const PORT = Number(process.env.AI_AGENT_PORT ?? 8787);
const RUN_TTL_MS = 5 * 60 * 1000;
const runs = new Map<string, RewriteRun>();

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendSseEvent(response: ServerResponse, payload: RewriteStreamEvent) {
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function ensureRun(runId: string): RewriteRun {
  let run = runs.get(runId);
  if (run) {
    return run;
  }

  run = {
    id: runId,
    events: [],
    listeners: new Set(),
    finished: false,
  };
  runs.set(runId, run);
  return run;
}

function scheduleCleanup(run: RewriteRun) {
  if (run.cleanupTimer) {
    clearTimeout(run.cleanupTimer);
  }

  run.cleanupTimer = setTimeout(() => {
    runs.delete(run.id);
  }, RUN_TTL_MS);
}

function publishRunEvent(runId: string, event: RewriteStreamEvent) {
  const run = ensureRun(runId);
  run.events.push(event);

  if (event.type === "error") {
    process.stderr.write(`[rewrite-agent] ${runId} ${event.code}: ${event.message}\n`);
  }

  for (const listener of run.listeners) {
    sendSseEvent(listener, event);
  }

  if (event.type === "done" || event.type === "error") {
    run.finished = true;
    for (const listener of run.listeners) {
      listener.end();
    }
    run.listeners.clear();
    scheduleCleanup(run);
  }
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf-8");
  return JSON.parse(raw) as T;
}

function isEditRequest(value: unknown): value is EditRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<EditRequest>;
  return (
    typeof candidate.docPath === "string" &&
    typeof candidate.selectedText === "string" &&
    typeof candidate.instruction === "string"
  );
}

async function handleRewriteRequest(request: IncomingMessage, response: ServerResponse) {
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    sendJson(response, 400, { message: "Invalid JSON payload." });
    return;
  }

  if (!isEditRequest(body)) {
    sendJson(response, 400, { message: "Missing rewrite request fields." });
    return;
  }

  const input: EditRequest = {
    docPath: body.docPath,
    selectedText: body.selectedText,
    instruction: body.instruction,
    documentTitle: typeof body.documentTitle === "string" ? body.documentTitle : undefined,
    beforeText: typeof body.beforeText === "string" ? body.beforeText : undefined,
    afterText: typeof body.afterText === "string" ? body.afterText : undefined,
  };

  const runId = crypto.randomUUID();
  ensureRun(runId);

  void runRewriteAgent(runId, input, (event) => publishRunEvent(runId, event));
  sendJson(response, 202, { requestId: runId });
}

function handleRewriteEvents(request: IncomingMessage, response: ServerResponse, runId: string) {
  const run = runs.get(runId);
  if (!run) {
    sendJson(response, 404, { message: "Unknown rewrite request." });
    return;
  }

  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  response.write(": connected\n\n");
  for (const event of run.events) {
    sendSseEvent(response, event);
  }

  if (run.finished) {
    response.end();
    return;
  }

  run.listeners.add(response);
  request.on("close", () => {
    run.listeners.delete(response);
  });
}

const server = createServer(async (request, response) => {
  if (!request.url || !request.method) {
    sendJson(response, 404, { message: "Not found." });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? "127.0.0.1"}`);

  if (request.method === "POST" && url.pathname === "/api/ai/rewrite") {
    await handleRewriteRequest(request, response);
    return;
  }

  const eventMatch = /^\/api\/ai\/rewrite\/([^/]+)\/events$/.exec(url.pathname);
  if (request.method === "GET" && eventMatch) {
    handleRewriteEvents(request, response, eventMatch[1]);
    return;
  }

  sendJson(response, 404, { message: "Not found." });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`pi rewrite agent listening on http://127.0.0.1:${PORT}\n`);
});
