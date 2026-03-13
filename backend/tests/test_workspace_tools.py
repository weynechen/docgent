"""Tests for workspace-scoped agent tools."""

import json

from app.agents.tools.workspace_tools import create_workspace_tools, extract_write_result
from app.services.workspace import WorkspaceService


def _build_tool_map(tools):
    return {tool.name: tool for tool in tools}


def test_workspace_tools_can_read_glob_and_grep():
    """Workspace tools should expose basic file inspection capabilities."""

    service = WorkspaceService()
    session_id = service.create_workspace().session_id
    tools = _build_tool_map(
        create_workspace_tools(
            workspace_service=service,
            session_id=session_id,
            active_doc_path="drafts/docs-as-code-writing.md",
        )
    )

    read_payload = json.loads(tools["Read"].invoke({"doc_path": ""}))
    assert read_payload["path"] == "drafts/docs-as-code-writing.md"
    assert "# Docs-as-Code Writing" in read_payload["content"]

    glob_payload = json.loads(tools["Glob"].invoke({"pattern": "drafts/*.md"}))
    assert "drafts/docs-as-code-writing.md" in glob_payload["matches"]

    grep_payload = json.loads(tools["Grep"].invoke({"query": "版本", "pattern": "drafts/*.md"}))
    assert any(item["path"] == "drafts/zhihu-outline.md" for item in grep_payload["matches"])


def test_write_tool_updates_workspace_file():
    """Write tool should persist document updates into the workspace."""

    service = WorkspaceService()
    session_id = service.create_workspace().session_id
    tools = _build_tool_map(
        create_workspace_tools(
            workspace_service=service,
            session_id=session_id,
            active_doc_path="drafts/docs-as-code-writing.md",
        )
    )

    updated_markdown = "# Docs-as-Code Writing\n\nUpdated by tool.\n"
    result = tools["Write"].invoke({"content": updated_markdown, "doc_path": ""})
    payload = extract_write_result(result)

    assert payload is not None
    assert payload["revision"] == 2
    assert "Updated by tool." in payload["content"]
    assert "Updated by tool." in service.read_file(session_id, "drafts/docs-as-code-writing.md").content
