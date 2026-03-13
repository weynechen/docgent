"""API tests for workspace document routes."""

import pytest

from app.core.config import settings


@pytest.mark.anyio
async def test_create_workspace_and_list_tree(client):
    """Creating a workspace should return a session and seeded files."""

    create_response = await client.post(f"{settings.API_V1_STR}/workspaces")
    assert create_response.status_code == 201
    session_id = create_response.json()["sessionId"]

    tree_response = await client.get(f"{settings.API_V1_STR}/workspaces/{session_id}/tree")
    assert tree_response.status_code == 200
    entries = tree_response.json()["entries"]
    assert any(entry["path"] == "drafts/docs-as-code-writing.md" for entry in entries)


@pytest.mark.anyio
async def test_read_and_save_workspace_file(client):
    """A workspace file should be readable and savable via the backend API."""

    create_response = await client.post(f"{settings.API_V1_STR}/workspaces")
    session_id = create_response.json()["sessionId"]

    file_response = await client.get(
        f"{settings.API_V1_STR}/workspaces/{session_id}/files",
        params={"path": "drafts/zhihu-outline.md"},
    )
    assert file_response.status_code == 200
    file_payload = file_response.json()

    save_response = await client.put(
        f"{settings.API_V1_STR}/workspaces/{session_id}/files",
        json={
            "docPath": "drafts/zhihu-outline.md",
            "content": file_payload["content"] + "\n\n## 结论\n\n版本历史要默认可见。\n",
            "baseRevision": file_payload["revision"],
        },
    )
    assert save_response.status_code == 200
    saved = save_response.json()
    assert saved["revision"] == file_payload["revision"] + 1
    assert "## 结论" in saved["content"]
