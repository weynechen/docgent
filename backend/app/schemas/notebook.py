"""Schemas for notebook persistence APIs."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema, TimestampSchema


class NotebookItemBase(BaseSchema):
    """Shared notebook item fields."""

    type: Literal["draft", "note"]
    title: str = Field(min_length=1, max_length=255)
    content: str = ""
    content_format: Literal["markdown"] = Field(default="markdown", alias="contentFormat")


class NotebookItemCreate(NotebookItemBase):
    """Request payload for creating a notebook item."""

    pass


class NotebookItemUpdate(BaseSchema):
    """Request payload for updating a notebook item."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = None
    base_revision: int = Field(alias="baseRevision", ge=0)


class NotebookItemRead(NotebookItemBase, TimestampSchema):
    """Notebook item returned by the API."""

    id: UUID
    notebook_id: UUID = Field(alias="notebookId")
    order_index: int = Field(alias="orderIndex")
    server_revision: int = Field(alias="serverRevision")


class NotebookCreate(BaseSchema):
    """Request payload for creating a notebook."""

    title: str | None = Field(default=None, max_length=255)


class NotebookRead(BaseSchema, TimestampSchema):
    """Notebook API response."""

    id: UUID
    title: str
    items: list[NotebookItemRead]


class NotebookListItem(BaseSchema, TimestampSchema):
    """Notebook list row."""

    id: UUID
    title: str
    items: list[NotebookItemRead]
