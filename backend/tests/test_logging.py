"""Logging tests."""

from __future__ import annotations

import json
import logging
from pathlib import Path

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.logging import parse_traceparent, setup_logging


def _flush_handlers() -> None:
    """Flush all configured root handlers."""
    for handler in logging.getLogger().handlers:
        handler.flush()


def _read_json_lines(path: Path) -> list[dict[str, object]]:
    """Read structured JSON logs from a file."""
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def _latest_run_dir(base_dir: Path) -> Path:
    """Resolve the latest per-start log directory."""
    return (base_dir / "latest").resolve()


def test_setup_logging_writes_files(tmp_path: Path) -> None:
    """The logging setup should create and write per-start log files."""
    original_dir = settings.LOG_DIR

    try:
        settings.LOG_DIR = str(tmp_path)
        setup_logging(settings, force=True)

        logger = logging.getLogger("tests.logging")
        logger.info("info message")
        logger.error("error message")
        _flush_handlers()

        latest_run_dir = _latest_run_dir(tmp_path)
        app_log = latest_run_dir / settings.LOG_APP_FILE_NAME
        error_log = latest_run_dir / settings.LOG_ERROR_FILE_NAME

        assert app_log.exists()
        assert error_log.exists()

        app_entries = _read_json_lines(app_log)
        error_entries = _read_json_lines(error_log)

        assert any(entry["message"] == "info message" for entry in app_entries)
        assert any(entry["message"] == "error message" for entry in error_entries)
        assert all("trace_id" in entry for entry in app_entries)
    finally:
        settings.LOG_DIR = original_dir
        setup_logging(settings, force=True)


def test_setup_logging_creates_new_run_directory_per_restart(tmp_path: Path) -> None:
    """Each forced logging setup should create a fresh run directory."""
    original_dir = settings.LOG_DIR

    try:
        settings.LOG_DIR = str(tmp_path)
        setup_logging(settings, force=True)
        first_run_dir = _latest_run_dir(tmp_path)

        setup_logging(settings, force=True)
        second_run_dir = _latest_run_dir(tmp_path)

        assert first_run_dir != second_run_dir
        assert first_run_dir.exists()
        assert second_run_dir.exists()
    finally:
        settings.LOG_DIR = original_dir
        setup_logging(settings, force=True)


@pytest.mark.anyio
async def test_request_logs_include_request_id(client: AsyncClient, tmp_path: Path) -> None:
    """Access logs should persist the request ID for later debugging."""
    original_dir = settings.LOG_DIR

    try:
        settings.LOG_DIR = str(tmp_path)
        setup_logging(settings, force=True)

        response = await client.get(
            f"{settings.API_V1_STR}/health",
            headers={
                "X-Request-ID": "req-test-123",
                "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
            },
        )

        _flush_handlers()

        assert response.status_code == 200
        assert response.headers["X-Request-ID"] == "req-test-123"

        app_log = _latest_run_dir(tmp_path) / settings.LOG_APP_FILE_NAME
        entries = _read_json_lines(app_log)
        request_entry = next(
            entry for entry in entries if entry["event_name"] == "http.server.request.completed"
        )
        http_entry = request_entry["http"]

        assert request_entry["request_id"] == "req-test-123"
        assert request_entry["trace_id"] == "4bf92f3577b34da6a3ce929d0e0e4736"
        assert request_entry["parent_span_id"] == "00f067aa0ba902b7"
        assert http_entry["path"] == "/api/v1/health"
        assert http_entry["status_code"] == 200
    finally:
        settings.LOG_DIR = original_dir
        setup_logging(settings, force=True)


def test_parse_traceparent_generates_new_span_id() -> None:
    """Traceparent parsing should preserve trace ID and parent span ID."""
    context = parse_traceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
    assert context["trace_id"] == "4bf92f3577b34da6a3ce929d0e0e4736"
    assert context["parent_span_id"] == "00f067aa0ba902b7"
    assert context["trace_flags"] == "01"
    assert context["span_id"] is not None
    assert len(context["span_id"]) == 16
