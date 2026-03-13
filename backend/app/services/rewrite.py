"""In-memory rewrite run service with SSE replay support."""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from fastapi.encoders import jsonable_encoder

from app.agents.rewrite import RewriteSelectionAgent
from app.core.exceptions import BadRequestError
from app.schemas.rewrite import (
    RewriteDoneEvent,
    RewriteErrorEvent,
    RewriteRequest,
    RewriteResultEvent,
    RewriteRunResponse,
    RewriteStatus,
    RewriteStatusEvent,
    RewriteStreamEvent,
)

RUN_TTL_SECONDS = 5 * 60


@dataclass
class RewriteRun:
    """Runtime state for a rewrite request."""

    id: str
    events: list[RewriteStreamEvent] = field(default_factory=list)
    listeners: set[asyncio.Queue[RewriteStreamEvent | None]] = field(default_factory=set)
    finished: bool = False
    cleanup_handle: asyncio.TimerHandle | None = None


class RewriteRunService:
    """Manage rewrite runs, replayable events, and background execution."""

    def __init__(self, agent: RewriteSelectionAgent | None = None) -> None:
        self._agent = agent or RewriteSelectionAgent()
        self._runs: dict[str, RewriteRun] = {}

    def create_run(self, request: RewriteRequest, api_prefix: str) -> RewriteRunResponse:
        """Register a run and schedule processing."""

        if not request.selected_text.strip():
            raise BadRequestError(message="selectedText must not be empty")

        run_id = str(uuid4())
        self._runs[run_id] = RewriteRun(id=run_id)
        return RewriteRunResponse(
            requestId=run_id,
            streamPath=f"{api_prefix}/ai/rewrite/{run_id}/events",
        )

    def has_run(self, run_id: str) -> bool:
        """Return whether a run exists in the in-memory registry."""

        return run_id in self._runs

    async def process_run(self, run_id: str, request: RewriteRequest) -> None:
        try:
            self._publish_status(
                run_id,
                "collecting_context",
                "Collecting the selected passage and nearby context.",
            )
            self._publish_status(
                run_id,
                "rewriting",
                "The rewrite agent is generating and checking a candidate revision.",
            )
            suggestion = await self._agent.rewrite(request)
            suggestion.created_at = _now_ms()
            self._publish_status(
                run_id,
                "finalizing",
                "Preparing the final suggestion for review.",
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
                event = await queue.get()
                if event is None:
                    return
                yield _encode_sse_event(event)
                if _is_terminal_event(event):
                    return
        finally:
            run.listeners.discard(queue)

    def _publish_status(self, run_id: str, status: RewriteStatus, message: str) -> None:
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


def _now_ms() -> int:
    return int(time.time() * 1000)


def _is_terminal_event(event: RewriteStreamEvent) -> bool:
    return event.type in {"done", "error"}


def _encode_sse_event(event: RewriteStreamEvent) -> str:
    payload: dict[str, Any] = jsonable_encoder(event, by_alias=True)
    return f"data: {json.dumps(payload)}\n\n"


rewrite_run_service = RewriteRunService()
