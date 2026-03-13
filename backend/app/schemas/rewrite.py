"""Schemas for workspace-based rewrite flows."""

from typing import Literal

from pydantic import Field

from app.schemas.base import BaseSchema

RewriteStatus = Literal["collecting_context", "rewriting", "finalizing"]


class RewriteRequest(BaseSchema):
    """Request payload for a workspace rewrite run."""

    session_id: str = Field(min_length=1, alias="sessionId")
    doc_path: str = Field(min_length=1, alias="docPath")
    selection_start: int = Field(alias="selectionStart", ge=0)
    selection_end: int = Field(alias="selectionEnd", ge=0)
    instruction: str = Field(min_length=1)


class ProposedEdit(BaseSchema):
    """A reviewable document change proposed by the agent."""

    doc_path: str = Field(alias="docPath")
    before_markdown: str = Field(alias="beforeMarkdown")
    after_markdown: str = Field(alias="afterMarkdown")
    selection_start: int = Field(alias="selectionStart", ge=0)
    selection_end: int = Field(alias="selectionEnd", ge=0)
    base_revision: int = Field(alias="baseRevision", ge=0)
    change_summary: str = Field(alias="changeSummary")


class RewriteSuggestion(BaseSchema):
    """Candidate rewrite result returned to the client."""

    id: str
    explanation: str | None = None
    created_at: int = Field(alias="createdAt")
    instruction: str
    provider: str | None = None
    model: str | None = None
    proposed_edits: list[ProposedEdit] = Field(alias="proposedEdits")


class RewriteRunResponse(BaseSchema):
    """Response returned when a rewrite run is accepted."""

    request_id: str = Field(alias="requestId")
    stream_path: str = Field(alias="streamPath")


class RewriteApplyResponse(BaseSchema):
    """Response returned when a candidate rewrite is applied."""

    run_id: str = Field(alias="runId")
    doc_path: str = Field(alias="docPath")
    revision: int
    content: str
    applied_at: int = Field(alias="appliedAt")


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
