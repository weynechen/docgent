# Writing IDE MVP

A React + Tiptap prototype for a Docs-as-Code AI writing editor. It implements:

- three-panel writing workspace
- local pi-style rewrite agent backed by `@mariozechner/pi-ai`
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

`npm run dev` loads `.env` automatically for the local agent process.

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
