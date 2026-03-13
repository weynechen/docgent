# Writing IDE MVP

A Docs-as-Code AI writing workspace with a React/Tiptap frontend and a FastAPI backend fully migrated onto the `fastapi-fullstack` / `full-stack-ai-agent-template` structure.

Current repository structure:

- `frontend`: active React + Tiptap workspace
- `desktop`: planned Electron shell
- `backend`: active Python backend generated from the template and adapted to this product
- `nginx` / `docker-compose*.yml` / `Makefile`: template-aligned operational assets

The current product surface implements:

- three-panel writing workspace
- right-side AI chat panel with enter-to-send, multi-turn history, and streaming assistant output
- selection-aware AI rewrite flow with status streaming, diff preview, and accept/reject
- mock document store with multiple Markdown drafts
- manual version snapshots, history diff, and restore
- Markdown export preview from the current editor state
- FastAPI rewrite backend at `/api/v1/ai/rewrite/*`
- workspace-aware agent chat over `/api/v1/ws/agent` with `Read`, `Write`, `Glob`, `Grep`, and `WebSearch` tools

The next active product track continues hardening the right sidebar agentic chat surface with:

- enter-to-send chat input
- multi-turn conversation state
- streaming assistant message updates
- no-selection task execution over the current workspace
- agent tools such as `Read`, `Write`, `Glob`, `Grep`, and `WebSearch`

## Development

```bash
npm install
npm run dev
```

Create a local `.env` first:

```bash
cp .env.example .env
```

`npm run dev` runs the frontend only.

Required environment variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4o-mini`)
- `OPENAI_BASE_URL` (default: `https://api.openai.com/v1`)

Optional local backend variables:

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `SECRET_KEY`
- `CORS_ORIGINS`
- `LOG_LEVEL`, `LOG_DIR`, `LOG_MAX_BYTES`, `LOG_BACKUP_COUNT`

## Fresh Machine Setup

For a clean machine, bring the project up in this order:

1. Install Node.js, `uv`, and Docker.
2. Install dependencies with `npm install` and `make install`.
3. Create a local env file with `cp .env.example .env`.
4. Set `OPENAI_API_KEY`, `OPENAI_MODEL`, and `OPENAI_BASE_URL` in `.env`.
5. Start PostgreSQL with `make docker-db`.
6. Run migrations with `make db-upgrade`.
7. Start the app with `make run`.

Important local database notes:

- The project Docker PostgreSQL is exposed on host port `5433`, not `5432`.
- `.env.example` is aligned to `5433` for local `make run`.
- If you already run PostgreSQL directly on your machine, either keep this project's Docker DB on `5433` or change `.env` to point at your existing instance.
- `backend/.env.example` remains `5432` because the backend container talks to the `db` container over the internal Docker network.

Recommended smoke checks after startup:

- `make db-current`
- Open `http://localhost:5173`
- Send one message in the right-side AI Chat
- If something fails, inspect `logs/latest/app.log` and `logs/latest/error.log`

## Build

```bash
npm run build
```

## Full Stack

```bash
make install
make run
```

Useful commands:

- `npm run dev`
- `make run-backend`
- `make test`
- `make routes`
- `uv run --project backend docgent_backend --version`

Backend logs are written to `logs/` at the repository root by default. Each backend start creates a fresh `logs/runs/<timestamp-pid>/` directory with `app.log` and `error.log`, and `logs/latest` points to the newest run so the current session can be inspected directly from the workspace.

## Documentation

- Chinese README: [docs/README_CN.md](docs/README_CN.md)
- Docs hub: [docs/product-specs/index.md](docs/product-specs/index.md)
- Design docs: [docs/design-docs/index.md](docs/design-docs/index.md)
- Active execution plans: [docs/PLANS.md](docs/PLANS.md)
