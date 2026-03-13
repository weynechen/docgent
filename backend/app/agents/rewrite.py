"""Rewrite agent implementation built on LangChain chat models."""

from __future__ import annotations

import logging
from time import perf_counter
from uuid import uuid4

from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.agents.prompts import REWRITE_SELECTION_SYSTEM_PROMPT
from app.core.config import settings
from app.core.exceptions import ExternalServiceError
from app.core.logging import log_event
from app.schemas.rewrite import RewriteRequest, RewriteSuggestion

MAX_CONTEXT_CHARS = 280
logger = logging.getLogger(__name__)


class RewriteModelOutput(BaseModel):
    """Structured output returned by the model."""

    suggested_text: str = Field(min_length=1)
    explanation: str = Field(min_length=1)


def _trim_before_context(text: str | None) -> str:
    if not text:
        return ""

    compact = " ".join(text.split()).strip()
    if len(compact) <= MAX_CONTEXT_CHARS:
        return compact
    return compact[-MAX_CONTEXT_CHARS:]


def _trim_after_context(text: str | None) -> str:
    if not text:
        return ""

    compact = " ".join(text.split()).strip()
    if len(compact) <= MAX_CONTEXT_CHARS:
        return compact
    return compact[:MAX_CONTEXT_CHARS]


def build_rewrite_prompt(request: RewriteRequest) -> str:
    """Build the user prompt from the rewrite request."""

    return "\n\n".join(
        [
            f"Document title: {request.document_title or request.doc_path}",
            f"Instruction: {request.instruction}",
            f"Selected text:\n{request.selected_text}",
            f"Before context:\n{_trim_before_context(request.before_text) or '(none)'}",
            f"After context:\n{_trim_after_context(request.after_text) or '(none)'}",
        ]
    )


class RewriteSelectionAgent:
    """Selection rewrite agent for the editor workflow."""

    def __init__(self) -> None:
        self.model = ChatOpenAI(
            model=settings.AI_MODEL,
            temperature=0.3,
            api_key=settings.OPENAI_API_KEY or None,
            base_url=settings.OPENAI_BASE_URL,
            timeout=settings.AI_REQUEST_TIMEOUT_SECONDS,
            max_retries=1,
        )

    async def rewrite(self, request: RewriteRequest) -> RewriteSuggestion:
        """Rewrite the selected passage and return a structured suggestion."""

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
        result = await runnable.ainvoke(
            [
                ("system", REWRITE_SELECTION_SYSTEM_PROMPT),
                ("user", build_rewrite_prompt(request)),
            ]
        )
        duration_ms = round((perf_counter() - started_at) * 1000, 2)
        log_event(
            logger,
            logging.INFO,
            "ai.rewrite.model_invocation.completed",
            "Rewrite model invocation completed",
            provider=settings.LLM_PROVIDER,
            model=settings.AI_MODEL,
            duration_ms=duration_ms,
            selected_text_length=len(request.selected_text),
        )

        return RewriteSuggestion(
            id=str(uuid4()),
            suggestedText=result.suggested_text.strip(),
            explanation=result.explanation.strip(),
            createdAt=0,
            instruction=request.instruction,
            provider=settings.LLM_PROVIDER,
            model=settings.AI_MODEL,
        )
