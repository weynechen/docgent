# Writing IDE MVP

A Docs-as-Code AI writing workspace with a React/Tiptap frontend and a FastAPI backend fully migrated onto the `fastapi-fullstack` / `full-stack-ai-agent-template` structure.

Current repository structure:

- `frontend`: active React + Tiptap workspace
- `desktop`: planned Electron shell
- `backend`: active Python backend generated from the template and adapted to this product
- `nginx` / `docker-compose*.yml` / `Makefile`: template-aligned operational assets

The current product surface implements:

- three-panel writing workspace
- right-side AI chat panel with agent-oriented upgrade in progress
- selection-aware AI rewrite flow with status streaming, diff preview, and accept/reject
- mock document store with multiple Markdown drafts
- manual version snapshots, history diff, and restore
- Markdown export preview from the current editor state
- FastAPI rewrite backend at `/api/v1/ai/rewrite/*`

The next active product track upgrades the right sidebar from a single-turn rewrite panel into an agentic chat surface with:

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

Backend logs are written to `logs/` at the repository root by default. The folder is git-ignored and keeps rolling `app.log` and `error.log` files in JSON-lines format so issues can be inspected directly from the workspace and later shipped to centralized observability systems.

## Documentation

- Chinese README: [docs/README_CN.md](docs/README_CN.md)
- Docs hub: [docs/product-specs/index.md](docs/product-specs/index.md)
- Design docs: [docs/design-docs/index.md](docs/design-docs/index.md)
- Active execution plans: [docs/PLANS.md](docs/PLANS.md)
