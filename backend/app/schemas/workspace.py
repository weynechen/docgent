"""Schemas for temporary writing workspaces."""

from typing import Literal

from pydantic import Field

from app.schemas.base import BaseSchema


class WorkspaceCreateResponse(BaseSchema):
    """Response returned when a temporary workspace is created."""

    session_id: str = Field(alias="sessionId")


class WorkspaceEntry(BaseSchema):
    """A file or directory entry inside a workspace."""

    path: str
    name: str
    node_type: Literal["file", "directory"] = Field(alias="nodeType")


class WorkspaceTreeResponse(BaseSchema):
    """File tree listing for a workspace."""

    session_id: str = Field(alias="sessionId")
    entries: list[WorkspaceEntry]


class WorkspaceFileResponse(BaseSchema):
    """Current contents of a workspace file."""

    session_id: str = Field(alias="sessionId")
    path: str
    name: str
    content: str
    revision: int
    last_saved_at: int = Field(alias="lastSavedAt")


class WorkspaceFileUpdateRequest(BaseSchema):
    """Request payload for saving a workspace file."""

    doc_path: str = Field(alias="docPath")
    content: str
    base_revision: int = Field(alias="baseRevision", ge=0)
