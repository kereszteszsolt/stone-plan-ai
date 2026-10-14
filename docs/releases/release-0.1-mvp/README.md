# Release 0.1 — Minimal task planning demo

## Status

In progress. TFA-001–003's local stack, persistent task CRUD, and editable unsaved Ollama preview are implemented and verified. Plan save and completion still require TFA-004.

## Outcome

One working local demo: create a task, generate and edit an AI plan, save the accepted subtasks, and mark them complete across reloads.

## Boundaries

- Single-user, local-first, no accounts.
- `Task` and `Subtask` only; no project hierarchy or team workflows.
- One Ollama integration with structured JSON and backend validation.
- Docker Compose builds/runs `web` (Angular + Nginx), `api` (NestJS) and `db` (PostgreSQL), with persisted database data. Ollama remains host-installed and externally configured.
- No tool calling, agents, RAG, MCP, calendar sync, background jobs, or cloud AI.

## Story order

| Story | Scope | Status |
| --- | --- | --- |
| [TFA-001](stories/TFA-001-repository-api-and-data-foundation.md) | Repository, NestJS, PostgreSQL, Prisma | Implemented |
| [TFA-002](stories/TFA-002-task-crud-and-angular-screen.md) | Task CRUD and Angular screen | Implemented |
| [TFA-003](stories/TFA-003-structured-ai-plan-preview.md) | Ollama and editable plan preview | Implemented |
| [TFA-004](stories/TFA-004-save-plan-and-track-progress.md) | Save plan, completion, and MVP verification | Planned |

[Verification record](verification.md) contains actual evidence only.
