"""Workspace-backed rewrite run service with SSE replay support."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from fastapi.encoders import jsonable_encoder

from app.agents.rewrite import RewriteSelectionAgent
from app.core.exceptions import BadRequestError
from app.core.logging import bind_log_context, get_log_context, log_event
from app.schemas.rewrite import (
    RewriteApplyResponse,
    RewriteDoneEvent,
    RewriteErrorEvent,
    RewriteRequest,
    RewriteResultEvent,
    RewriteRunResponse,
    RewriteStatus,
    RewriteStatusEvent,
    RewriteStreamEvent,
    RewriteSuggestion,
)
from app.services.workspace import WorkspaceService, workspace_service as default_workspace_service

RUN_TTL_SECONDS = 5 * 60
STREAM_HEARTBEAT_SECONDS = 10
logger = logging.getLogger(__name__)


@dataclass
class RewriteRun:
    """Runtime state for a rewrite request."""

    id: str
    session_id: str
    doc_path: str
    events: list[RewriteStreamEvent] = field(default_factory=list)
    listeners: set[asyncio.Queue[RewriteStreamEvent | None]] = field(default_factory=set)
    finished: bool = False
    cleanup_handle: asyncio.TimerHandle | None = None
    log_context: dict[str, str | None] = field(default_factory=dict)
    suggestion: RewriteSuggestion | None = None


class RewriteRunService:
    """Manage reviewable rewrite runs over a backend workspace."""

    def __init__(
        self,
        agent: RewriteSelectionAgent | None = None,
        workspace_service: WorkspaceService | None = None,
    ) -> None:
        self._agent = agent or RewriteSelectionAgent()
        self._workspace_service = workspace_service or default_workspace_service
        self._runs: dict[str, RewriteRun] = {}

    def create_run(self, request: RewriteRequest, api_prefix: str) -> RewriteRunResponse:
        """Register a run and validate its workspace context."""

        file = self._workspace_service.read_file(request.session_id, request.doc_path)
        selected_text = self._workspace_service.get_plain_text_slice(
            request.session_id,
            request.doc_path,
            request.selection_start,
            request.selection_end,
        )
        if not selected_text.strip():
            raise BadRequestError(message="Selection must not be empty.", code="EMPTY_SELECTION")

        run_id = str(uuid4())
        self._runs[run_id] = RewriteRun(
            id=run_id,
            session_id=request.session_id,
            doc_path=request.doc_path,
            log_context=get_log_context(),
        )
        log_event(
            logger,
            logging.INFO,
            "rewrite.run.accepted",
            "Rewrite run accepted",
            run_id=run_id,
            session_id=request.session_id,
            doc_path=request.doc_path,
            instruction_length=len(request.instruction),
            selected_text_length=len(selected_text),
            base_revision=file.revision,
        )
        return RewriteRunResponse(
            requestId=run_id,
            streamPath=f"{api_prefix}/workspaces/{request.session_id}/agent/runs/{run_id}/events",
        )

    def has_run(self, run_id: str, session_id: str | None = None) -> bool:
        """Return whether a run exists, optionally scoped to a workspace session."""

        run = self._runs.get(run_id)
        if run is None:
            return False
        return session_id is None or run.session_id == session_id

    async def process_run(self, run_id: str, request: RewriteRequest) -> None:
        run = self._runs[run_id]
        with bind_log_context(**run.log_context):
            try:
                file = self._workspace_service.read_file(request.session_id, request.doc_path)
                selected_text = self._workspace_service.get_plain_text_slice(
                    request.session_id,
                    request.doc_path,
                    request.selection_start,
                    request.selection_end,
                )
                log_event(
                    logger,
                    logging.INFO,
                    "rewrite.run.started",
                    "Rewrite processing started",
                    run_id=run_id,
                    session_id=request.session_id,
                    doc_path=request.doc_path,
                )
                self._publish_status(
                    run_id,
                    "collecting_context",
                    "Collecting the selected passage from the workspace file.",
                )
                self._publish_status(
                    run_id,
                    "rewriting",
                    "The rewrite agent is generating a full-document candidate revision.",
                )
                suggestion = await self._agent.rewrite(
                    request,
                    full_markdown=file.content,
                    selected_plain_text=selected_text,
                    base_revision=file.revision,
                )
                suggestion.created_at = _now_ms()
                run.suggestion = suggestion
                self._publish_status(
                    run_id,
                    "finalizing",
                    "Preparing the reviewable Markdown diff.",
                )
                self._publish(
                    run_id,
                    RewriteResultEvent(
                        runId=run_id,
                        suggestion=suggestion,
                        createdAt=_now_ms(),
                    ),
                )
                self._publish(run_id, RewriteDoneEvent(runId=run_id, createdAt=_now_ms()))
                log_event(
                    logger,
                    logging.INFO,
                    "rewrite.run.completed",
                    "Rewrite processing completed",
                    run_id=run_id,
                    provider=suggestion.provider,
                    model=suggestion.model,
                    doc_path=request.doc_path,
                )
            except Exception as exc:
                message = str(exc) or "Unknown rewrite error."
                code = getattr(exc, "code", "REWRITE_FAILED")
                self._publish(
                    run_id,
                    RewriteErrorEvent(
                        runId=run_id,
                        code=str(code).lower(),
                        message=message,
                        createdAt=_now_ms(),
                    ),
                )
                log_event(
                    logger,
                    logging.ERROR,
                    "rewrite.run.failed",
                    "Rewrite processing failed",
                    run_id=run_id,
                    session_id=request.session_id,
                    doc_path=request.doc_path,
                    error_code=str(code).lower(),
                    exception_type=type(exc).__name__,
                )

    def apply_run(self, session_id: str, run_id: str) -> RewriteApplyResponse:
        """Apply a completed candidate edit back into the workspace."""

        run = self._get_run(run_id, session_id)
        if run.suggestion is None or not run.suggestion.proposed_edits:
            raise BadRequestError(message="Rewrite run has no candidate edits to apply.")

        edit = run.suggestion.proposed_edits[0]
        file = self._workspace_service.write_file(
            session_id,
            edit.doc_path,
            edit.after_markdown,
            edit.base_revision,
        )
        return RewriteApplyResponse(
            runId=run_id,
            docPath=edit.doc_path,
            revision=file.revision,
            content=file.content,
            appliedAt=_now_ms(),
        )

    def discard_run(self, session_id: str, run_id: str) -> None:
        """Discard a completed candidate rewrite."""

        self._get_run(run_id, session_id)
        self._runs.pop(run_id, None)

    async def stream_events(self, run_id: str) -> AsyncIterator[str]:
        """Yield SSE-formatted events for a run, including replay."""

        run = self._runs.get(run_id)
        if run is None:
            raise BadRequestError(message="Unknown rewrite request.", code="UNKNOWN_RUN")

        queue: asyncio.Queue[RewriteStreamEvent | None] = asyncio.Queue()
        run.listeners.add(queue)
        try:
            yield ": connected\n\n"
            for event in run.events:
                yield _encode_sse_event(event)

            if run.finished:
                return

            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=STREAM_HEARTBEAT_SECONDS)
                except TimeoutError:
                    yield ": heartbeat\n\n"
                    continue
                if event is None:
                    return
                yield _encode_sse_event(event)
                if _is_terminal_event(event):
                    return
        finally:
            run.listeners.discard(queue)

    def _publish_status(self, run_id: str, status: RewriteStatus, message: str) -> None:
        log_event(
            logger,
            logging.INFO,
            "rewrite.run.status_updated",
            "Rewrite status updated",
            run_id=run_id,
            status=status,
        )
        self._publish(
            run_id,
            RewriteStatusEvent(
                runId=run_id,
                status=status,
                message=message,
                createdAt=_now_ms(),
            ),
        )

    def _publish(self, run_id: str, event: RewriteStreamEvent) -> None:
        run = self._runs[run_id]
        run.events.append(event)

        for queue in list(run.listeners):
            queue.put_nowait(event)

        if _is_terminal_event(event):
            run.finished = True
            for queue in list(run.listeners):
                queue.put_nowait(None)
            self._schedule_cleanup(run)

    def _schedule_cleanup(self, run: RewriteRun) -> None:
        if run.cleanup_handle is not None:
            run.cleanup_handle.cancel()

        loop = asyncio.get_running_loop()
        run.cleanup_handle = loop.call_later(RUN_TTL_SECONDS, self._runs.pop, run.id, None)
        log_event(
            logger,
            logging.INFO,
            "rewrite.run.cleanup_scheduled",
            "Rewrite cleanup scheduled",
            run_id=run.id,
            ttl_seconds=RUN_TTL_SECONDS,
        )

    def _get_run(self, run_id: str, session_id: str) -> RewriteRun:
        run = self._runs.get(run_id)
        if run is None or run.session_id != session_id:
            raise BadRequestError(message="Unknown rewrite request.", code="UNKNOWN_RUN")
        return run


def _now_ms() -> int:
    return int(time.time() * 1000)


def _is_terminal_event(event: RewriteStreamEvent) -> bool:
    return event.type in {"done", "error"}


def _encode_sse_event(event: RewriteStreamEvent) -> str:
    payload: dict[str, Any] = jsonable_encoder(event, by_alias=True)
    return f"data: {json.dumps(payload)}\n\n"


rewrite_run_service = RewriteRunService(workspace_service=default_workspace_service)
