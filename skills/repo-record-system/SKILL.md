---
name: repo-record-system
description: "Use when turning a code repository into a structured record system for agents and engineers, or when maintaining that system over time. Apply it for AGENTS.md redesign, docs/ knowledge-base structure, architecture maps, indexed design/product docs, execution-plan systems, tech-debt tracking, and progressive-disclosure documentation workflows inspired by OpenAI's harness engineering article."
---

# Repo Record System

Design the repository so agents can navigate it with a small map, then progressively load only the deeper documents they need. Keep the code repository itself as the long-lived record system.

## Apply the core pattern

1. Keep `AGENTS.md` short and map-like.
2. Put durable knowledge in a structured `docs/` tree.
3. Index design docs and product specs so agents can navigate instead of scanning everything.
4. Treat plans as first-class artifacts under version control.
5. Track active plans, completed plans, and tech debt separately.
6. Keep architecture, quality, reliability, and security docs as explicit top-level references.

## Build the docs tree with progressive disclosure

Prefer a layout like:

```text
AGENTS.md
ARCHITECTURE.md
docs/
  design-docs/
  product-specs/
  exec-plans/
    active/
    completed/
    tech-debt-tracker.md
  generated/
  references/
  DESIGN.md
  FRONTEND.md
  PLANS.md
  PRODUCT_SENSE.md
  QUALITY_SCORE.md
  RELIABILITY.md
  SECURITY.md
```

Use the top-level files as entry points, not as giant handbooks. Put deep detail in indexed subdirectories.

## Maintain the system

1. Update the relevant source document after meaningful code or product changes.
2. Move finished execution plans from `active/` to `completed/`.
3. Keep tech debt in a single tracker instead of scattering TODOs across chats.
4. Mark historical inputs as references if they are no longer the primary truth source.
5. Prefer adding indexes and cross-links over expanding a single large document.

## Apply the article's operating principles

- Give the agent a map, not a 1000-page manual.
- Optimize for agent readability, not just human prose.
- Let documentation support navigation and verification.
- Use the repo to hold plans, decisions, and quality gaps so work survives across sessions.
- Keep the system mechanically checkable where possible.

## Read more only when needed

- Read `references/principles.md` for the distilled principles adapted from the OpenAI article.
- Read `references/example-layout.md` for a concrete repository layout and maintenance guidance.
