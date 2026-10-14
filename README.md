# Task Flow AI

> **Break goals into practical steps.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-D22128?style=flat-square&labelColor=2B3137&logo=apache&logoColor=white)](LICENSE)

**Status: planning baseline.** This repository currently contains the documentation and AI-assisted development instructions for Release 0.1. The NestJS API, Angular frontend, database integration, and AI workflow are **not yet implemented**.

Task Flow AI is a small, local-first, single-user task planner. It will turn one goal into an editable AI-generated plan, assign subtasks to a limited number of days, save the accepted plan, and track progress.

## Release 0.1: MVP

The planned end-to-end flow is:

1. Create a task with a goal, description, number of days, and minutes per day.
2. Select **Generate plan** to request a structured plan from a local Ollama model.
3. Preview and edit the proposed subtasks before accepting them.
4. Save the plan to PostgreSQL.
5. Check off completed subtasks and see progress persist after reload.

Tasks can also be listed, edited, and deleted. The application has no user accounts and is intended for local use.

**Not in the MVP:** authentication, multiple users, project hierarchy, RAG, embeddings, tool calling, MCP, multi-agent orchestration, cloud-provider fallback, calendar sync, realtime messaging, and background jobs.

## Planned technology stack

| Area | Technology | Purpose |
| --- | --- | --- |
| Frontend | Angular, TypeScript, Signals | Single-page task and plan UI |
| Backend | NestJS, TypeScript | REST API and application logic |
| Database | PostgreSQL, Prisma | Durable tasks and subtasks |
| AI | Ollama | Locally hosted plan generation |
| AI output | JSON schema + Zod | Validate structured plan proposals |
| Infrastructure | Docker Compose, Nginx | Containerized Angular, NestJS, and PostgreSQL; one localhost entry point |
| Tests | Jest + Angular unit tests | Focused service and UI checks |

This is a **plain monorepo** (one Git repository with `apps/web` and `apps/api`), not an Nx/Turborepo-managed workspace. Each app has its own normal tooling. Docker Compose coordinates their containers; it does not replace or require a monorepo framework.

## Planned local deployment

For the **Docker-run demo**, one `docker compose up --build` command will start:

- `web`: Angular built as static files and served by Nginx at `http://localhost:8080`; Nginx forwards `/api/*` to the `api` service.
- `api`: NestJS backend, accessible internally to the `web` container, with a database connection to `db:5432`.
- `db`: PostgreSQL with a dedicated named volume for persisted database files.

These containers share a **Compose network**, *not* a shared data volume. The API and web images do not need persistent data volumes. **Ollama remains a separate host-installed HTTP service** (not downloaded or run by Compose); the container targets the host via `host.docker.internal:11434` where supported. Linux may need the documented `host-gateway` mapping and an Ollama listen-address adjustment, limited to trusted local access. Development with native Angular/NestJS commands remains optional.

A hosted OpenRouter alternative has its own **optional post-MVP story, TFA-005**, but **is not part of Release 0.1 and is not implemented yet**. Ollama remains the default; the browser never calls an AI provider directly.

Implementation and verified launch commands will be documented **after the owning stories are implemented**. This repository remains a planning baseline, not a runnable app.

## Documentation

- [Architecture and API](docs/architecture.md)
- [Release 0.1 stories](docs/releases/release-0.1-mvp/README.md)
- [Optional post-MVP story: TFA-005 OpenRouter provider](docs/stories/TFA-005-openrouter-provider-integration.md)
- [Story and AI-assisted workflow](docs/story-workflow.md)
- [Verification status](docs/releases/release-0.1-mvp/verification.md)
- [Possible later improvements (not committed)](docs/future.md)
- [Agent instructions](AGENTS.md)

## License and author

Apache-2.0. Copyright © 2026 **Keresztes Zsolt** — [kereszteszsolt.hu](https://kereszteszsolt.hu).

New hand-written source files use the two-line SPDX header defined in [AGENTS.md](AGENTS.md).
