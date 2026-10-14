# TFA-001: Repository, API, and data foundation

## Status

Implemented

## User story

As a developer, I want a small local stack so I can build the demo.

## Goal

Set up NestJS, Angular, and a one-command Docker Compose demo with persistent database storage, without a monorepo framework.

## Dependencies

None.

## Acceptance criteria

- [x] The repository has plain `apps/api`, `apps/web`, and `infra` workspaces without Nx or Turborepo.
- [x] A strict TypeScript NestJS API exposes `GET /api/health` and runs with its native npm scripts.
- [x] A standalone Angular application starts with its native Angular CLI scripts.
- [x] Prisma defines only `Task` and `Subtask`, with a checked-in initial migration.
- [x] One Compose project defines `web` (Angular static build served by Nginx), `api` (NestJS), and `db` (PostgreSQL), using ordinary small Dockerfiles and an example non-secret environment file.
- [x] `docker compose up --build` starts the website at `http://localhost:8080` and `/api/health` is reachable through Nginx; container-to-container calls use the Compose service names, without browser access to internal hostnames.
- [x] Nginx forwards `/api/*` to NestJS with the prefix preserved; no exposed API/database ports are required for the containerized demo.
- [x] PostgreSQL keeps its data in one dedicated named volume; a restart preserves it. Database readiness and Prisma migrations are handled deterministically.
- [x] A documented Ollama URL is configurable from the `api` container without adding Ollama as a Compose service; failure to reach Ollama must not prevent the non-AI website from starting.
- [x] Apache-2.0 and the required SPDX source headers are present in hand-written project code.
- [x] Backend and frontend builds, focused API tests, a migration check and a Compose `/api/health` smoke test succeed.

## Verification evidence

See the [Release 0.1 verification record](../verification.md#tfa-001-evidence--2026-10-14) for commands and results. Native API/web builds and startup, 3 HTTP tests, live native and Docker browser rendering, Prisma schema/migration checks, and the Compose smoke passed. The smoke verifies relational constraints, restart persistence, and cascading deletion; persistence was also checked across database container recreation. No Ollama call or task UI was added.

## Out of scope

No task UI, CRUD endpoints, Ollama calls, or AI generation in this story.
