"""API tests for notebook routes."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.main import app


def make_item(*, item_id=None, notebook_id=None, item_type="draft", title="Untitled", content="", revision=1):
    """Create a mock notebook item."""

    return SimpleNamespace(
        id=item_id or uuid4(),
        notebook_id=notebook_id or uuid4(),
        type=item_type,
        title=title,
        content=content,
        content_format="markdown",
        order_index=0,
        server_revision=revision,
        created_at=datetime.now(UTC),
        updated_at=None,
    )


def make_source(
    *,
    source_id=None,
    notebook_id=None,
    source_type="external_link",
    title="Reference link",
    source_url="https://example.com/reference",
    mime_type=None,
):
    """Create a mock notebook source."""

    return SimpleNamespace(
        id=source_id or uuid4(),
        notebook_id=notebook_id or uuid4(),
        type=source_type,
        title=title,
        source_url=source_url,
        mime_type=mime_type,
        created_at=datetime.now(UTC),
        updated_at=None,
    )


def make_notebook(*, notebook_id=None, title="Untitled notebook", items=None):
    """Create a mock notebook."""

    return SimpleNamespace(
        id=notebook_id or uuid4(),
        title=title,
        items=list(items or []),
        sources=[],
        created_at=datetime.now(UTC),
        updated_at=None,
    )


@pytest.fixture
def mock_notebook_service() -> MagicMock:
    """Create a mock notebook service."""

    notebook = make_notebook()
    notebook_item = make_item(notebook_id=notebook.id)
    notebook.items = [notebook_item]
    notebook.sources = [make_source(notebook_id=notebook.id)]

    updated_item = make_item(
        item_id=notebook_item.id,
        notebook_id=notebook.id,
        content="# Updated",
        revision=2,
    )

    service = MagicMock()
    service.create_notebook = AsyncMock(return_value=notebook)
    service.list_notebooks = AsyncMock(return_value=[notebook])
    service.get_notebook = AsyncMock(return_value=notebook)
    service.update_notebook = AsyncMock(return_value=make_notebook(notebook_id=notebook.id, title="Renamed notebook", items=notebook.items))
    service.create_item = AsyncMock(return_value=notebook_item)
    service.create_source = AsyncMock(return_value=notebook.sources[0])
    service.update_item = AsyncMock(return_value=updated_item)
    return service


@pytest.fixture
async def client_with_mock_notebook_service(
    mock_notebook_service: MagicMock,
    mock_db_session,
) -> AsyncClient:
    """Create an HTTP client with notebook service dependency overrides."""

    from httpx import ASGITransport

    from app.api.deps import get_db_session, get_notebook_service

    async def override_db_session():
        return mock_db_session

    async def override_notebook_service(db=None):
        return mock_notebook_service

    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[get_notebook_service] = override_notebook_service

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_create_notebook_returns_seeded_draft(client_with_mock_notebook_service: AsyncClient):
    """Creating a notebook should include the seeded draft item."""

    response = await client_with_mock_notebook_service.post(
        f"{settings.API_V1_STR}/notebooks",
        json={},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Untitled notebook"
    assert len(data["items"]) == 1
    assert data["items"][0]["type"] == "draft"


@pytest.mark.anyio
async def test_list_notebooks(client_with_mock_notebook_service: AsyncClient):
    """Listing notebooks should return notebook rows with items."""

    response = await client_with_mock_notebook_service.get(f"{settings.API_V1_STR}/notebooks")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["items"][0]["title"] == "Untitled"


@pytest.mark.anyio
async def test_get_notebook(client_with_mock_notebook_service: AsyncClient, mock_notebook_service: MagicMock):
    """Fetching one notebook should delegate to the service."""

    notebook_id = uuid4()
    response = await client_with_mock_notebook_service.get(f"{settings.API_V1_STR}/notebooks/{notebook_id}")
    assert response.status_code == 200
    mock_notebook_service.get_notebook.assert_awaited_once_with(notebook_id)


@pytest.mark.anyio
async def test_update_notebook_title(client_with_mock_notebook_service: AsyncClient):
    """Updating a notebook title should return the renamed notebook."""

    notebook_id = uuid4()
    response = await client_with_mock_notebook_service.patch(
        f"{settings.API_V1_STR}/notebooks/{notebook_id}",
        json={"title": "Renamed notebook"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Renamed notebook"


@pytest.mark.anyio
async def test_update_notebook_item(client_with_mock_notebook_service: AsyncClient):
    """Updating an item should return the new revision."""

    item_id = uuid4()
    response = await client_with_mock_notebook_service.patch(
        f"{settings.API_V1_STR}/notebooks/items/{item_id}",
        json={"content": "# Updated", "baseRevision": 1},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["serverRevision"] == 2


@pytest.mark.anyio
async def test_create_notebook_source(client_with_mock_notebook_service: AsyncClient):
    """Creating a notebook source should return external link metadata."""

    notebook_id = uuid4()
    response = await client_with_mock_notebook_service.post(
        f"{settings.API_V1_STR}/notebooks/{notebook_id}/sources",
        json={
            "type": "external_link",
            "title": "Reference link",
            "sourceUrl": "https://example.com/reference",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "external_link"
    assert data["sourceUrl"] == "https://example.com/reference"


@pytest.mark.anyio
async def test_update_notebook_item_conflict(
    client_with_mock_notebook_service: AsyncClient,
    mock_notebook_service: MagicMock,
):
    """Conflicts should propagate as 400 responses."""

    mock_notebook_service.update_item = AsyncMock(
        side_effect=BadRequestError(message="Conflict", code="REVISION_CONFLICT")
    )

    response = await client_with_mock_notebook_service.patch(
        f"{settings.API_V1_STR}/notebooks/items/{uuid4()}",
        json={"content": "# Updated", "baseRevision": 1},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "REVISION_CONFLICT"


@pytest.mark.anyio
async def test_get_notebook_not_found(
    client_with_mock_notebook_service: AsyncClient,
    mock_notebook_service: MagicMock,
):
    """Missing notebooks should return 404."""

    mock_notebook_service.get_notebook = AsyncMock(side_effect=NotFoundError(message="Notebook not found"))

    response = await client_with_mock_notebook_service.get(f"{settings.API_V1_STR}/notebooks/{uuid4()}")
    assert response.status_code == 404
