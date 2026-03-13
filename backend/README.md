# Docgent Backend

This backend is the repository's integrated `fastapi-fullstack` / `full-stack-ai-agent-template` service.

## Run

```bash
uv sync --project backend --extra dev
uv run --project backend docgent_backend server run --reload
```

## Current AI entrypoints

- `POST /api/v1/ai/rewrite/runs`
- `GET /api/v1/ai/rewrite/{run_id}/events`

## Notes

- The rewrite flow is implemented in `app/agents/rewrite.py`, `app/services/rewrite.py`, and `app/api/routes/v1/rewrite.py`.
- The broader template capabilities such as auth, repositories, CLI commands, Docker files, and DB structure are kept in place for future backend work.
