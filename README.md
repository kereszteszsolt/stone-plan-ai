# StonePlan AI

> **Break goals into practical steps.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-D22128?style=flat-square&labelColor=2B3137&logo=apache&logoColor=white)](LICENSE)

**Status: Releases 0.1–0.3 implemented with local verification.** The MVP provides persistent task management, editable AI-generated plans, explicit approval, and progress tracking. Release 0.2 adds optional OpenRouter integration, basic LLM call diagnostics, and 1–30-day planning (TFA-005–007). Release 0.3 adds opt-in, metadata-only Langfuse tracing (TFA-008). See the [0.2](docs/releases/release-0.2-ai-provider-observability/verification.md) and [0.3 verification](docs/releases/release-0.3-langfuse-observability/verification.md) for evidence and limits; live OpenRouter generation and a hosted/cloud Langfuse dashboard trace are not claimed; self-hosted Langfuse was checked locally in Docker and the browser.

StonePlan AI is a small, self-hosted, single-user AI task planner. It breaks a goal into editable, time-boxed subtasks, distributes them across available days, and tracks progress. Ollama runs locally by default; OpenRouter is an explicitly selected, optional hosted provider.

## Release 0.1: MVP

The end-to-end flow is:

1. Create a task with a goal, description, number of days, and minutes per day.
2. Select **Generate plan** to request a structured plan from a local Ollama model.
3. Preview and edit the proposed subtasks before accepting them.
4. Select **Save plan**, review the confirmation, then **Confirm and save** to persist the edited steps to PostgreSQL.
5. Check off completed subtasks and see progress persist after reload.

Tasks can also be listed, edited, and deleted. The application has no user accounts and is intended for local use.

**Still out of scope:** authentication, multiple users, project hierarchy, RAG, embeddings, tool calling, MCP, multi-agent orchestration, automatic provider fallback, calendar sync, realtime messaging, and background jobs. OpenRouter can be configured, but it is never an automatic fallback.

## Release 0.2: AI providers, monitoring, and longer plans

- **Optional OpenRouter:** choose `AI_PROVIDER=ollama` (default) or `AI_PROVIDER=openrouter` through backend configuration. The browser does not receive provider credentials.
- **Structured output validation:** both providers use a compatible schema, strict Zod validation, and the same deterministic scheduling logic.
- **Basic LLM monitoring:** structured `ai_plan_call` events record outcomes, duration, request IDs, error categories, and available token counts without logging user content or credentials. This is not distributed tracing.
- **Up to 30 days:** task-aware plan size (3–60 steps depending on horizon), daily time limits, and deterministic scheduling; see [TFA-007](docs/releases/release-0.2-ai-provider-observability/stories/TFA-007-thirty-day-plans.md).

## Technology stack

| Area | Technology | Purpose |
| --- | --- | --- |
| Frontend | Angular, TypeScript, Signals | Single-page task and plan UI |
| Backend | NestJS, TypeScript | REST API and application logic |
| Database | PostgreSQL, Prisma | Durable tasks and subtasks |
| AI | Ollama (default), optional OpenRouter | Explicit backend provider selection |
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

Release 0.2 is implemented and locally verified: [TFA-005 and TFA-006](docs/releases/release-0.2-ai-provider-observability/README.md) add optional OpenRouter support and safe LLM-call diagnostics, with [TFA-007](docs/releases/release-0.2-ai-provider-observability/stories/TFA-007-thirty-day-plans.md) extending plans to 30 days. Ollama remains the default, there is no provider fallback, and the browser calls only the NestJS backend. See the [verification record](docs/releases/release-0.2-ai-provider-observability/verification.md) for tested scenarios and real-provider limitations.

## Ollama plan preview

Before generating, set `OLLAMA_MODEL` in the root `.env` to an **already installed local model**. The local smoke used `qwen3:0.6b`. The container's default `OLLAMA_BASE_URL` is `http://host.docker.internal:11434`; a native API uses its own `.env` and usually `http://localhost:11434`.

Tasks support **1–30 days** and **15–240 minutes per day**. Select a task and choose **Generate plan**. The backend requests structured JSON with a task-aware step count: at least `max(3, days)` and at most `max(8, 2 × days)` steps. Thus a 3-day task allows 3–8 steps, a 14-day task allows 14–28, and a 30-day task allows 30–60. The prompts include the time budget and ask for progressive work rather than filler. The backend validates step titles and positive integer minute estimates, then balances steps in order across the available days. A step stays on one day; no day exceeds its budget. An impossible ordered plan is rejected rather than shortened or rearranged. Both providers use the same constraints.

