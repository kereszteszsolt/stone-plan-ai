# Task Flow AI

> **Break goals into practical steps.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-D22128?style=flat-square&labelColor=2B3137&logo=apache&logoColor=white)](LICENSE)

**Status: Release 0.1 MVP implemented and locally verified.** TFA-001–004 cover the local stack, persistent task CRUD, an Ollama-generated editable preview, explicit plan acceptance, and durable completion tracking. The full Docker-launched flow passed, including page reload and Compose stop/start with the database volume retained.

Task Flow AI is a small, local-first, single-user task planner. It turns one goal into an editable AI-generated plan, assigns subtasks to a limited number of days, saves the accepted plan, and tracks progress.

## Release 0.1: MVP

The end-to-end flow is:

1. Create a task with a goal, description, number of days, and minutes per day.
2. Select **Generate plan** to request a structured plan from a local Ollama model.
3. Preview and edit the proposed subtasks before accepting them.
4. Select **Save plan**, review the confirmation, then **Confirm and save** to persist the edited steps to PostgreSQL.
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

Task requests, AI output and accepted plans use backend Zod validation. The backend recalculates the accepted plan's daily placement and derives progress from persisted completion flags.

This is a **plain monorepo** (one Git repository with `apps/web` and `apps/api`), not an Nx/Turborepo-managed workspace. Each app has its own normal tooling. Docker Compose coordinates their containers; it does not replace or require a monorepo framework.

## Local deployment

Prerequisites: Docker with Compose. From the repository root:

```sh
cp .env.example .env
# Choose your local PostgreSQL password in .env before starting.
docker compose up --build
```

Use a URL-safe password because Compose includes it in the database connection URL. Open **http://localhost:8080** to create a task, generate and edit a plan, confirm its save, and check off steps. Task edits, accepted plans and completion changes persist after a page reload. **http://localhost:8080/api/health** returns `{"status":"ok"}`.

The command starts:

- `web`: Angular built as static files and served by Nginx at `http://localhost:8080`; Nginx forwards `/api/*` to the `api` service.
- `api`: NestJS backend, accessible internally to the `web` container, with a database connection to `db:5432`.
- `db`: PostgreSQL with a dedicated named volume for persisted database files.

Compose waits for PostgreSQL readiness. Before listening, the API runs `prisma migrate deploy`; the website waits for the API health check. Only Nginx has a published port, bound to `127.0.0.1`. Change `WEB_PORT` in `.env` if needed.

The containers use Compose's default network and one named `postgres_data` volume. `docker compose down` removes the containers while keeping database data. `docker compose down --volumes` deletes that data.

**Ollama runs separately from the demo**, configured with `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and `OLLAMA_TIMEOUT_MS`. Compose does not install a model or start Ollama. Task CRUD starts even when Ollama is unavailable; only an explicit **Generate plan** request contacts the model. The browser calls NestJS through `/api`.

The [planned Release 0.2](docs/releases/release-0.2-ai-provider-observability/README.md) contains **TFA-005 (OpenRouter)** and **TFA-006 (basic LLM call diagnostics)**. Neither is implemented yet. Ollama remains the default, no cloud fallback occurs, and the browser never calls an AI provider directly.

## Ollama plan preview

Before generating, set `OLLAMA_MODEL` in the root `.env` to an **already installed local model**. The local smoke used `qwen3:0.6b`. The container's default `OLLAMA_BASE_URL` is `http://host.docker.internal:11434`; a native API uses its own `.env` and usually `http://localhost:11434`.

Select a task and choose **Generate plan**. The backend requests structured JSON, validates 3–8 steps with trimmed titles and positive integer minute estimates, then assigns days in order. Each step must fit in a day and all steps must fit the available days. An over-capacity response is rejected instead of shortened or rearranged.

Edit the titles and estimates directly in the preview. **The preview is unsaved:** it disappears on reload, task switching, task editing, or explicit discard. Generated day labels retain the original schedule while you edit estimates. **Generate again** replaces the preview only after a successful response; a failed attempt keeps your draft and shows a retryable error.

`OLLAMA_TIMEOUT_MS` defaults to 60000 and accepts integer values from 1000 to 120000. Nginx waits up to 130 seconds so backend timeout errors can reach the UI. Generation errors distinguish an unavailable/unconfigured model, timeout, invalid response and insufficient time budget. There is one Ollama request per explicit generation, with no automatic repair or cloud fallback; cloud model tags are rejected.

For a slow CPU-only model, increase `OLLAMA_TIMEOUT_MS` up to `120000` in the root `.env` and apply it with `docker compose up -d --wait`, then retry generation. A native API reads the setting from its own `.env` and needs restarting.

The API container already has `host.docker.internal:host-gateway` for Linux. Check host reachability with:

