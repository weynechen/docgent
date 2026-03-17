"""Structured logging utilities for the application."""

from __future__ import annotations

import contextvars
import json
import logging
import os
from contextlib import contextmanager
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from time import perf_counter
from typing import Any
from uuid import uuid4

from starlette.datastructures import MutableHeaders
from starlette.requests import Request

from app.core.config import Settings

LOG_CONTEXT_DEFAULTS: dict[str, str | None] = {
    "request_id": None,
    "trace_id": None,
    "span_id": None,
    "parent_span_id": None,
    "trace_flags": None,
    "user_id": None,
}

_log_context_vars: dict[str, contextvars.ContextVar[str | None]] = {
    key: contextvars.ContextVar(key, default=value) for key, value in LOG_CONTEXT_DEFAULTS.items()
}
_log_session_id: str | None = None


def _build_log_session_id() -> str:
    """Create a log session identifier for the current process start."""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    return f"{timestamp}-{os.getpid()}"


def _get_log_session_id(force: bool = False) -> str:
    """Return the current log session ID."""
    global _log_session_id
    if force or _log_session_id is None:
        _log_session_id = _build_log_session_id()
    return _log_session_id


def _prepare_log_paths(log_dir: Path, session_id: str) -> tuple[Path, Path, Path]:
    """Create the per-start log directory and refresh the latest symlink."""
    runs_dir = log_dir / "runs"
    run_dir = runs_dir / session_id
    run_dir.mkdir(parents=True, exist_ok=True)

    latest_path = log_dir / "latest"
    if latest_path.exists() or latest_path.is_symlink():
        if latest_path.is_symlink() or latest_path.is_file():
            latest_path.unlink()
        else:
            raise RuntimeError(f"Expected {latest_path} to be a symlink or file.")
    latest_path.symlink_to(run_dir, target_is_directory=True)
    return run_dir, run_dir / "app.log", run_dir / "error.log"


def _fallback_trace_context() -> dict[str, str | None]:
    """Create a fresh trace context when no upstream trace exists."""
    return {
        "trace_id": uuid4().hex,
        "span_id": uuid4().hex[:16],
        "parent_span_id": None,
        "trace_flags": "01",
    }


def parse_traceparent(traceparent: str | None) -> dict[str, str | None]:
    """Parse a W3C traceparent header if present and valid."""
    if not traceparent:
        return _fallback_trace_context()

    parts = traceparent.strip().split("-")
    if len(parts) != 4:
        return _fallback_trace_context()

    _, trace_id, parent_span_id, trace_flags = parts
    if len(trace_id) != 32 or len(parent_span_id) != 16 or len(trace_flags) != 2:
        return _fallback_trace_context()
    if trace_id == "0" * 32 or parent_span_id == "0" * 16:
        return _fallback_trace_context()

    return {
        "trace_id": trace_id.lower(),
        "span_id": uuid4().hex[:16],
        "parent_span_id": parent_span_id.lower(),
        "trace_flags": trace_flags.lower(),
    }


def get_log_context() -> dict[str, str | None]:
    """Return the current logging context."""
    return {key: var.get() for key, var in _log_context_vars.items()}


def set_log_context(**values: str | None) -> dict[str, contextvars.Token[str | None]]:
    """Set one or more context values and return reset tokens."""
    tokens: dict[str, contextvars.Token[str | None]] = {}
    for key, value in values.items():
        if key in _log_context_vars:
            tokens[key] = _log_context_vars[key].set(value)
    return tokens


def reset_log_context(tokens: dict[str, contextvars.Token[str | None]]) -> None:
    """Reset context variables using the provided tokens."""
    for key, token in tokens.items():
        _log_context_vars[key].reset(token)


@contextmanager
def bind_log_context(**values: str | None):
    """Temporarily bind logging context values."""
    tokens = set_log_context(**values)
    try:
        yield
    finally:
        reset_log_context(tokens)


