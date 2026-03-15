"""Notebook model for persisted writing collections."""

import uuid

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Notebook(Base, TimestampMixin):
    """Notebook groups drafts and notes for one writing context."""

    __tablename__ = "notebooks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Untitled notebook")

    items: Mapped[list["NotebookItem"]] = relationship(
        "NotebookItem",
        back_populates="notebook",
        cascade="all, delete-orphan",
        order_by="NotebookItem.order_index",
    )
    sources: Mapped[list["NotebookSource"]] = relationship(
        "NotebookSource",
        back_populates="notebook",
        cascade="all, delete-orphan",
        order_by="NotebookSource.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<Notebook(id={self.id}, title={self.title})>"