```sh
docker compose exec -T api node -e "fetch('http://host.docker.internal:11434/api/tags').then(r=>console.log(r.status)).catch(e=>{console.error(e.message);process.exit(1)})"
```

On native Linux, an Ollama server bound only to loopback may not accept container connections. Inspect `docker compose exec -T api getent hosts host.docker.internal`, then, if needed, configure the external Ollama service's `OLLAMA_HOST` to that **private host interface** at port 11434 and limit access to trusted local clients. Match the native API URL if changing that address. Ollama's [server configuration instructions](https://docs.ollama.com/faq) describe how to set the service environment. The local verification used an existing reachable server and did not change its configuration.

If the host model is not running, start your existing Ollama service, check the configured URL and installed model name, and retry **Generate plan**. The application shows an offline/timeout error without creating subtasks. Task CRUD, saved plans and completion tracking work without Ollama.

## Saving and completion

Select **Save plan** after reviewing your edits. The confirmation freezes the edited fields; **Keep editing** returns to the draft without writing anything. **Confirm and save** sends only step titles and estimates. The backend validates 3–8 steps, recalculates days using the task's current budget, and saves all steps in one transaction. If the estimates cannot fit in order, adjust them and retry; a failed save keeps your draft.

Each task can have only one saved plan. Once accepted, the steps and time budget are fixed; the task's title and description can still be edited. To use a different plan, create another task. Concurrent saves are rejected rather than replacing or duplicating steps.

The saved view groups steps by day. Check or uncheck a step to persist its completion; a failed request leaves the previous state visible and allows retry. Detail and list progress show the rounded percentage of completed steps, with 0% for an unsaved task. Reloading or stopping/starting Compose keeps accepted plans and progress as long as the PostgreSQL volume is retained.

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

For the running Docker demo, run `sh infra/smoke.sh` from the repository root. It checks the website and Nginx health proxy, task CRUD and validation, concurrent plan-save/budget protection, persisted completion, migration status, Prisma defaults and relational constraints, database restart persistence, and cascading deletion. It restarts only this project's database and removes its own temporary test tasks. If using another web port, set `TASK_FLOW_SMOKE_URL=http://localhost:YOUR_PORT`.

After that smoke finishes, the live browser check is available from `apps/web`:

```sh
CHROME_EXECUTABLE=/path/to/local/chrome npm run test:smoke
```

Use an installed Chrome or Chromium headless-shell executable. Playwright Core controls that local browser and does not install one. The test creates, edits, reloads and deletes its own task; checks failed-save recovery, confirmation and retry; and captures 1200/390/320-pixel forms in a temporary directory. Run it after the database smoke, since that smoke restarts PostgreSQL. On Windows, set `CHROME_EXECUTABLE` in your shell before running the npm command.

For a real configured Ollama preview, run `CHROME_EXECUTABLE=/path/to/local/chrome npm run test:preview-smoke` from `apps/web` after the database smoke. It makes one real generation, verifies editing without persistence and reload discard, checks four controlled UI error responses, and captures light/dark responsive previews. It removes its own task while preserving existing tasks.

For the complete MVP flow, run `CHROME_EXECUTABLE=/path/to/local/chrome npm run test:mvp-smoke` from `apps/web` after the database smoke. It uses the rendered Docker UI to create a task, make one real Ollama request, edit estimates/titles, confirm the plan, toggle completion and reload. It also checks controlled save/completion failures and responsive themes. **This check stops and starts this project's entire Compose stack**, retains its database volume, then verifies the same accepted steps and completion state. It deletes only its own task and writes screenshots to a temporary directory.

Verified commands and limits are recorded in the [verification record](docs/releases/release-0.1-mvp/verification.md).

## Documentation

- [Architecture and API](docs/architecture.md)
- [Release 0.1 stories](docs/releases/release-0.1-mvp/README.md)
- [Release 0.2 planned stories: TFA-005 OpenRouter and TFA-006 LLM diagnostics](docs/releases/release-0.2-ai-provider-observability/README.md)
- [Story and AI-assisted workflow](docs/story-workflow.md)
- [Release 0.1 verification (completed)](docs/releases/release-0.1-mvp/verification.md)
- [Release 0.2 verification (planned; not run)](docs/releases/release-0.2-ai-provider-observability/verification.md)
- [Possible later improvements (not committed)](docs/future.md)
- [Agent instructions](AGENTS.md)
- [Codex roles and skills](.codex/README.md)

## License and author

Apache-2.0. Copyright © 2026 **Keresztes Zsolt** — [kereszteszsolt.hu](https://kereszteszsolt.hu).

New hand-written source files use the two-line SPDX header defined in [AGENTS.md](AGENTS.md).
