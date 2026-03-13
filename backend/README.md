# Docgent Backend

This backend is the repository's integrated `fastapi-fullstack` / `full-stack-ai-agent-template` service.

## Run

```bash
uv sync --project backend --extra dev
uv run --project backend docgent_backend server run --reload
```

If you run backend commands from the repository root, prefer the `make` wrappers:

```bash
make docker-db
make db-upgrade
make run-backend
```

Environment split:

- Root `.env` is used by local `make run` / `uv run` workflows
- `backend/.env` is used by `docker-compose` for the backend container
- Host Docker PostgreSQL is exposed on `5433`
- Container-to-container PostgreSQL stays on `5432`

## Logging

- Default log directory: `../logs` relative to `backend/`, i.e. repository root `logs/`
- Each backend start writes to a fresh `logs/runs/<timestamp-pid>/` directory
- `logs/latest` points to the newest run directory
- Files: `app.log` for general runtime/access logs, `error.log` for errors and exceptions
- Rotation: controlled by `LOG_MAX_BYTES` and `LOG_BACKUP_COUNT`
- Override with `LOG_DIR` if you need a different location
- Format: JSON lines with `request_id`, `trace_id`, `span_id`, `event_name`, and structured attributes
- Trace context: incoming `traceparent` headers are parsed now so future OpenTelemetry adoption can reuse the same correlation model

## Current AI entrypoints

- `POST /api/v1/ai/rewrite/runs`
- `GET /api/v1/ai/rewrite/{run_id}/events`

## Notes

- The rewrite flow is implemented in `app/agents/rewrite.py`, `app/services/rewrite.py`, and `app/api/routes/v1/rewrite.py`.
- The broader template capabilities such as auth, repositories, CLI commands, Docker files, and DB structure are kept in place for future backend work.
