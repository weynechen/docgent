"""Pydantic schemas."""
# ruff: noqa: I001, RUF022 - Imports structured for Jinja2 template conditionals

from app.schemas.token import Token, TokenPayload
from app.schemas.user import UserCreate, UserRead, UserUpdate

from app.schemas.session import SessionRead, SessionListResponse, LogoutAllResponse

from app.schemas.item import ItemCreate, ItemRead, ItemUpdate
from app.schemas.notebook import (
    NotebookCreate,
    NotebookItemCreate,
    NotebookItemRead,
    NotebookItemUpdate,
    NotebookRead,
)

from app.schemas.conversation import (
    ConversationCreate,
    ConversationRead,
    ConversationUpdate,
    MessageCreate,
    MessageRead,
    ToolCallRead,
)
from app.schemas.rewrite import (
    ProposedEdit,
    RewriteApplyResponse,
    RewriteDoneEvent,
    RewriteErrorEvent,
    RewriteRequest,
    RewriteResultEvent,
    RewriteRunResponse,
    RewriteSuggestion,
    RewriteStatusEvent,
)
from app.schemas.workspace import (
    WorkspaceCreateResponse,
    WorkspaceEntry,
    WorkspaceFileResponse,
    WorkspaceFileUpdateRequest,
    WorkspaceTreeResponse,
)

__all__ = [
    "UserCreate",
    "UserRead",
    "UserUpdate",
    "Token",
    "TokenPayload",
    "SessionRead",
    "SessionListResponse",
    "LogoutAllResponse",
    "ItemCreate",
    "ItemRead",
    "ItemUpdate",
    "NotebookCreate",
    "NotebookItemCreate",
    "NotebookItemRead",
    "NotebookItemUpdate",
    "NotebookRead",
    "ConversationCreate",
    "ConversationRead",
    "ConversationUpdate",
    "MessageCreate",
    "MessageRead",
    "ToolCallRead",
    "ProposedEdit",
    "RewriteApplyResponse",
    "RewriteDoneEvent",
    "RewriteErrorEvent",
    "RewriteRequest",
    "RewriteResultEvent",
    "RewriteRunResponse",
    "RewriteSuggestion",
    "RewriteStatusEvent",
    "WorkspaceCreateResponse",
    "WorkspaceEntry",
    "WorkspaceFileResponse",
    "WorkspaceFileUpdateRequest",
    "WorkspaceTreeResponse",
]
