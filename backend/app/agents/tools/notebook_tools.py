"""Notebook-scoped tools for the conversational agent."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

import httpx
from langchain.tools import tool

from app.services.notebook import NotebookService


def _serialize_item(item: Any) -> dict[str, Any]:
    return {
        "itemId": str(item.id),
        "notebookId": str(item.notebook_id),
        "type": item.type,
        "title": item.title,
        "content": item.content,
        "contentFormat": item.content_format,
        "orderIndex": item.order_index,
        "serverRevision": item.server_revision,
    }


def create_notebook_tools(
    *,
    notebook_service: NotebookService,
    notebook_id: UUID,
    active_item_id: UUID,
) -> list[Any]:
    """Create notebook-aware agent tools bound to one notebook session."""

    @tool("ListItems")
    async def list_notebook_items() -> str:
        """List draft and note items in the active notebook."""

        notebook = await notebook_service.get_notebook(notebook_id)
        return json.dumps(
            {
                "notebookId": str(notebook.id),
                "title": notebook.title,
                "activeItemId": str(active_item_id),
                "items": [_serialize_item(item) for item in notebook.items],
            },
            ensure_ascii=False,
        )

    @tool("Read")
    async def read_notebook_item(item_id: str = "") -> str:
        """Read a notebook item. Leave item_id empty to read the active item."""

        target_id = UUID(item_id) if item_id.strip() else active_item_id
        item = await notebook_service.get_item(target_id)
        return json.dumps(_serialize_item(item), ensure_ascii=False)

    @tool("Write")
    async def write_notebook_item(content: str, item_id: str = "") -> str:
        """Write full Markdown content back into a notebook item."""

        target_id = UUID(item_id) if item_id.strip() else active_item_id
        current = await notebook_service.get_item(target_id)
        updated = await notebook_service.update_item(
            item_id=target_id,
            content=content,
            base_revision=current.server_revision,
        )
        return json.dumps(
            {
                "ok": True,
                **_serialize_item(updated),
            },
            ensure_ascii=False,
        )

    @tool("WebSearch")
    def web_search(query: str) -> str:
        """Search the web for supporting context and return short results with links."""

        if not query.strip():
            return json.dumps({"query": query, "results": []}, ensure_ascii=False)

        try:
            response = httpx.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_redirect": "1", "no_html": "1"},
                timeout=10.0,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:  # pragma: no cover
            return json.dumps(
                {
                    "query": query,
                    "results": [],
                    "error": f"Web search unavailable: {exc}",
                },
                ensure_ascii=False,
            )

        results: list[dict[str, str]] = []
        if payload.get("AbstractText"):
            results.append(
                {
                    "title": payload.get("Heading") or query,
                    "snippet": payload.get("AbstractText", ""),
                    "url": payload.get("AbstractURL", ""),
                }
            )

        for topic in payload.get("RelatedTopics", []):
            entries = topic.get("Topics", []) if isinstance(topic, dict) and "Topics" in topic else [topic]
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                text = entry.get("Text")
                first_url = entry.get("FirstURL")
                if not text or not first_url:
                    continue
                results.append(
                    {
                        "title": text.split(" - ", 1)[0],
                        "snippet": text,
                        "url": first_url,
                    }
                )
                if len(results) >= 5:
                    break
            if len(results) >= 5:
                break

        return json.dumps(
            {
                "query": query,
                "results": results[:5],
            },
            ensure_ascii=False,
        )

    return [list_notebook_items, read_notebook_item, write_notebook_item, web_search]


def extract_notebook_write_result(content: str) -> dict[str, Any] | None:
    """Parse a Write tool notebook payload if present."""

    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        return None

    if not isinstance(payload, dict) or not payload.get("ok"):
        return None
    required_fields = {"itemId", "notebookId", "content", "serverRevision"}
    if not required_fields.issubset(payload):
        return None
    return payload
