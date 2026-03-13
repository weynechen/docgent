# Writing IDE MVP

A Docs-as-Code AI writing workspace with a React/Tiptap frontend and a FastAPI backend fully migrated onto the `fastapi-fullstack` / `full-stack-ai-agent-template` structure.

Current repository structure:

- `frontend`: active React + Tiptap workspace
- `desktop`: planned Electron shell
- `backend`: active Python backend generated from the template and adapted to this product
- `nginx` / `docker-compose*.yml` / `Makefile`: template-aligned operational assets

The current product surface implements:

- three-panel writing workspace
- selection-aware AI rewrite flow with status streaming, diff preview, and accept/reject
- mock document store with multiple Markdown drafts
- manual version snapshots, history diff, and restore
- Markdown export preview from the current editor state
- FastAPI rewrite backend at `/api/v1/ai/rewrite/*`

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

## Documentation

- Chinese README: [docs/README_CN.md](docs/README_CN.md)
- Docs hub: [docs/product-specs/index.md](docs/product-specs/index.md)
- Design docs: [docs/design-docs/index.md](docs/design-docs/index.md)
