"""Tests for notebook-scoped agent tools."""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.agents.tools.notebook_tools import create_notebook_tools, extract_notebook_write_result


def _build_tool_map(tools):
    return {tool.name: tool for tool in tools}


def make_item(*, item_id=None, notebook_id=None, title="Draft", content="# Draft", revision=1):
    """Create a notebook item test double."""

    return SimpleNamespace(
        id=item_id or uuid4(),
        notebook_id=notebook_id or uuid4(),
        type="draft",
        title=title,
        content=content,
        content_format="markdown",
        order_index=0,
        server_revision=revision,
    )


@pytest.mark.anyio
async def test_notebook_tools_can_list_read_and_write_items():
    """Notebook tools should inspect and update notebook items."""

    notebook_id = uuid4()
    active_item = make_item(notebook_id=notebook_id, title="Current Draft")
    note_item = make_item(notebook_id=notebook_id, title="Reference Note", content="Quoted source")
    service = AsyncMock()
    service.get_item = AsyncMock(side_effect=[active_item, note_item, active_item])
    service.get_notebook = AsyncMock(
        return_value=SimpleNamespace(
            id=notebook_id,
            title="Notebook",
            items=[active_item, note_item],
        )
    )
    updated_item = make_item(
        item_id=active_item.id,
        notebook_id=notebook_id,
        title=active_item.title,
        content="# Updated by AI",
        revision=2,
    )
    service.update_item = AsyncMock(return_value=updated_item)

    tools = _build_tool_map(
        create_notebook_tools(
            notebook_service=service,
            notebook_id=notebook_id,
            active_item_id=active_item.id,
        )
    )

    list_payload = json.loads(await tools["ListItems"].ainvoke({}))
    read_payload = json.loads(await tools["Read"].ainvoke({}))
    note_payload = json.loads(await tools["Read"].ainvoke({"item_id": str(note_item.id)}))
    write_payload = extract_notebook_write_result(
        await tools["Write"].ainvoke({"content": "# Updated by AI"})
    )

    assert list_payload["activeItemId"] == str(active_item.id)
    assert [item["title"] for item in list_payload["items"]] == ["Current Draft", "Reference Note"]
    assert read_payload["itemId"] == str(active_item.id)
    assert read_payload["content"] == "# Draft"
    assert note_payload["itemId"] == str(note_item.id)
    assert note_payload["content"] == "Quoted source"
    assert write_payload is not None
    assert write_payload["itemId"] == str(active_item.id)
    assert write_payload["serverRevision"] == 2
    assert write_payload["content"] == "# Updated by AI"
    service.update_item.assert_awaited_once_with(
        item_id=active_item.id,
        content="# Updated by AI",
        base_revision=1,
    )
