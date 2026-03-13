"""Temporary workspace service backed by per-session files on disk."""

from __future__ import annotations

import shutil
import time
import fnmatch
from dataclasses import dataclass, field
from pathlib import Path
from tempfile import mkdtemp
from uuid import uuid4

from app.core.exceptions import BadRequestError, NotFoundError
from app.schemas.workspace import (
    WorkspaceCreateResponse,
    WorkspaceEntry,
    WorkspaceFileResponse,
    WorkspaceTreeResponse,
)

SAMPLE_DOCS: tuple[tuple[str, str], ...] = (
    (
        "drafts/docs-as-code-writing.md",
        """# Docs-as-Code Writing

Writing should feel like building a system, not losing text in a black box.

## Problem

Writers often jump between a local note app, a web AI tool, and a publishing platform. That context switching slows thinking down.

## Draft

I want an editor where I can write roughly, select one paragraph, ask AI to make it clearer, review the diff, and decide whether to apply it.

This product should make version history feel normal, even for users who never want to learn Git.
""",
    ),
    (
        "drafts/zhihu-outline.md",
        """# 知乎文章提纲

## 主题

为什么写作工具应该把版本管理作为默认能力。

## 要点

- 当前工作流割裂
- AI 改写不可审查
- 本地 Markdown 和版本回溯天然适合长文写作
""",
    ),
)


@dataclass
class WorkspaceSession:
    """Runtime state for a temporary writing workspace."""

    id: str
    root_path: Path
    revisions: dict[str, int] = field(default_factory=dict)
    last_saved_at: dict[str, int] = field(default_factory=dict)