Edit the titles and estimates directly in the preview. **The preview is unsaved:** it disappears on reload, task switching, task editing, or explicit discard. Generated day labels retain the original schedule while you edit estimates. **Generate again** replaces the preview only after a successful response; a failed attempt keeps your draft and shows a retryable error.

`OLLAMA_TIMEOUT_MS` defaults to 60000 and accepts integer values from 1000 to 120000. Ollama output budget grows with the permitted step count from 1024 up to 7680 tokens for a 30-day plan. Nginx waits up to 130 seconds so backend timeout errors can reach the UI. Generation errors distinguish an unavailable/unconfigured model, timeout, invalid response and insufficient time budget. There is one Ollama request per explicit generation, with no automatic repair or cloud fallback; cloud model tags are rejected.

For a slow CPU-only model, increase `OLLAMA_TIMEOUT_MS` up to `120000` in the root `.env` and apply it with `docker compose up -d --wait`, then retry generation. A native API reads the setting from its own `.env` and needs restarting.

The API container already has `host.docker.internal:host-gateway` for Linux. Check host reachability with:

```sh
docker compose exec -T api node -e "fetch('http://host.docker.internal:11434/api/tags').then(r=>console.log(r.status)).catch(e=>{console.error(e.message);process.exit(1)})"
```

