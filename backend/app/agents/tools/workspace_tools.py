"""Workspace-scoped tools for the conversational agent."""

from __future__ import annotations

import json
from typing import Any

import httpx
from langchain.tools import tool

from app.services.workspace import WorkspaceService


def create_workspace_tools(
    *,
    workspace_service: WorkspaceService,
    session_id: str,
    active_doc_path: str,
) -> list[Any]:
    """Create workspace-aware agent tools bound to one workspace session."""

    @tool("Read")
    def read_workspace_file(doc_path: str = "") -> str:
        """Read a workspace file. Leave doc_path empty to read the active document."""

        target_path = doc_path.strip() or active_doc_path
        file = workspace_service.read_file(session_id, target_path)
        return json.dumps(
            {
                "path": file.path,
                "revision": file.revision,
                "content": file.content,
            },
            ensure_ascii=False,
        )

    @tool("Write")
    def write_workspace_file(content: str, doc_path: str = "") -> str:
        """Write a full Markdown document back into the workspace."""

        target_path = doc_path.strip() or active_doc_path
        current = workspace_service.read_file(session_id, target_path)
        updated = workspace_service.write_file(
            session_id,
            target_path,
            content,
            current.revision,
        )
        return json.dumps(
            {
                "ok": True,
                "path": updated.path,
                "revision": updated.revision,
                "content": updated.content,
                "lastSavedAt": updated.last_saved_at,
            },
            ensure_ascii=False,
        )

    @tool("Glob")
    def glob_workspace_files(pattern: str = "**/*") -> str:
        """List workspace paths matching a glob pattern."""

        return json.dumps(
            {
                "pattern": pattern,
                "matches": workspace_service.glob_paths(session_id, pattern),
            },
            ensure_ascii=False,
        )

    @tool("Grep")
    def grep_workspace(query: str, pattern: str = "**/*") -> str:
        """Search matching workspace files for a case-insensitive string."""

        return json.dumps(
            {
                "query": query,
                "pattern": pattern,
                "matches": workspace_service.grep(session_id, query, pattern),
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

    return [
        read_workspace_file,
        write_workspace_file,
        glob_workspace_files,
        grep_workspace,
        web_search,
    ]


def summarize_tool_result(content: str, *, limit: int = 280) -> str:
    """Reduce a tool result payload to a UI-friendly preview."""

    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        return content[:limit]

    if isinstance(payload, dict):
        if isinstance(payload.get("content"), str):
            return payload["content"][:limit]
        if isinstance(payload.get("matches"), list):
            return json.dumps(payload["matches"][:5], ensure_ascii=False)[:limit]
        if isinstance(payload.get("results"), list):
            return json.dumps(payload["results"][:3], ensure_ascii=False)[:limit]
    return json.dumps(payload, ensure_ascii=False)[:limit]


def extract_write_result(content: str) -> dict[str, Any] | None:
    """Parse a Write tool payload if present."""

    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        return None

    if not isinstance(payload, dict) or not payload.get("ok"):
        return None
    if "path" not in payload or "content" not in payload or "revision" not in payload:
        return None
    return payload
