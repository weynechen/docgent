# Writing IDE MVP

A Docs-as-Code AI writing workspace with a frontend-first product surface and a cloud-oriented backend direction aligned with `full-stack-ai-agent-template`.

Current repository structure:

- `frontend`: active React + Tiptap workspace
- `desktop`: planned Electron shell
- `backend`: planned Python backend aligned with the template's layering style
- `prototypes/local-agent`: transitional local Node rewrite prototype for development

The active prototype currently implements:

- three-panel writing workspace
- selection-aware AI rewrite flow with status streaming, diff preview, and accept/reject
- mock document store with multiple Markdown drafts
- manual version snapshots, history diff, and restore
- Markdown export preview from the current editor state

## Development

```bash
npm install
npm run dev
```

Create a local `.env` first:

```bash
cp .env.example .env
```

`npm run dev` runs `frontend` together with the transitional local prototype agent in `prototypes/local-agent`.

Required environment variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4o-mini`)
- `OPENAI_BASE_URL` (default: `https://api.openai.com/v1`)

## Build

```bash
npm run build
```

## Documentation

- Chinese README: [docs/README_CN.md](docs/README_CN.md)
- Docs hub: [docs/product-specs/index.md](docs/product-specs/index.md)
- Design docs: [docs/design-docs/index.md](docs/design-docs/index.md)
