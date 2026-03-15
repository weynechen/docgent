"""Notebook routes for persisted writing collections."""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import NotebookSvc
from app.schemas.notebook import (
    NotebookCreate,
    NotebookItemCreate,
    NotebookItemRead,
    NotebookItemUpdate,
    NotebookRead,
)

router = APIRouter(prefix="/notebooks")


@router.post("", response_model=NotebookRead, status_code=status.HTTP_201_CREATED)
async def create_notebook(
    payload: NotebookCreate,
    notebook_service: NotebookSvc,
) -> NotebookRead:
    """Create a notebook with a seeded draft."""

    return await notebook_service.create_notebook(title=payload.title or "Untitled notebook")


@router.get("", response_model=list[NotebookRead])
async def list_notebooks(
    notebook_service: NotebookSvc,
) -> list[NotebookRead]:
    """List notebooks."""

    return await notebook_service.list_notebooks()


@router.get("/{notebook_id}", response_model=NotebookRead)
async def get_notebook(
    notebook_id: UUID,
    notebook_service: NotebookSvc,
) -> NotebookRead:
    """Get one notebook."""

    return await notebook_service.get_notebook(notebook_id)


@router.post("/{notebook_id}/items", response_model=NotebookItemRead, status_code=status.HTTP_201_CREATED)
async def create_notebook_item(
    notebook_id: UUID,
    payload: NotebookItemCreate,
    notebook_service: NotebookSvc,
) -> NotebookItemRead:
    """Create one notebook item."""

    return await notebook_service.create_item(
        notebook_id=notebook_id,
        item_type=payload.type,
        title=payload.title,
        content=payload.content,
    )


@router.patch("/items/{item_id}", response_model=NotebookItemRead)
async def update_notebook_item(
    item_id: UUID,
    payload: NotebookItemUpdate,
    notebook_service: NotebookSvc,
) -> NotebookItemRead:
    """Update one notebook item."""

    return await notebook_service.update_item(
        item_id=item_id,
        title=payload.title,
        content=payload.content,
        base_revision=payload.base_revision,
    )