class WorkspaceService:
    """Manage temporary workspaces that act as the backend source of truth."""

    def __init__(self) -> None:
        self._sessions: dict[str, WorkspaceSession] = {}

    def create_workspace(self) -> WorkspaceCreateResponse:
        """Create a seeded temporary workspace and return its session id."""

        session_id = str(uuid4())
        root_path = Path(mkdtemp(prefix="docgent-workspace-"))
        session = WorkspaceSession(id=session_id, root_path=root_path)

        for relative_path, content in SAMPLE_DOCS:
            file_path = root_path / relative_path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(content, encoding="utf-8")
            session.revisions[relative_path] = 1
            session.last_saved_at[relative_path] = _now_ms()

        self._sessions[session_id] = session
        return WorkspaceCreateResponse(sessionId=session_id)

    def has_workspace(self, session_id: str) -> bool:
        """Return whether a workspace exists."""

        return session_id in self._sessions

    def list_tree(self, session_id: str) -> WorkspaceTreeResponse:
        """List all files and directories in a workspace."""

        session = self._get_session(session_id)
        entries: list[WorkspaceEntry] = []

        for path in sorted(session.root_path.rglob("*")):
            relative_path = path.relative_to(session.root_path).as_posix()
            if not relative_path:
                continue
            entries.append(
                WorkspaceEntry(
                    path=relative_path,
                    name=path.name,
                    nodeType="directory" if path.is_dir() else "file",
                )
            )

        return WorkspaceTreeResponse(sessionId=session_id, entries=entries)

    def glob_paths(self, session_id: str, pattern: str) -> list[str]:
        """Return workspace-relative paths matching a glob pattern."""

        session = self._get_session(session_id)
        normalized_pattern = pattern or "**/*"
        matches: list[str] = []

        for path in sorted(session.root_path.rglob("*")):
            relative_path = path.relative_to(session.root_path).as_posix()
            if not relative_path:
                continue
            if fnmatch.fnmatch(relative_path, normalized_pattern):
                matches.append(relative_path)

        return matches

    def read_file(self, session_id: str, doc_path: str) -> WorkspaceFileResponse:
        """Read a file from a workspace."""

        session = self._get_session(session_id)
        file_path = self._resolve_file_path(session, doc_path)
        if not file_path.exists() or not file_path.is_file():
            raise NotFoundError(message=f"Document not found: {doc_path}")

        return WorkspaceFileResponse(
            sessionId=session_id,
            path=doc_path,
            name=file_path.name,
            content=file_path.read_text(encoding="utf-8"),
            revision=session.revisions.get(doc_path, 1),
            lastSavedAt=session.last_saved_at.get(doc_path, _now_ms()),
        )

    def write_file(
        self,
        session_id: str,
        doc_path: str,
        content: str,
        base_revision: int,
    ) -> WorkspaceFileResponse:
        """Persist a full Markdown document back into the workspace."""

        session = self._get_session(session_id)
        file_path = self._resolve_file_path(session, doc_path)
        current_revision = session.revisions.get(doc_path)

        if current_revision is None or not file_path.exists():
            raise NotFoundError(message=f"Document not found: {doc_path}")
        if current_revision != base_revision:
            raise BadRequestError(
                message="Document revision is outdated. Reload the latest workspace file before saving.",
                code="REVISION_CONFLICT",
            )

        file_path.write_text(content, encoding="utf-8")
        session.revisions[doc_path] = current_revision + 1
        session.last_saved_at[doc_path] = _now_ms()
        return self.read_file(session_id, doc_path)

    def get_plain_text_slice(self, session_id: str, doc_path: str, start: int, end: int) -> str:
        """Return a plain-text selection derived from the current Markdown file."""

        file = self.read_file(session_id, doc_path)
        plain_text = markdown_to_plain_text(file.content)
        if start < 0 or end < start or end > len(plain_text):
            raise BadRequestError(
                message="Selection range is invalid for the current document.",
                code="INVALID_SELECTION_RANGE",
            )
        return plain_text[start:end]

    def grep(self, session_id: str, query: str, pattern: str = "**/*") -> list[dict[str, str | int]]:
        """Search matching workspace files for lines containing the query."""

        if not query.strip():
            raise BadRequestError(message="grep query must not be empty.", code="EMPTY_GREP_QUERY")

        session = self._get_session(session_id)
        results: list[dict[str, str | int]] = []

        for relative_path in self.glob_paths(session_id, pattern):
            file_path = self._resolve_file_path(session, relative_path)
            if not file_path.is_file():
                continue

            try:
                content = file_path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue

            for line_number, line in enumerate(content.splitlines(), start=1):
                if query.lower() not in line.lower():
                    continue
                results.append(
                    {
                        "path": relative_path,
                        "line_number": line_number,
                        "line": line.strip(),
                    }
                )

        return results

    def dispose_workspace(self, session_id: str) -> None:
        """Delete a temporary workspace and its files."""

        session = self._sessions.pop(session_id, None)
        if session is None:
            return
        shutil.rmtree(session.root_path, ignore_errors=True)

    def _get_session(self, session_id: str) -> WorkspaceSession:
        session = self._sessions.get(session_id)
        if session is None:
            raise NotFoundError(message=f"Workspace not found: {session_id}")
        return session

    def _resolve_file_path(self, session: WorkspaceSession, doc_path: str) -> Path:
        candidate = (session.root_path / doc_path).resolve()
        try:
            candidate.relative_to(session.root_path.resolve())
        except ValueError as exc:
            raise BadRequestError(message="docPath must stay inside the workspace.") from exc
        return candidate


def markdown_to_plain_text(markdown: str) -> str:
    """Project Markdown into plain text for selection offset matching."""

    import re

    lines = markdown.replace("\r\n", "\n").split("\n")
    in_code_block = False
    rendered_lines: list[str] = []

    for line in lines:
        if line.startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            rendered_lines.append(line)
            continue

        current = re.sub(r"^#{1,6}\s+", "", line)
        current = re.sub(r"^>\s?", "", current)
        current = re.sub(r"^-\s+", "", current)
        current = re.sub(r"`([^`]*)`", r"\1", current)
        current = re.sub(r"\*\*(.*?)\*\*", r"\1", current)
        current = re.sub(r"\*(.*?)\*", r"\1", current)
        rendered_lines.append(current)

    return "\n".join(rendered_lines)


def _now_ms() -> int:
    return int(time.time() * 1000)


workspace_service = WorkspaceService()