On native Linux, an Ollama server bound only to loopback may not accept container connections. Inspect `docker compose exec -T api getent hosts host.docker.internal`, then, if needed, configure the external Ollama service's `OLLAMA_HOST` to that **private host interface** at port 11434 and limit access to trusted local clients. Match the native API URL if changing that address. Ollama's [server configuration instructions](https://docs.ollama.com/faq) describe how to set the service environment. The local verification used an existing reachable server and did not change its configuration.

If the host model is not running, start your existing Ollama service, check the configured URL and installed model name, and retry **Generate plan**. The application shows an offline/timeout error without creating subtasks. Task CRUD, saved plans and completion tracking work without Ollama.

## Optional OpenRouter plan preview

Set `AI_PROVIDER=openrouter` **explicitly** to use a hosted model. The default is `ollama`; changing providers does not add a container or change the frontend or database.

Configure the following in the root `.env` for Docker Compose, or `apps/api/.env` for native development:

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=replace-with-your-private-api-key
OPENROUTER_MODEL=replace-with-a-compatible-model-id
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_TIMEOUT_MS=60000
OPENROUTER_MAX_TOKENS=4096
```

Choose a model that supports [JSON Schema structured outputs](https://openrouter.ai/docs/features/structured-outputs). The backend requests strict schema compliance (`response_format` with `json_schema` and `strict: true`), requires provider-supported parameters, and disables provider fallback. Redirects are rejected, and responses are limited in size. Invalid or incomplete responses are rejected without automatic repair, provider switching, or paid retries. Only use a trusted custom `OPENROUTER_BASE_URL`: the backend sends the authorization header and task data to that endpoint.

`OPENROUTER_TIMEOUT_MS` accepts 1000–120000 milliseconds; `OPENROUTER_MAX_TOKENS` accepts 256–8192 and defaults to 4096. A provider response truncated by the output budget returns `OPENROUTER_OUTPUT_TRUNCATED`; no partial plan is saved. Raising token limits can increase usage charges, and long (up to 30-day) plans may require a larger budget. Apply configuration changes with `docker compose up --build -d --wait` or by restarting the native API.

**Privacy and cost:** using OpenRouter sends the selected task's title, description and time budget to a hosted provider and may incur charges. Keep `OPENROUTER_API_KEY` in backend environment variables, never in the browser or Git. Only one explicit generation request is issued, and a failed call does not modify saved plans. A successful **live OpenRouter request is not claimed by the normal mocked test suite**; running one needs separate credentials and approval.

## AI call diagnostics

Inspect the NestJS API logs with:

```sh
docker compose logs api
```

Each selected provider attempt emits one structured `ai_plan_call` event. The generated `requestId` is also returned in an `X-Request-ID` response header. The event contains the selected `provider`, a sanitized `model` identifier, success/failure `outcome`, `durationMs`, a safe `errorCategory` on failures, and the numeric `usage` fields (`inputTokens`, `outputTokens`, `totalTokens`) when the provider actually returns them. Missing usage is not invented or calculated.

User tasks, prompts, raw responses, API keys, authorization headers and provider error bodies are **not logged**. These events provide basic local visibility and remain available independently of the optional Langfuse adapter below.

## Optional Langfuse tracing (Release 0.3)

Tracing is **disabled by default** (`LANGFUSE_ENABLED=false`). No Langfuse account, endpoint or keys are needed for health, task CRUD, Ollama or OpenRouter. The default Compose stack remains `web`, `api`, `db`. The optional [local deployment](#local-langfuse-with-the-project) starts Langfuse alongside this application in the same Compose project, using the same root `.env`.

To activate it, create a private project in an existing Langfuse account or external installation, obtain that project's API keys, and set these values in the root `.env` for Compose, or `apps/api/.env` for native development:

```dotenv
LANGFUSE_ENABLED=true
LANGFUSE_PUBLIC_KEY=pk-lf-your-project-public-key
LANGFUSE_SECRET_KEY=sk-lf-your-project-secret-key
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

Choose the **exact base URL and region of your existing project**; there is no implicit destination. Use HTTPS for remote endpoints. The example is the EU cloud endpoint; other regions or external installations require their own URL. Keys are backend-only and must stay out of Git, Angular and screenshots. Apply Compose changes with `docker compose up --build -d --wait`, or restart the native API. Missing/invalid settings disable tracing with a fixed `LANGFUSE_INVALID_CONFIGURATION` diagnostic while the application remains usable.

Generate one plan normally, then open **Tracing** in the same Langfuse project and select the `ai-plan-generation` observation. Export is batched (up to five seconds before an ordinary batch flush). Match `metadata.requestId` to the `X-Request-ID` response header or the existing `ai_plan_call` log. The observation contains only the generated correlation ID, selected provider, sanitized model name, duration, success/failure, a fixed error category, and reported numeric token usage (`input`, `output`, `total`). Missing usage has `usageStatus: unknown`; absent counts are not estimated. SDK trace/span IDs, timestamps, a fixed service name and release/environment labels accompany these fields. No task IDs, task titles/descriptions, prompts, model replies, HTTP headers or raw errors are attached.

Only the NestJS plan-generation path creates a manual SDK generation. There is no HTTP/database auto-tracing, Angular dashboard or additional model call. Existing provider selection, local logs, API responses, manual retries and explicit plan acceptance are unchanged. Recording/export failures do not fail a plan. Shutdown hooks flush buffered observations, and export requests have a two-second network timeout. SDK payload/debug logging is disabled even if SDK debug environment variables are set.

**Privacy, access and cost:** enabling this sends technical metadata to the configured external project. Keep the project private, restrict membership and API-key access, and leave public trace sharing disabled. Review your account's retention/deletion settings and any paid ingestion/storage limits before enabling it. Langfuse may infer model costs from its own catalog; this app does not export cost estimates or measure answer quality. Tracing does not enable OpenRouter or authorize an extra billable model request.

**Off switch:** set `LANGFUSE_ENABLED=false` and recreate/restart the API. The old process can flush observations already buffered during graceful shutdown; the new process creates no telemetry exporter. Remove the keys if unused. Disabling does not delete remote history: use the Langfuse project's deletion/retention controls for data already exported. Hosted Langfuse transmission/dashboard verification requires separate authorization and is **Not run** here; see [Release 0.3 verification](docs/releases/release-0.3-langfuse-observability/verification.md).

SDK references: [manual observations](https://langfuse.com/docs/observability/sdk/instrumentation), [isolated tracing and configuration](https://langfuse.com/docs/observability/sdk/advanced-features).

### Local Langfuse with the project

All application and local Langfuse settings are in the root `.env`. Start both together from the repository root:

```sh
sh infra/langfuse.sh up
```

Open **http://localhost:8080** for Task Flow AI and **http://localhost:3000** for Langfuse. Log in with `LANGFUSE_ADMIN_EMAIL` and `LANGFUSE_ADMIN_PASSWORD` from `.env`. The existing local setup is configured with its original administrator, project keys and data. A new deployment must fill the optional Langfuse settings listed in `.env.example` before using this command; use independent random secrets and a 64-character hexadecimal encryption key. Initialization provisions the administrator/project once; changing initialization values does not rotate stored credentials.

`infra/compose.langfuse.yaml` adds six local services to the application's `task-flow-ai` Compose project. The API sends metadata to `http://langfuse-web:3000` using `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` from the same `.env`; the overlay enables local tracing without changing the selected AI provider. There is no separate server folder, Compose project, client env file or external network prerequisite.

```sh
sh infra/langfuse.sh ps     # Combined project status
sh infra/langfuse.sh logs   # Recent API and Langfuse logs
sh infra/langfuse.sh down   # Stop/remove the combined stack; retain all volumes
sh infra/langfuse.sh up     # Start the same stack/data again
sh infra/langfuse.sh off    # Run the app without tracing; stop its local Langfuse services
```

`off` recreates the API with tracing disabled and empty keys/destination before stopping the local services. It retains `.env` and every data volume. The next `up` restores local tracing. Plain `docker compose up --build` uses only the original three application services; the default env template disables tracing.

The app database has its original volume. Langfuse has five separate project-owned volumes for PostgreSQL, ClickHouse data/logs, Redis and MinIO, reusing the existing data. Keep `.env` with those volumes, especially encryption key, salt and passwords; avoid `down --volumes` when retaining data. Storage and worker use an internal network. Web and the API share a project-local bridge; only the dashboard is published on `127.0.0.1:3000`. Langfuse Web/Worker 4.63.0 and storage images retain their pinned versions. Deployment telemetry and the in-app agent are disabled; update checks/browser assets can still make external requests. Backup automation and HA are not configured.

To verify ingestion without a live model or app database writes:

```sh
docker compose --env-file .env -f compose.yaml -f infra/compose.langfuse.yaml \
  exec -T api node < apps/api/test/langfuse-smoke.cjs
```

This uses the actual SDK transport, a deterministic model fixture and authenticated metadata-only readback. Evidence and external check limits are in [Release 0.3 verification](docs/releases/release-0.3-langfuse-observability/verification.md).

## Saving and completion

Select **Save plan** after reviewing your edits. The confirmation freezes the edited fields; **Keep editing** returns to the draft without writing anything. **Confirm and save** sends only step titles and estimates. Inside one transaction, the backend checks the task-specific step count against the currently stored day limit, recalculates the daily schedule under the saved time budget, and saves all steps. If the count or estimates cannot fit, adjust the draft or the unsaved task budget and retry; a failed save keeps your draft.

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

For 30-day planning, run `CHROME_EXECUTABLE=/path/to/local/chrome node test/horizon-smoke.cjs` from `apps/web`. It covers the 30-day form, a 60-step fixture preview, real database acceptance and progress tracking, and responsive layouts, without a real LLM call. Screenshots are placed in a temporary directory.

For a real configured Ollama preview, run `CHROME_EXECUTABLE=/path/to/local/chrome npm run test:preview-smoke` from `apps/web` after the database smoke. It makes one real generation, verifies editing without persistence and reload discard, checks four controlled UI error responses, and captures light/dark responsive previews. It removes its own task while preserving existing tasks.

For the complete MVP flow, run `CHROME_EXECUTABLE=/path/to/local/chrome npm run test:mvp-smoke` from `apps/web` after the database smoke. It uses the rendered Docker UI to create a task, make one real Ollama request, edit estimates/titles, confirm the plan, toggle completion and reload. It also checks controlled save/completion failures and responsive themes. **This check stops and starts this project's entire Compose stack**, retains its database volume, then verifies the same accepted steps and completion state. It deletes only its own task and writes screenshots to a temporary directory.

Verified commands and limits are recorded in [Release 0.1 verification](docs/releases/release-0.1-mvp/verification.md), [Release 0.2 verification](docs/releases/release-0.2-ai-provider-observability/verification.md), and [Release 0.3 verification](docs/releases/release-0.3-langfuse-observability/verification.md). These distinguish mocked tests and local Docker checks from any unrun live hosted-model or telemetry checks.

[Release 0.3 — optional Langfuse tracing](docs/releases/release-0.3-langfuse-observability/README.md) adds metadata-only, opt-in LLM observability to the existing provider logs. It is not required for normal local use.

## Documentation

- [Architecture and API](docs/architecture.md)
- [Release 0.1 stories](docs/releases/release-0.1-mvp/README.md)
- [Release 0.2 stories: TFA-005 OpenRouter, TFA-006 LLM diagnostics, TFA-007 longer plans](docs/releases/release-0.2-ai-provider-observability/README.md)
- [Release 0.3 optional Langfuse tracing](docs/releases/release-0.3-langfuse-observability/README.md)
- [Story and AI-assisted workflow](docs/story-workflow.md)
- [Release 0.1 verification (completed)](docs/releases/release-0.1-mvp/verification.md)
- [Release 0.2 verification](docs/releases/release-0.2-ai-provider-observability/verification.md)
- [Release 0.3 verification](docs/releases/release-0.3-langfuse-observability/verification.md)
- [Possible later improvements (not committed)](docs/future.md)
- [Agent instructions](AGENTS.md)
- [Codex roles and skills](.codex/README.md)

## License and author

Apache-2.0. Copyright © 2026 **Keresztes Zsolt** — [kereszteszsolt.hu](https://kereszteszsolt.hu).

New hand-written source files use the two-line SPDX header defined in [AGENTS.md](AGENTS.md).

## ☕ Ways to support

**Explore ways to support the maintainer and their projects.**

[https://kereszteszsolt.hu/ways-to-support/](https://kereszteszsolt.hu/ways-to-support/)

<p align="center">
  <a href="https://buymeacoffee.com/kereszteszsolt"><img src="docs/assets/orange-button.png" alt="Buy Me a Coffee" width="360"></a><br>
  <strong>Every coffee counts! ☕❤️</strong>
</p>

---
