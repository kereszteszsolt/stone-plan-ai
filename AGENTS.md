# Codex engineering guide

## Repository and status

Task Flow AI is a small NestJS/Angular app with PostgreSQL/Prisma and a separately running Ollama instance. Releases 0.1 (`TFA-001`–`TFA-004`) and 0.2 (`TFA-005`–`TFA-007`, including 30-day planning) are implemented and locally verified. Provider behavior was checked with mocks and isolated Docker checks; live OpenRouter generation was not run. **Release 0.3 (`TFA-008`) is planned only**: optional Langfuse tracing. Never claim live cloud verification, hosted telemetry or publication from documentation alone.

## Read only relevant context

1. Read this guide, `docs/story-workflow.md` and **one active, approved `TFA-*` story**. Check its release README for status/dependencies.
2. Inspect affected files and tests. Read `docs/architecture.md` only for API, persistence, deployment or provider-boundary changes.
3. Load `nestjs-angular` only for Angular, NestJS, Prisma or Docker work; load `llm-provider-integration` only for model/provider, schema or diagnostics work. Load both only when an approved change genuinely crosses both scopes.
4. Do not preload every skill, reread completed stories or scan unrelated repositories.

## Technical boundaries

- **Angular:** standalone components and Signals; `apps/web/src/app/tasks-api.service.ts` owns HTTP calls. Browser requests use same-origin `/api` via Nginx (Compose) or dev proxy.
- **NestJS:** thin controllers, narrow services and one Prisma data-access boundary. Validate HTTP inputs and model outputs server-side with Zod. Keep AI prompt/HTTP calls out of controllers.
- **PostgreSQL:** `Task` and `Subtask` via Prisma; explicit transactions and server-side scheduling protect saved state. Add schema changes only if a story requires them.
- **Containers:** `web` (Angular/Nginx), `api` (NestJS) and `db` run in Docker Compose; only PostgreSQL needs a persistent named volume. Ollama stays outside Compose.
- **LLM:** Ollama remains default. Ollama and explicit OpenRouter selection are implemented; never add implicit cloud fallback or leak API keys to Angular. TFA-006 adds safe local diagnostics; only an approved TFA-008 may add opt-in Langfuse metadata export. No task/prompt/response contents in telemetry.
- Preserve explicit plan preview and acceptance; do not add unused layers, new services or extra UI state tooling.

## Minimal agent and skill policy

- **Default:** the main Codex session implements and reviews one approved story directly.
- **Optional role:** `implementation_worker` is the **sole writer** only when the main session explicitly delegates one scoped story. Do not have the main session and worker edit in parallel.
- **Skills:** `nestjs-angular` for full-stack contracts and persistence; `llm-provider-integration` for Ollama/OpenRouter, structured outputs, safe diagnostics and the optional Langfuse adapter.
- Avoid parallel agents, duplicated research, repeated test runs and large context dumps. Use focused file reads and the smallest useful test set.

## Story execution and evidence

1. State the story, likely files and focused checks; request implementation approval before making story code changes.
2. Implement only accepted criteria, in order. Ask before broad schema/security/infrastructure redesigns.
3. Run focused unit or build tests; run Docker/real-model checks only when needed and approved. A cloud-provider smoke test may cost money.
4. Record exact results or **not run** in the active release `verification.md` without modifying Release 0.1 history.
5. Review the diff and propose a commit message. **Do not commit, push, rewrite history or begin another story without separate approval.**

## Source comments and SPDX

Use short comments for non-obvious reasons, not code narration. Put this two-line SPDX header in new handwritten TypeScript, JavaScript, CSS, SCSS, SQL and shell sources using appropriate comment syntax:

```text
SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
SPDX-License-Identifier: Apache-2.0
```

No SPDX headers in Markdown, TOML, YAML, JSON, `.env.example`, Dockerfiles, generated files or lock files. Preserve third-party notices.

## Scope boundary

Release 0.2 is complete, while 0.3 is planned until TFA-008 is implemented and verified. `docs/future.md` is an idea list, **not** a backlog. No new agent workflows, authentication, calendar integration or backend services without a separate request.