class RequestContextFilter(logging.Filter):
    """Inject request-scoped context into log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        """Populate default structured fields for the formatter."""
        context = get_log_context()
        record.request_id = getattr(record, "request_id", context["request_id"])
        record.trace_id = getattr(record, "trace_id", context["trace_id"])
        record.span_id = getattr(record, "span_id", context["span_id"])
        record.parent_span_id = getattr(record, "parent_span_id", context["parent_span_id"])
        record.trace_flags = getattr(record, "trace_flags", context["trace_flags"])
        record.user_id = getattr(record, "user_id", context["user_id"])
        record.event_name = getattr(record, "event_name", "application.log")
        record.path = getattr(record, "path", None)
        record.method = getattr(record, "method", None)
        record.status_code = getattr(record, "status_code", None)
        record.duration_ms = getattr(record, "duration_ms", None)
        record.client_ip = getattr(record, "client_ip", None)
        record.error_code = getattr(record, "error_code", None)
        record.attributes = getattr(record, "attributes", {})
        return True


class JsonFormatter(logging.Formatter):
    """Render logs as JSON lines."""

    def __init__(self, settings: Settings) -> None:
        super().__init__(datefmt="%Y-%m-%dT%H:%M:%S%z")
        self.settings = settings

    def format(self, record: logging.LogRecord) -> str:
        """Format the log record as JSON."""
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "severity": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "event_name": getattr(record, "event_name", "application.log"),
            "service_name": self.settings.PROJECT_NAME,
            "environment": self.settings.ENVIRONMENT,
            "request_id": getattr(record, "request_id", None),
            "trace_id": getattr(record, "trace_id", None),
            "span_id": getattr(record, "span_id", None),
            "parent_span_id": getattr(record, "parent_span_id", None),
            "trace_flags": getattr(record, "trace_flags", None),
            "user_id": getattr(record, "user_id", None),
            "http": {
                "method": getattr(record, "method", None),
                "path": getattr(record, "path", None),
                "status_code": getattr(record, "status_code", None),
                "client_ip": getattr(record, "client_ip", None),
            },
            "duration_ms": getattr(record, "duration_ms", None),
            "error": {
                "code": getattr(record, "error_code", None),
            },
            "attributes": getattr(record, "attributes", {}),
        }

        if record.exc_info:
            payload["error"]["stacktrace"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def log_event(
    logger: logging.Logger,
    level: int,
    event_name: str,
    message: str,
    exc_info: BaseException | tuple[type[BaseException], BaseException, Any] | None = None,
    **attributes: Any,
) -> None:
    """Write a structured log event."""
    record_fields: dict[str, Any] = {}
    for key in ("request_id", "trace_id", "span_id", "parent_span_id", "trace_flags", "user_id"):
        if key in attributes:
            record_fields[key] = attributes.pop(key)

    for key in ("method", "path", "status_code", "client_ip", "duration_ms", "error_code"):
        if key in attributes:
            record_fields[key] = attributes.pop(key)

    logger.log(
        level,
        message,
        exc_info=exc_info,
        extra={
            "event_name": event_name,
            "attributes": attributes,
            **record_fields,
        },
    )


def setup_logging(settings: Settings, *, force: bool = False) -> None:
    """Configure application logging."""
    root_logger = logging.getLogger()
    already_configured = getattr(root_logger, "_docgent_logging_configured", False)
    if already_configured and not force:
        return

    log_dir = Path(settings.LOG_DIR)
    log_dir.mkdir(parents=True, exist_ok=True)

    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    formatter = JsonFormatter(settings)
    context_filter = RequestContextFilter()
    session_id = _get_log_session_id(force=force)
    run_dir, app_log_path, error_log_path = _prepare_log_paths(log_dir, session_id)

    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)
        handler.close()

    root_logger.setLevel(log_level)

    app_handler = RotatingFileHandler(
        filename=app_log_path,
        maxBytes=settings.LOG_MAX_BYTES,
        backupCount=settings.LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    app_handler.setLevel(log_level)
    app_handler.setFormatter(formatter)
    app_handler.addFilter(context_filter)
    root_logger.addHandler(app_handler)

    error_handler = RotatingFileHandler(
        filename=error_log_path,
        maxBytes=settings.LOG_MAX_BYTES,
        backupCount=settings.LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    error_handler.addFilter(context_filter)
    root_logger.addHandler(error_handler)

    if settings.LOG_TO_STDOUT:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(log_level)
        console_handler.setFormatter(formatter)
        console_handler.addFilter(context_filter)
        root_logger.addHandler(console_handler)

    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(logger_name)
        logger.handlers.clear()
        logger.propagate = True

    root_logger.info(
        "Logging configured",
        extra={
            "event_name": "application.logging.configured",
            "attributes": {
                "log_session_id": session_id,
                "run_dir": str(run_dir),
                "app_log_path": str(app_log_path),
                "error_log_path": str(error_log_path),
                "postgres_host": settings.POSTGRES_HOST,
                "postgres_port": settings.POSTGRES_PORT,
                "postgres_db": settings.POSTGRES_DB,
                "openai_base_url": settings.OPENAI_BASE_URL,
            },
        },
    )
    root_logger._docgent_logging_configured = True  # type: ignore[attr-defined]


class RequestContextMiddleware:
    """Bind request IDs, trace IDs, and access logs for every HTTP request."""

    def __init__(self, app) -> None:
        """Initialize the middleware."""
        self.app = app
        self.logger = logging.getLogger("app.request")

    async def __call__(self, scope, receive, send) -> None:
        """Attach request context and write an access log entry."""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        request_id = request.headers.get("X-Request-ID") or request.headers.get("x-request-id")
        request_id = request_id or uuid4().hex
        trace_context = parse_traceparent(request.headers.get("traceparent"))

        state = scope.setdefault("state", {})
        state["request_id"] = request_id
        state["trace_id"] = trace_context["trace_id"]
        state["span_id"] = trace_context["span_id"]
        state["parent_span_id"] = trace_context["parent_span_id"]
        state["trace_flags"] = trace_context["trace_flags"]

        started_at = perf_counter()
        status_code: int | None = None

        async def send_with_context(message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = MutableHeaders(scope=message)
                headers["X-Request-ID"] = request_id
            await send(message)

        with bind_log_context(request_id=request_id, **trace_context):
            await self.app(scope, receive, send_with_context)

            duration_ms = round((perf_counter() - started_at) * 1000, 2)
            log_event(
                self.logger,
                logging.INFO,
                "http.server.request.completed",
                "HTTP request completed",
                method=request.method,
                path=request.url.path,
                status_code=status_code,
                client_ip=request.client.host if request.client else None,
                duration_ms=duration_ms,
            )
