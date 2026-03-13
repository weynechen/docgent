"""Unit tests for rewrite agent prompt construction."""

from app.agents.rewrite import (
    MAX_CONTEXT_CHARS,
    _trim_after_context,
    _trim_before_context,
    build_rewrite_prompt,
)
from app.schemas.rewrite import RewriteRequest


def test_trim_before_context_keeps_tail():
    """Before-context trimming should keep the end of the string."""

    value = "a" * (MAX_CONTEXT_CHARS + 20)
    assert _trim_before_context(value) == value[-MAX_CONTEXT_CHARS:]


def test_trim_after_context_keeps_head():
    """After-context trimming should keep the start of the string."""

    value = "b" * (MAX_CONTEXT_CHARS + 20)
    assert _trim_after_context(value) == value[:MAX_CONTEXT_CHARS]


def test_build_rewrite_prompt_includes_fields():
    """Prompt builder should include title, instruction, selection, and context."""

    request = RewriteRequest(
        docPath="docs/example.md",
        selectedText="Original sentence.",
        instruction="Make it clearer",
        documentTitle="Example",
        beforeText="Before context",
        afterText="After context",
    )

    prompt = build_rewrite_prompt(request)
    assert "Document title: Example" in prompt
    assert "Instruction: Make it clearer" in prompt
    assert "Selected text:\nOriginal sentence." in prompt
    assert "Before context:\nBefore context" in prompt
    assert "After context:\nAfter context" in prompt
