"""Selection rewrite HTTP routes."""

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import StreamingResponse

from app.api.deps import RewriteSvc
from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.schemas.rewrite import RewriteRequest, RewriteRunResponse

router = APIRouter()


@router.post("/runs", response_model=RewriteRunResponse, status_code=202)
async def create_rewrite_run(
    background_tasks: BackgroundTasks,
    payload: RewriteRequest,
    rewrite_service: RewriteSvc,
) -> RewriteRunResponse:
    """Start a new selection rewrite run."""

    response = rewrite_service.create_run(payload, settings.API_V1_STR)
    background_tasks.add_task(rewrite_service.process_run, response.request_id, payload)
    return response


@router.get("/{run_id}/events")
async def stream_rewrite_events(
    run_id: str,
    rewrite_service: RewriteSvc,
) -> StreamingResponse:
    """Stream SSE events for an existing rewrite run."""

    if not rewrite_service.has_run(run_id):
        raise NotFoundError(message="Unknown rewrite request.")

    return StreamingResponse(
        rewrite_service.stream_events(run_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        },
    )
