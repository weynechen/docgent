"""Repository functions for notebook persistence."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.notebook import Notebook
from app.db.models.notebook_item import NotebookItem
from app.db.models.notebook_source import NotebookSource


async def create_notebook(db: AsyncSession, *, title: str) -> Notebook:
    """Create a notebook row."""

    notebook = Notebook(title=title)
    db.add(notebook)
    await db.flush()
    await db.refresh(notebook)
    return notebook


async def list_notebooks(db: AsyncSession) -> list[Notebook]:
    """List notebooks with items preloaded."""

    query: Select[tuple[Notebook]] = (
        select(Notebook)
        .options(selectinload(Notebook.items), selectinload(Notebook.sources))
        .order_by(Notebook.updated_at.desc().nullslast(), Notebook.created_at.desc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_notebook_with_items(db: AsyncSession, notebook_id: UUID) -> Notebook | None:
    """Load one notebook with items."""

    query = (
        select(Notebook)
        .where(Notebook.id == notebook_id)
        .options(selectinload(Notebook.items), selectinload(Notebook.sources))
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_item_by_id(db: AsyncSession, item_id: UUID) -> NotebookItem | None:
    """Load one notebook item."""

    return await db.get(NotebookItem, item_id)


async def update_notebook(
    db: AsyncSession,
    *,
    notebook: Notebook,
    title: str,
) -> Notebook:
    """Update an existing notebook title."""

    notebook.title = title
    db.add(notebook)
    await db.flush()
    await db.refresh(notebook)
    return notebook


async def create_item(
    db: AsyncSession,
    *,
    notebook_id: UUID,
    type: str,
    title: str,
    content: str,
    order_index: int | None = None,
    content_format: str = "markdown",
) -> NotebookItem:
    """Create an item in a notebook."""

    next_order = order_index
    if next_order is None:
        query = select(func.max(NotebookItem.order_index)).where(NotebookItem.notebook_id == notebook_id)
        result = await db.execute(query)
        next_order = (result.scalar_one_or_none() or -1) + 1

    item = NotebookItem(
        notebook_id=notebook_id,
        type=type,
        title=title,
        content=content,
        content_format=content_format,
        order_index=next_order,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def update_item(
    db: AsyncSession,
    *,
    item: NotebookItem,
    title: str | None = None,
    content: str | None = None,
) -> NotebookItem:
    """Update an existing notebook item."""

    if title is not None:
        item.title = title
    if content is not None:
        item.content = content
        item.server_revision += 1

    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def create_source(
    db: AsyncSession,
    *,
    notebook_id: UUID,
    type: str,
    title: str,
    source_url: str | None = None,
    mime_type: str | None = None,
) -> NotebookSource:
    """Create a source metadata row for a notebook."""

    source = NotebookSource(
        notebook_id=notebook_id,
        type=type,
        title=title,
        source_url=source_url,
        mime_type=mime_type,
    )
    db.add(source)
    await db.flush()
    await db.refresh(source)
    return source
