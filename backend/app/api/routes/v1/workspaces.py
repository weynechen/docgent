"""Workspace routes for remote editing and reviewable AI rewrites."""

from fastapi import APIRouter, BackgroundTasks, Query
from fastapi.responses import Response, StreamingResponse

from app.api.deps import RewriteSvc, WorkspaceSvc
from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.schemas.rewrite import RewriteApplyResponse, RewriteRequest, RewriteRunResponse
from app.schemas.workspace import (
    WorkspaceCreateResponse,
    WorkspaceFileResponse,
    WorkspaceFileUpdateRequest,
    WorkspaceTreeResponse,
)

router = APIRouter(prefix="/workspaces")


@router.post("", response_model=WorkspaceCreateResponse, status_code=201)
async def create_workspace(
    workspace_service: WorkspaceSvc,
) -> WorkspaceCreateResponse:
    """Create a temporary backend workspace."""

    return workspace_service.create_workspace()


@router.get("/{session_id}/tree", response_model=WorkspaceTreeResponse)
async def get_workspace_tree(
    session_id: str,
    workspace_service: WorkspaceSvc,
) -> WorkspaceTreeResponse:
    """List workspace files and directories."""

    return workspace_service.list_tree(session_id)


@router.get("/{session_id}/files", response_model=WorkspaceFileResponse)
async def get_workspace_file(
    session_id: str,
    workspace_service: WorkspaceSvc,
    path: str = Query(..., min_length=1),
) -> WorkspaceFileResponse:
    """Read a workspace file."""

    return workspace_service.read_file(session_id, path)


@router.put("/{session_id}/files", response_model=WorkspaceFileResponse)
async def update_workspace_file(
    session_id: str,
    payload: WorkspaceFileUpdateRequest,
    workspace_service: WorkspaceSvc,
) -> WorkspaceFileResponse:
    """Save a full Markdown document into the workspace."""

    return workspace_service.write_file(
        session_id,
        payload.doc_path,
        payload.content,
        payload.base_revision,
    )


@router.post("/{session_id}/agent/runs", response_model=RewriteRunResponse, status_code=202)
async def create_rewrite_run(
    session_id: str,
    background_tasks: BackgroundTasks,
    payload: RewriteRequest,
    rewrite_service: RewriteSvc,
) -> RewriteRunResponse:
    """Start a new workspace rewrite run."""

    if payload.session_id != session_id:
        raise NotFoundError(message="Rewrite session does not match the requested workspace.")

    response = rewrite_service.create_run(payload, settings.API_V1_STR)
    background_tasks.add_task(rewrite_service.process_run, response.request_id, payload)
    return response


@router.get("/{session_id}/agent/runs/{run_id}/events")
async def stream_rewrite_events(
    session_id: str,
    run_id: str,
    rewrite_service: RewriteSvc,
) -> StreamingResponse:
    """Stream SSE events for a workspace rewrite run."""

    if not rewrite_service.has_run(run_id, session_id):
        raise NotFoundError(message="Unknown rewrite request.")

    return StreamingResponse(
        rewrite_service.stream_events(run_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        },
    )


@router.post("/{session_id}/agent/runs/{run_id}/apply", response_model=RewriteApplyResponse)
async def apply_rewrite_run(
    session_id: str,
    run_id: str,
    rewrite_service: RewriteSvc,
) -> RewriteApplyResponse:
    """Apply a candidate rewrite to the workspace file."""

    return rewrite_service.apply_run(session_id, run_id)


@router.post("/{session_id}/agent/runs/{run_id}/discard", status_code=204)
async def discard_rewrite_run(
    session_id: str,
    run_id: str,
    rewrite_service: RewriteSvc,
) -> Response:
    """Discard a candidate rewrite without modifying the workspace."""

    rewrite_service.discard_run(session_id, run_id)
    return Response(status_code=204)
