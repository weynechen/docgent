"""API tests for rewrite routes."""

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.api.routes.v1.rewrite import stream_rewrite_events
from app.core.exceptions import NotFoundError
from app.schemas.rewrite import RewriteRequest, RewriteSuggestion
from app.services.rewrite import rewrite_run_service


class StubRewriteAgent:
    """Deterministic agent for API tests."""

    async def rewrite(self, request):
        return RewriteSuggestion(
            id="suggestion-1",
            suggestedText=f"Rewritten: {request.selected_text}",
            explanation="Tightened the wording.",
            createdAt=0,
            instruction=request.instruction,
            provider="stub",
            model="stub-model",
        )


@pytest.mark.anyio
async def test_create_rewrite_run_returns_request_id():
    """Rewrite service should create a replayable run and emit events."""

    original_agent = rewrite_run_service._agent
    rewrite_run_service._agent = StubRewriteAgent()
    try:
        payload = {
            "docPath": "docs/test.md",
            "selectedText": "Original text",
            "instruction": "Rewrite more clearly",
            "documentTitle": "Test Doc",
            "beforeText": "Before",
            "afterText": "After",
        }
        response = rewrite_run_service.create_run(
            RewriteRequest(**payload),
            "/api/v1",
        )
        request_id = response.request_id
        assert request_id
        assert rewrite_run_service.has_run(request_id)

        await rewrite_run_service.process_run(request_id, RewriteRequest(**payload))
        event_stream = rewrite_run_service.stream_events(request_id)

        chunks: list[str] = []
        async for chunk in event_stream:
            chunks.append(chunk)

        body = "".join(chunks)
        assert '"type": "status"' in body
        assert "collecting_context" in body
        assert "rewriting" in body
        assert "finalizing" in body
        assert "Rewritten: Original text" in body
        assert '"type": "done"' in body
    finally:
        rewrite_run_service._agent = original_agent


def test_create_rewrite_run_rejects_blank_selection():
    """Rewrite request schema should reject blank selected text."""

    with pytest.raises(PydanticValidationError):
        RewriteRequest(
            docPath="docs/test.md",
            selectedText="   ",
            instruction="Rewrite more clearly",
        )


@pytest.mark.anyio
async def test_unknown_rewrite_run_returns_error():
    """Unknown rewrite runs should raise a not-found error."""

    with pytest.raises(NotFoundError):
        await stream_rewrite_events("unknown-run", rewrite_run_service)
