# Example Layout

## Core files

- `AGENTS.md`
- `ARCHITECTURE.md`
- `docs/DESIGN.md`
- `docs/FRONTEND.md`
- `docs/PLANS.md`
- `docs/PRODUCT_SENSE.md`
- `docs/QUALITY_SCORE.md`
- `docs/RELIABILITY.md`
- `docs/SECURITY.md`

## Structured docs folders

- `docs/design-docs/`
  - indexed design decisions, principles, validation state
- `docs/product-specs/`
  - scoped product requirements and acceptance
- `docs/exec-plans/active/`
  - current multi-step plans
- `docs/exec-plans/completed/`
  - finished plans retained for future context
- `docs/exec-plans/tech-debt-tracker.md`
  - centralized debt tracking
- `docs/generated/`
  - generated references such as DB schema
- `docs/references/`
  - secondary material for agents and tools

## Maintenance guidance

- Add indexes before adding many sibling docs.
- Keep each doc class focused on one concern.
- Update source-of-truth docs in the same change as the code whenever practical.
- Prefer moving stale documents to historical/reference status over silently leaving them ambiguous.
