"""Unit tests for workspace rewrite agent prompt construction."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.prompts import REWRITE_SELECTION_SYSTEM_PROMPT
from app.agents.rewrite import RewriteSelectionAgent, build_rewrite_prompt
from app.core.exceptions import ExternalServiceError
from app.schemas.rewrite import RewriteRequest


def test_build_rewrite_prompt_includes_workspace_fields():
    """Prompt builder should include path, instruction, range, selection, and full Markdown."""

    request = RewriteRequest(
        sessionId="workspace-1",
        docPath="docs/example.md",
        selectionStart=5,
        selectionEnd=22,
        instruction="Make it clearer",
    )

    prompt = build_rewrite_prompt(
        request,
        full_markdown="# Example\n\nOriginal sentence.\n",
        selected_plain_text="Original sentence.",
    )

    assert "Document path: docs/example.md" in prompt
    assert "Instruction: Make it clearer" in prompt
    assert "Selection range: 5-22" in prompt
    assert "Selected plain text:" in prompt
    assert "Original sentence." in prompt
    assert "Current full markdown:" in prompt


def test_rewrite_system_prompt_mentions_json_output():
    """Structured-output providers may require an explicit JSON instruction."""

    prompt = REWRITE_SELECTION_SYSTEM_PROMPT.lower()
    assert "json" in prompt
    assert "updated_markdown" in prompt
    assert "explanation" in prompt
    assert "change_summary" in prompt


@pytest.mark.anyio
@patch("app.agents.rewrite.ChatOpenAI")
@patch("app.agents.rewrite.APITimeoutError", new=TimeoutError)
async def test_rewrite_timeout_maps_to_external_service_error(mock_chat_openai):
    """Model timeouts should surface as a user-facing rewrite timeout error."""

    runnable = MagicMock()
    runnable.ainvoke = AsyncMock(side_effect=TimeoutError("timed out"))

    model = MagicMock()
    model.with_structured_output.return_value = runnable
    mock_chat_openai.return_value = model

    agent = RewriteSelectionAgent()
    request = RewriteRequest(
        sessionId="workspace-1",
        docPath="docs/example.md",
        selectionStart=5,
        selectionEnd=22,
        instruction="Make it clearer",
    )

    with pytest.raises(ExternalServiceError) as exc_info:
        await agent.rewrite(
            request,
            full_markdown="# Example\n\nOriginal sentence.\n",
            selected_plain_text="Original sentence.",
            base_revision=1,
        )

    assert exc_info.value.code == "MODEL_TIMEOUT"
