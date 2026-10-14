# Task Flow AI

> **Break goals into practical steps.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-D22128?style=flat-square&labelColor=2B3137&logo=apache&logoColor=white)](LICENSE)

**Status: Release 0.1 in progress.** TFA-001–002 are implemented and verified: a local Docker Compose stack, Prisma persistence, task CRUD API, and a responsive Angular task list, form, and detail view. Plan generation, plan saving, and completion tracking are still planned in TFA-003–004.

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

## Technology stack

| Area | Technology | Purpose |
| --- | --- | --- |
| Frontend | Angular, TypeScript, Signals | Single-page task and plan UI |
| Backend | NestJS, TypeScript | REST API and application logic |
| Database | PostgreSQL, Prisma | Durable tasks and subtasks |
| AI | Ollama | Locally hosted plan generation |
| AI output | JSON schema + Zod | Validate structured plan proposals |
| Infrastructure | Docker Compose, Nginx | Containerized Angular, NestJS, and PostgreSQL; one localhost entry point |
| Tests | Jest + Angular/Vitest | Focused API and UI checks |

The AI rows describe later MVP stories. Task requests already use backend Zod validation. TFA-001–002 verify the local stack and persistent task CRUD.

This is a **plain monorepo** (one Git repository with `apps/web` and `apps/api`), not an Nx/Turborepo-managed workspace. Each app has its own normal tooling. Docker Compose coordinates their containers; it does not replace or require a monorepo framework.

## Local deployment

Prerequisites: Docker with Compose. From the repository root:

```sh
cp .env.example .env
# Choose your local PostgreSQL password in .env before starting.
docker compose up --build
```

Use a URL-safe password because Compose includes it in the database connection URL. Open **http://localhost:8080** to create a task, select it, edit its details, or confirm its deletion. Changes persist after a page reload. **http://localhost:8080/api/health** returns `{"status":"ok"}`.

The command starts:

- `web`: Angular built as static files and served by Nginx at `http://localhost:8080`; Nginx forwards `/api/*` to the `api` service.
- `api`: NestJS backend, accessible internally to the `web` container, with a database connection to `db:5432`.
- `db`: PostgreSQL with a dedicated named volume for persisted database files.

Compose waits for PostgreSQL readiness. Before listening, the API runs `prisma migrate deploy`; the website waits for the API health check. Only Nginx has a published port, bound to `127.0.0.1`. Change `WEB_PORT` in `.env` if needed.

The containers use Compose's default network and one named `postgres_data` volume. `docker compose down` removes the containers while keeping database data. `docker compose down --volumes` deletes that data.

**Ollama remains a separate host-installed HTTP service**, configured with `OLLAMA_BASE_URL` and `OLLAMA_MODEL`. The API container has a `host.docker.internal:host-gateway` mapping for Linux. TFA-001–002 make no Ollama calls, so an absent model server does not prevent startup. When TFA-003 implements generation, the host URL must be reachable from the container; any host listen-address adjustment should remain limited to trusted local access.

A hosted OpenRouter alternative has its own **optional post-MVP story, TFA-005**, but **is not part of Release 0.1 and is not implemented yet**. Ollama remains the default; the browser never calls an AI provider directly.

## Native development

Use Node.js **24 LTS, at least 24.15.0**, and npm. Each application has its own `package.json` and lock file; no root workspace tooling is required.

To expose only the demo database to native development processes:

```sh
docker compose -f compose.yaml -f infra/compose.dev.yaml up -d --wait db
```

This optional override publishes PostgreSQL to `127.0.0.1:5432`. The regular demo does not publish a database port.

In `apps/api`, copy `.env.example` to `.env` and match its database credentials to the root `.env`, then run:

```sh
npm ci
npm run prisma:migrate
npm run start:dev
```

The native API is at **http://localhost:3000/api/health**. In a second terminal, from `apps/web`:

```sh
npm ci
npm start
```

Open **http://localhost:4200**. Angular's development proxy forwards relative `/api/*` requests to the native API. The web app does not contain database or provider credentials.

## Checks

From `apps/api`: `npm run prisma:validate`, `npm run build`, and `npm test`. From `apps/web`: `npm run build` and `npm test`.

For the running Docker demo, run `sh infra/smoke.sh` from the repository root. It checks the website and Nginx health proxy, task CRUD and validation, migration status, Prisma defaults and relational constraints, database restart persistence, and cascading deletion. It restarts only this project's database and removes its own temporary test tasks. If using another web port, set `TASK_FLOW_SMOKE_URL=http://localhost:YOUR_PORT`.

After that smoke finishes, the live browser check is available from `apps/web`:

```sh
CHROME_EXECUTABLE=/path/to/local/chrome npm run test:smoke
```

Use an installed Chrome or Chromium headless-shell executable. Playwright Core controls that local browser and does not install one. The test creates, edits, reloads and deletes its own task; checks failed-save recovery, confirmation and retry; and captures 1200/390/320-pixel forms in a temporary directory. Run it after the database smoke, since that smoke restarts PostgreSQL. On Windows, set `CHROME_EXECUTABLE` in your shell before running the npm command.

Verified commands and limits are recorded in the [verification record](docs/releases/release-0.1-mvp/verification.md).

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
