"""Notebook service layer."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.db.models.notebook import Notebook
from app.db.models.notebook_item import NotebookItem
from app.db.models.notebook_source import NotebookSource
from app.repositories import notebook as notebook_repo


class NotebookService:
    """Business logic for notebooks and notebook items."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_notebook(self, title: str = "Untitled notebook") -> Notebook:
        """Create a notebook and seed its first draft."""

        notebook = await notebook_repo.create_notebook(self.db, title=title)
        await notebook_repo.create_item(
            self.db,
            notebook_id=notebook.id,
            type="draft",
            title="Untitled",
            content="",
            order_index=0,
        )
        await self.db.commit()
        return await self._get_notebook(notebook.id)

    async def list_notebooks(self) -> list[Notebook]:
        """List all notebooks."""

        return await notebook_repo.list_notebooks(self.db)

    async def get_notebook(self, notebook_id: UUID) -> Notebook:
        """Get one notebook with items."""

        return await self._get_notebook(notebook_id)

    async def create_item(
        self,
        *,
        notebook_id: UUID,
        item_type: str,
        title: str,
        content: str = "",
    ) -> NotebookItem:
        """Create an item in a notebook."""

        await self._get_notebook(notebook_id)
        item = await notebook_repo.create_item(
            self.db,
            notebook_id=notebook_id,
            type=item_type,
            title=title,
            content=content,
        )
        await self.db.commit()
        return item

    async def create_source(
        self,
        *,
        notebook_id: UUID,
        source_type: str,
        title: str,
        source_url: str | None = None,
        mime_type: str | None = None,
    ) -> NotebookSource:
        """Create a notebook source for future reference ingestion."""

        await self._get_notebook(notebook_id)
        if source_type == "external_link" and not source_url:
            raise BadRequestError(message="External links require a source URL.", code="SOURCE_URL_REQUIRED")

        source = await notebook_repo.create_source(
            self.db,
            notebook_id=notebook_id,
            type=source_type,
            title=title,
            source_url=source_url,
            mime_type=mime_type,
        )
        await self.db.commit()
        return source

    async def get_item(self, item_id: UUID) -> NotebookItem:
        """Get one notebook item."""

        item = await notebook_repo.get_item_by_id(self.db, item_id)
        if item is None:
            raise NotFoundError(message="Notebook item not found", details={"item_id": str(item_id)})
        return item

    async def update_item(
        self,
        *,
        item_id: UUID,
        base_revision: int,
        title: str | None = None,
        content: str | None = None,
    ) -> NotebookItem:
        """Update an item if its base revision still matches."""

        item = await self.get_item(item_id)
        if item.server_revision != base_revision:
            raise BadRequestError(
                message="Notebook item revision is outdated. Reload the latest item before saving.",
                code="REVISION_CONFLICT",
            )

        updated = await notebook_repo.update_item(
            self.db,
            item=item,
            title=title,
            content=content,
        )
        await self.db.commit()
        return updated

    async def _get_notebook(self, notebook_id: UUID) -> Notebook:
        notebook = await notebook_repo.get_notebook_with_items(self.db, notebook_id)
        if notebook is None:
            raise NotFoundError(message="Notebook not found", details={"notebook_id": str(notebook_id)})
        return notebook
