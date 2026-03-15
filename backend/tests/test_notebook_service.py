"""Tests for notebook service behavior."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.core.exceptions import BadRequestError
from app.services.notebook import NotebookService


def make_notebook(*, notebook_id=None, title="Untitled notebook", items=None):
    """Create a simple notebook-shaped object for service tests."""

    return SimpleNamespace(
        id=notebook_id or uuid4(),
        title=title,
        items=list(items or []),
    )


def make_item(
    *,
    item_id=None,
    notebook_id=None,
    item_type="draft",
    title="Untitled",
    content="",
    server_revision=1,
):
    """Create a simple notebook item for service tests."""

    return SimpleNamespace(
        id=item_id or uuid4(),
        notebook_id=notebook_id or uuid4(),
        type=item_type,
        title=title,
        content=content,
        server_revision=server_revision,
    )


class TestNotebookService:
    """Notebook service tests."""

    @pytest.fixture
    def mock_db(self) -> AsyncMock:
        """Create a mock async database session."""

        return AsyncMock()

    @pytest.fixture
    def notebook_service(self, mock_db: AsyncMock) -> NotebookService:
        """Create the service under test."""

        return NotebookService(mock_db)

    @pytest.mark.anyio
    async def test_create_notebook_seeds_initial_draft(
        self,
        notebook_service: NotebookService,
    ) -> None:
        """Creating a notebook should always seed one draft item."""

        notebook = make_notebook()
        seeded_item = make_item(notebook_id=notebook.id)
        seeded_notebook = make_notebook(notebook_id=notebook.id, items=[seeded_item])

        with patch("app.services.notebook.notebook_repo") as mock_repo:
            mock_repo.create_notebook = AsyncMock(return_value=notebook)
            mock_repo.create_item = AsyncMock(return_value=seeded_item)
            mock_repo.get_notebook_with_items = AsyncMock(return_value=seeded_notebook)

            result = await notebook_service.create_notebook()

        assert result.title == "Untitled notebook"
        assert len(result.items) == 1
        assert result.items[0].type == "draft"
        assert result.items[0].title == "Untitled"
        assert result.items[0].server_revision == 1
        mock_repo.create_notebook.assert_awaited_once()
        mock_repo.create_item.assert_awaited_once()
        notebook_service.db.commit.assert_awaited_once()

    @pytest.mark.anyio
    async def test_update_item_rejects_stale_revision(
        self,
        notebook_service: NotebookService,
    ) -> None:
        """Updating with an outdated revision should raise a conflict."""

        item = make_item(server_revision=2)

        with patch("app.services.notebook.notebook_repo") as mock_repo:
            mock_repo.get_item_by_id = AsyncMock(return_value=item)

            with pytest.raises(BadRequestError) as exc:
                await notebook_service.update_item(
                    item_id=item.id,
                    content="Updated content",
                    base_revision=1,
                )

        assert exc.value.code == "REVISION_CONFLICT"
