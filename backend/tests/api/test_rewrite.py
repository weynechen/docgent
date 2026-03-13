"""API tests for workspace-backed rewrite routes."""

import pytest

from app.schemas.rewrite import ProposedEdit, RewriteRequest, RewriteSuggestion
from app.services.rewrite import rewrite_run_service
from app.services.workspace import markdown_to_plain_text, workspace_service


class StubRewriteAgent:
    """Deterministic agent for API tests."""

    async def rewrite(self, request, *, full_markdown, selected_plain_text, base_revision):
        return RewriteSuggestion(
            id="suggestion-1",
            explanation="Tightened the selected paragraph.",
            createdAt=0,
            instruction=request.instruction,
            provider="stub",
            model="stub-model",
            proposedEdits=[
                ProposedEdit(
                    docPath=request.doc_path,
                    beforeMarkdown=full_markdown,
                    afterMarkdown=full_markdown.replace(selected_plain_text, "Rewritten selection"),
                    selectionStart=request.selection_start,
                    selectionEnd=request.selection_end,
                    baseRevision=base_revision,
                    changeSummary="Rewrite the selected text",
                )
            ],
        )


@pytest.mark.anyio
async def test_workspace_rewrite_run_returns_candidate_events():
    """Rewrite service should emit a reviewable candidate over a workspace file."""

    workspace = workspace_service.create_workspace()
    session_id = workspace.session_id
    file = workspace_service.read_file(session_id, "drafts/docs-as-code-writing.md")
    plain_text = markdown_to_plain_text(file.content)
    target = (
        "I want an editor where I can write roughly, select one paragraph, ask AI to make it "
        "clearer, review the diff, and decide whether to apply it."
    )
    start = plain_text.index(target)
    end = start + len(target)

    original_agent = rewrite_run_service._agent
    rewrite_run_service._agent = StubRewriteAgent()
    try:
        request = RewriteRequest(
            sessionId=session_id,
            docPath="drafts/docs-as-code-writing.md",
            selectionStart=start,
            selectionEnd=end,
            instruction="Make this clearer",
        )
        response = rewrite_run_service.create_run(request, "/api/v1")
        await rewrite_run_service.process_run(response.request_id, request)

        chunks: list[str] = []
        async for chunk in rewrite_run_service.stream_events(response.request_id):
            chunks.append(chunk)

        body = "".join(chunks)
        assert '"type": "status"' in body
        assert "collecting_context" in body
        assert "Rewrite the selected text" in body
        assert '"type": "done"' in body
    finally:
        rewrite_run_service._agent = original_agent
        workspace_service.dispose_workspace(session_id)


@pytest.mark.anyio
async def test_apply_rewrite_run_updates_workspace_file():
    """Applying a run should overwrite the workspace file at a new revision."""

    workspace = workspace_service.create_workspace()
    session_id = workspace.session_id
    file = workspace_service.read_file(session_id, "drafts/docs-as-code-writing.md")
    plain_text = markdown_to_plain_text(file.content)
    target = (
        "I want an editor where I can write roughly, select one paragraph, ask AI to make it "
        "clearer, review the diff, and decide whether to apply it."
    )
    start = plain_text.index(target)
    end = start + len(target)

    original_agent = rewrite_run_service._agent
    rewrite_run_service._agent = StubRewriteAgent()
    try:
        request = RewriteRequest(
            sessionId=session_id,
            docPath="drafts/docs-as-code-writing.md",
            selectionStart=start,
            selectionEnd=end,
            instruction="Make this clearer",
        )
        response = rewrite_run_service.create_run(request, "/api/v1")
        await rewrite_run_service.process_run(response.request_id, request)

        applied = rewrite_run_service.apply_run(session_id, response.request_id)

        assert applied.doc_path == "drafts/docs-as-code-writing.md"
        assert applied.revision == 2
        assert "Rewritten selection" in applied.content
    finally:
        rewrite_run_service._agent = original_agent
        workspace_service.dispose_workspace(session_id)
