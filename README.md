# Writing IDE MVP

A React + Tiptap prototype for a Docs-as-Code AI writing editor. It implements:

- three-panel writing workspace
- mock document store with multiple Markdown drafts
- selection-aware AI rewrite flow with diff preview and accept/reject/retry
- manual version snapshots, history diff, and restore
- Markdown export preview from the current editor state

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Documentation

- Chinese README: [docs/README_CN.md](docs/README_CN.md)
- Docs hub: [docs/product-specs/index.md](docs/product-specs/index.md)
- Design docs: [docs/design-docs/index.md](docs/design-docs/index.md)
