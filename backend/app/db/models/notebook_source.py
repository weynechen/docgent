"""Notebook source model for external links and imported files."""

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class NotebookSource(Base, TimestampMixin):
    """Notebook source stores reference metadata attached to a notebook."""

    __tablename__ = "notebook_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)

    notebook: Mapped["Notebook"] = relationship("Notebook", back_populates="sources")

    def __repr__(self) -> str:
        return f"<NotebookSource(id={self.id}, type={self.type}, title={self.title})>"
