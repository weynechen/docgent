# Principles

This skill follows the repository-as-record-system pattern described in OpenAI's harness engineering article.

## Distilled ideas

1. `AGENTS.md` should be a map, not an encyclopedia.
2. Structured docs beat one giant instruction file.
3. Progressive disclosure preserves context window for the actual task.
4. Plans should live in the repository, not only in chat history.
5. Active work, completed work, and technical debt should be separated.
6. Quality, reliability, and security deserve explicit documents.
7. Historical inputs can remain in the repo, but they should be labeled as references rather than current truth.

## What not to do

- Do not grow `AGENTS.md` into the primary knowledge base.
- Do not scatter planning artifacts across random Markdown files.
- Do not rely on chat memory for long-running implementation context.
- Do not duplicate the same truth across many files without a clear owner.
