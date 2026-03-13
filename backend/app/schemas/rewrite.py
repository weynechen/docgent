"""Schemas for selection rewrite flows."""

from typing import Literal

from pydantic import Field

from app.schemas.base import BaseSchema

RewriteStatus = Literal["collecting_context", "rewriting", "finalizing"]


class RewriteRequest(BaseSchema):
    """Request payload for a selection rewrite run."""

    doc_path: str = Field(min_length=1, alias="docPath")
    selected_text: str = Field(min_length=1, alias="selectedText")
    instruction: str = Field(min_length=1)
    document_title: str | None = Field(default=None, alias="documentTitle")
    before_text: str | None = Field(default=None, alias="beforeText")
    after_text: str | None = Field(default=None, alias="afterText")
    target_platform: str | None = Field(default=None, alias="targetPlatform")


class RewriteSuggestion(BaseSchema):
    """Final rewrite suggestion returned to the client."""

    id: str
    suggested_text: str = Field(alias="suggestedText")
    explanation: str | None = None
    created_at: int = Field(alias="createdAt")
    instruction: str
    provider: str | None = None
    model: str | None = None


class RewriteRunResponse(BaseSchema):
    """Response returned when a rewrite run is accepted."""

    request_id: str = Field(alias="requestId")
    stream_path: str = Field(alias="streamPath")


class RewriteStatusEvent(BaseSchema):
    """Intermediate status update."""

    type: Literal["status"] = "status"
    run_id: str = Field(alias="runId")
    status: RewriteStatus
    message: str
    created_at: int = Field(alias="createdAt")


class RewriteResultEvent(BaseSchema):
    """Final result event."""

    type: Literal["result"] = "result"
    run_id: str = Field(alias="runId")
    suggestion: RewriteSuggestion
    created_at: int = Field(alias="createdAt")


class RewriteErrorEvent(BaseSchema):
    """Failure event."""

    type: Literal["error"] = "error"
    run_id: str = Field(alias="runId")
    code: str
    message: str
    created_at: int = Field(alias="createdAt")


class RewriteDoneEvent(BaseSchema):
    """Completion event."""

    type: Literal["done"] = "done"
    run_id: str = Field(alias="runId")
    created_at: int = Field(alias="createdAt")


RewriteStreamEvent = RewriteStatusEvent | RewriteResultEvent | RewriteErrorEvent | RewriteDoneEvent
