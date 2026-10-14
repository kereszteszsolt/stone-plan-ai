# TFA-001: Repository, API, and data foundation

## Status

Planned

## User story

As a developer, I want a small local stack so I can build the demo.

## Goal

Set up NestJS, Angular, and a one-command Docker Compose demo with persistent database storage, without a monorepo framework.

## Dependencies

None.

## Acceptance criteria

- [ ] The repository has plain `apps/api`, `apps/web`, and `infra` workspaces without Nx or Turborepo.
- [ ] A strict TypeScript NestJS API exposes `GET /api/health` and runs with its native npm scripts.
- [ ] A standalone Angular application starts with its native Angular CLI scripts.
- [ ] Prisma defines only `Task` and `Subtask`, with a checked-in initial migration.
- [ ] One Compose project defines `web` (Angular static build served by Nginx), `api` (NestJS), and `db` (PostgreSQL), using ordinary small Dockerfiles and an example non-secret environment file.
- [ ] `docker compose up --build` starts the website at `http://localhost:8080` and `/api/health` is reachable through Nginx; container-to-container calls use the Compose service names, without browser access to internal hostnames.
- [ ] Nginx forwards `/api/*` to NestJS with the prefix preserved; no exposed API/database ports are required for the containerized demo.
- [ ] PostgreSQL keeps its data in one dedicated named volume; a restart preserves it. Database readiness and Prisma migrations are handled deterministically.
- [ ] A documented Ollama URL is configurable from the `api` container without adding Ollama as a Compose service; failure to reach Ollama must not prevent the non-AI website from starting.
- [ ] Apache-2.0 and the required SPDX source headers are present in hand-written project code.
- [ ] Backend and frontend builds, focused API tests, a migration check and a Compose `/api/health` smoke test succeed.

## Out of scope

No task UI, CRUD endpoints, Ollama calls, or AI generation in this story.
