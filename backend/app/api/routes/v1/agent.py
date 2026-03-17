"""AI Agent WebSocket routes with streaming support (LangChain)."""

from contextlib import asynccontextmanager
import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from langchain.messages import AIMessage, AIMessageChunk, ToolMessage
from sqlalchemy.exc import SQLAlchemyError

from app.agents.langchain_assistant import AgentContext, get_agent
from app.agents.prompts import (
    build_notebook_chat_system_prompt,
    build_workspace_chat_system_prompt,
)
from app.agents.tools import (
    create_notebook_tools,
    create_workspace_tools,
    extract_notebook_write_result,
    extract_write_result,
    summarize_tool_result,
)
from app.api.deps import get_conversation_service
from app.db.session import get_db_context
from app.schemas.conversation import (
    ConversationCreate,
    MessageCreate,
)
from app.services.conversation import ConversationService
from app.services.notebook import NotebookService
from app.services.workspace import workspace_service

logger = logging.getLogger(__name__)

router = APIRouter()
conversation_persistence_enabled = True


async def get_conversation_service_for_websocket(db: Any) -> ConversationService:
    """Resolve the async conversation dependency for WebSocket handlers."""
    return await get_conversation_service(db)


class AgentConnectionManager:
    """WebSocket connection manager for AI agent."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and store a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Agent WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(
            f"Agent WebSocket disconnected. Total connections: {len(self.active_connections)}"
        )

    async def send_event(self, websocket: WebSocket, event_type: str, data: Any) -> bool:
        """Send a JSON event to a specific WebSocket client.

        Returns True if sent successfully, False if connection is closed.
        """
        try:
            await websocket.send_json({"type": event_type, "data": data})
            return True
        except (WebSocketDisconnect, RuntimeError):
            # Connection already closed
            return False


manager = AgentConnectionManager()


@asynccontextmanager
async def get_agent_runtime(
    *,
    session_id: str | None,
    doc_path: str | None,
    notebook_id: str | None,
    item_id: str | None,
    selection: dict[str, Any] | None,
):
    """Build the correct agent runtime for either workspace or notebook mode."""

    if notebook_id and item_id:
        parsed_notebook_id = UUID(notebook_id)
        parsed_item_id = UUID(item_id)
        async with get_db_context() as db:
            notebook_service = NotebookService(db)
            active_item = await notebook_service.get_item(parsed_item_id)
            assistant = get_agent(
                system_prompt=build_notebook_chat_system_prompt(
                    active_item_title=active_item.title,
                    selection_start=selection.get("start") if isinstance(selection, dict) else None,
                    selection_end=selection.get("end") if isinstance(selection, dict) else None,
                    selection_text=selection.get("text") if isinstance(selection, dict) else None,
                ),
                tools=create_notebook_tools(
                    notebook_service=notebook_service,
                    notebook_id=parsed_notebook_id,
                    active_item_id=parsed_item_id,
                ),
            )
            yield assistant
        return

    if not session_id or not doc_path:
        raise ValueError("Either notebook_id/item_id or session_id/doc_path are required.")

    assistant = get_agent(
        system_prompt=build_workspace_chat_system_prompt(
            active_doc_path=doc_path,
            selection_start=selection.get("start") if isinstance(selection, dict) else None,
            selection_end=selection.get("end") if isinstance(selection, dict) else None,
            selection_text=selection.get("text") if isinstance(selection, dict) else None,
        ),
        tools=create_workspace_tools(
            workspace_service=workspace_service,
            session_id=session_id,
            active_doc_path=doc_path,
        ),
    )
    yield assistant


async def emit_write_event(websocket: WebSocket, content: str) -> None:
    """Emit the appropriate write event when a tool persisted content."""

    workspace_write = extract_write_result(content)
    if workspace_write:
        await manager.send_event(
            websocket,
            "workspace_file_updated",
            {
                "doc_path": workspace_write["path"],
                "revision": workspace_write["revision"],
                "content": workspace_write["content"],
                "last_saved_at": workspace_write["lastSavedAt"],
            },
        )
        return

    notebook_write = extract_notebook_write_result(content)
    if notebook_write:
        await manager.send_event(
            websocket,
            "notebook_item_updated",
            {
                "item_id": notebook_write["itemId"],
                "notebook_id": notebook_write["notebookId"],
                "revision": notebook_write["serverRevision"],
                "content": notebook_write["content"],
                "title": notebook_write["title"],
                "item_type": notebook_write["type"],
                "content_format": notebook_write["contentFormat"],
                "order_index": notebook_write["orderIndex"],
            },
        )


@router.websocket("/ws/agent")
async def agent_websocket(
    websocket: WebSocket,
) -> None:
    """WebSocket endpoint for AI agent with streaming support.

    Uses LangChain stream() to stream agent events including:
    - user_prompt: When user input is received
    - text_delta: Streaming text from the model
    - tool_call: When a tool is called
    - tool_result: When a tool returns a result
    - final_result: When the final result is ready
    - complete: When processing is complete
    - error: When an error occurs

    Expected input message format:
    {
        "message": "user message here",
        "history": [{"role": "user|assistant|system", "content": "..."}],
        "conversation_id": "optional-uuid-to-continue-existing-conversation",
        "session_id": "workspace session id",
        "doc_path": "active workspace document path",
        "selection": {"start": 0, "end": 10, "text": "..."}
    }

    Persistence: Set 'conversation_id' to continue an existing conversation.
    If not provided, a new conversation is created. The conversation_id is
    returned in the 'conversation_created' event.
    """

    await manager.connect(websocket)

    # Conversation state per connection
    conversation_history: list[dict[str, str]] = []
    context: AgentContext = {}
    current_conversation_id: str | None = None
    global conversation_persistence_enabled

    try:
        while True:
            # Receive user message
            try:
                data = await websocket.receive_json()
            except (WebSocketDisconnect, RuntimeError):
                break
            user_message = data.get("message", "")
            session_id = data.get("session_id")
            doc_path = data.get("doc_path")
            notebook_id = data.get("notebook_id")
            item_id = data.get("item_id")
            selection = data.get("selection")
            # Optionally accept history from client (or use server-side tracking)
            if "history" in data:
                conversation_history = data["history"]

            if not user_message:
                await manager.send_event(websocket, "error", {"message": "Empty message"})
                continue
            if not (notebook_id and item_id) and not (session_id and doc_path):
                await manager.send_event(
                    websocket,
                    "error",
                    {
                        "message": "Either notebook_id and item_id, or session_id and doc_path, are required."
                    },
                )
                continue

            # Handle conversation persistence
            if conversation_persistence_enabled:
                try:
                    async with get_db_context() as db:
                        conv_service = await get_conversation_service_for_websocket(db)

                        requested_conv_id = data.get("conversation_id")
                        if requested_conv_id:
                            current_conversation_id = requested_conv_id
                            await conv_service.get_conversation(UUID(requested_conv_id))
                        elif not current_conversation_id:
                            conv_data = ConversationCreate(
                                title=user_message[:50] if len(user_message) > 50 else user_message,
                            )
                            conversation = await conv_service.create_conversation(conv_data)
                            current_conversation_id = str(conversation.id)
                            await manager.send_event(
                                websocket,
                                "conversation_created",
                                {"conversation_id": current_conversation_id},
                            )

                        await conv_service.add_message(
                            UUID(current_conversation_id),
                            MessageCreate(role="user", content=user_message),
                        )
                except SQLAlchemyError as exc:
                    conversation_persistence_enabled = False
                    logger.warning(
                        "Conversation persistence disabled because the database is unavailable: %s",
                        exc,
                    )
                except Exception as exc:
                    logger.warning("Failed to persist conversation: %s", exc)

            await manager.send_event(websocket, "user_prompt", {"content": user_message})

            try:
                async with get_agent_runtime(
                    session_id=session_id,
                    doc_path=doc_path,
                    notebook_id=notebook_id,
                    item_id=item_id,
                    selection=selection if isinstance(selection, dict) else None,
                ) as assistant:
                    final_output = ""
                    tool_events: list[Any] = []
                    seen_tool_call_ids: set[str] = set()

                    await manager.send_event(websocket, "model_request_start", {})

                    async for stream_mode, data in assistant.stream(
                        user_input=user_message,
                        history=conversation_history,
                        context=context or None,
                    ):
                        if stream_mode == "messages":
                            token, metadata = data

                            if isinstance(token, AIMessageChunk):
                                if token.content:
                                    text_content = ""
                                    if isinstance(token.content, str):
                                        text_content = token.content
                                    elif isinstance(token.content, list):
                                        for block in token.content:
                                            if isinstance(block, dict) and block.get("type") == "text":
                                                text_content += block.get("text", "")
                                            elif isinstance(block, str):
                                                text_content += block

                                    if text_content:
                                        await manager.send_event(
                                            websocket,
                                            "text_delta",
                                            {"content": text_content},
                                        )
                                        final_output += text_content

                                if token.tool_call_chunks:
                                    for tc_chunk in token.tool_call_chunks:
                                        tc_id = tc_chunk.get("id")
                                        tc_name = tc_chunk.get("name")
                                        if tc_id and tc_name and tc_id not in seen_tool_call_ids:
                                            seen_tool_call_ids.add(tc_id)
                                            await manager.send_event(
                                                websocket,
                                                "tool_call",
                                                {
                                                    "tool_name": tc_name,
                                                    "args": {},
                                                    "tool_call_id": tc_id,
                                                },
                                            )

                        elif stream_mode == "updates":
                            for node_name, update in data.items():
                                if node_name == "tools":
                                    for msg in update.get("messages", []):
                                        if not isinstance(msg, ToolMessage):
                                            continue
                                        await manager.send_event(
                                            websocket,
                                            "tool_result",
                                            {
                                                "tool_call_id": msg.tool_call_id,
                                                "content": summarize_tool_result(str(msg.content)),
                                                "raw_content": str(msg.content),
                                            },
                                        )
                                        await emit_write_event(websocket, str(msg.content))
                                elif node_name == "model":
                                    for msg in update.get("messages", []):
                                        if isinstance(msg, AIMessage) and msg.tool_calls:
                                            for tc in msg.tool_calls:
                                                tc_id = tc.get("id", "")
                                                if tc_id not in seen_tool_call_ids:
                                                    seen_tool_call_ids.add(tc_id)
                                                    tool_events.append(tc)
                                                    await manager.send_event(
                                                        websocket,
                                                        "tool_call",
                                                        {
                                                            "tool_name": tc.get("name", ""),
                                                            "args": tc.get("args", {}),
                                                            "tool_call_id": tc_id,
                                                        },
                                                    )

                    await manager.send_event(
                        websocket,
                        "final_result",
                        {"output": final_output},
                    )

                    # Update conversation history
                    conversation_history.append({"role": "user", "content": user_message})
                    if final_output:
                        conversation_history.append({"role": "assistant", "content": final_output})

                    # Save assistant response to database
                    if conversation_persistence_enabled and current_conversation_id and final_output:
                        try:
                            async with get_db_context() as db:
                                conv_service = await get_conversation_service_for_websocket(db)
                                await conv_service.add_message(
                                    UUID(current_conversation_id),
                                    MessageCreate(
                                        role="assistant",
                                        content=final_output,
                                        model_name=assistant.model_name
                                        if hasattr(assistant, "model_name")
                                        else None,
                                    ),
                                )
                        except SQLAlchemyError as exc:
                            conversation_persistence_enabled = False
                            logger.warning(
                                "Conversation persistence disabled while saving assistant response: %s",
                                exc,
                            )
                        except Exception as exc:
                            logger.warning("Failed to persist assistant response: %s", exc)

                    await manager.send_event(
                        websocket,
                        "complete",
                        {
                            "conversation_id": current_conversation_id,
                        },
                    )

            except WebSocketDisconnect:
                # Client disconnected during processing - this is normal
                logger.info("Client disconnected during agent processing")
                break
            except Exception as e:
                logger.exception(f"Error processing agent request: {e}")
                # Try to send error, but don't fail if connection is closed
                await manager.send_event(websocket, "error", {"message": str(e)})

    except WebSocketDisconnect:
        pass  # Normal disconnect
    finally:
        manager.disconnect(websocket)
