"""Rewrite agent implementation for workspace-backed Markdown documents."""

from __future__ import annotations

import logging
from time import perf_counter
from uuid import uuid4

from langchain_openai import ChatOpenAI
from openai import APITimeoutError
from pydantic import BaseModel, Field

from app.agents.prompts import REWRITE_SELECTION_SYSTEM_PROMPT
from app.core.config import settings
from app.core.exceptions import ExternalServiceError
from app.core.logging import log_event
from app.schemas.rewrite import ProposedEdit, RewriteRequest, RewriteSuggestion

logger = logging.getLogger(__name__)


class RewriteModelOutput(BaseModel):
    """Structured output returned by the rewrite model."""

    updated_markdown: str = Field(min_length=1)
    explanation: str = Field(min_length=1)
    change_summary: str = Field(min_length=1)


def build_rewrite_prompt(
    request: RewriteRequest,
    *,
    full_markdown: str,
    selected_plain_text: str,
) -> str:
    """Build the user prompt for a full-document Markdown rewrite."""

    return "\n\n".join(
        [
            f"Document path: {request.doc_path}",
            f"Instruction: {request.instruction}",
            f"Selection range: {request.selection_start}-{request.selection_end}",
            "Selected plain text:",
            selected_plain_text or "(empty selection)",
            "Current full markdown:",
            full_markdown,
        ]
    )


class RewriteSelectionAgent:
    """Workspace rewrite agent that returns a full-document Markdown candidate."""

    def __init__(self) -> None:
        self.model = ChatOpenAI(
            model=settings.AI_MODEL,
            temperature=0.3,
            api_key=settings.OPENAI_API_KEY or None,
            base_url=settings.OPENAI_BASE_URL,
            timeout=settings.AI_REQUEST_TIMEOUT_SECONDS,
            max_retries=0,
        )

    async def rewrite(
        self,
        request: RewriteRequest,
        *,
        full_markdown: str,
        selected_plain_text: str,
        base_revision: int,
    ) -> RewriteSuggestion:
        """Rewrite the selected passage and return a candidate full-document revision."""

        if not settings.OPENAI_API_KEY:
            raise ExternalServiceError(
                message="OPENAI_API_KEY is not configured for the backend AI service.",
                code="MODEL_NOT_CONFIGURED",
            )

        runnable = self.model.with_structured_output(RewriteModelOutput)
        started_at = perf_counter()
        log_event(
            logger,
            logging.INFO,
            "ai.rewrite.model_invocation.started",
            "Rewrite model invocation started",
            provider=settings.LLM_PROVIDER,
            model=settings.AI_MODEL,
            doc_path=request.doc_path,
        )
        try:
            result = await runnable.ainvoke(
                [
                    ("system", REWRITE_SELECTION_SYSTEM_PROMPT),
                    (
                        "user",
                        build_rewrite_prompt(
                            request,
                            full_markdown=full_markdown,
                            selected_plain_text=selected_plain_text,
                        ),
                    ),
                ]
            )
        except APITimeoutError as exc:
            raise ExternalServiceError(
                message=(
                    "The backend AI model timed out while preparing a rewrite. "
                    "Please retry or shorten the selected passage."
                ),
                code="MODEL_TIMEOUT",
            ) from exc
        duration_ms = round((perf_counter() - started_at) * 1000, 2)
        log_event(
            logger,
            logging.INFO,
            "ai.rewrite.model_invocation.completed",
            "Rewrite model invocation completed",
            provider=settings.LLM_PROVIDER,
            model=settings.AI_MODEL,
            duration_ms=duration_ms,
            selection_start=request.selection_start,
            selection_end=request.selection_end,
        )

        return RewriteSuggestion(
            id=str(uuid4()),
            explanation=result.explanation.strip(),
            createdAt=0,
            instruction=request.instruction,
            provider=settings.LLM_PROVIDER,
            model=settings.AI_MODEL,
            proposedEdits=[
                ProposedEdit(
                    docPath=request.doc_path,
                    beforeMarkdown=full_markdown,
                    afterMarkdown=result.updated_markdown.strip(),
                    selectionStart=request.selection_start,
                    selectionEnd=request.selection_end,
                    baseRevision=base_revision,
                    changeSummary=result.change_summary.strip(),
                )
            ],
        )
