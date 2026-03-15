"""Notebook item model for drafts and notes."""

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class NotebookItem(Base, TimestampMixin):
    """Notebook item stores one draft or text note."""

    __tablename__ = "notebook_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    notebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notebooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content_format: Mapped[str] = mapped_column(String(32), nullable=False, default="markdown")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    server_revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    notebook: Mapped["Notebook"] = relationship("Notebook", back_populates="items")

    def __repr__(self) -> str:
        return f"<NotebookItem(id={self.id}, type={self.type}, title={self.title})>"
