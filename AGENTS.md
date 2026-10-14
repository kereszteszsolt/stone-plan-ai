# AGENTS.md

## Project

**Task Flow AI** (`task-flow-ai`) is a small single-user task planner. The only committed release is **0.1 MVP**: Task CRUD, AI-generated editable plan preview, explicit plan save, completion tracking, and local persistence. **TFA-005** is a separate, optional OpenRouter story for after MVP completion; it is not a new release.

This repository starts as a documentation baseline. **Do not claim that NestJS, Angular, PostgreSQL, Ollama, tests, or a UI work until their story is implemented and verified.**

## Read only what you need

1. Read this file and the active `TFA-*` story (for TFA-005, read only `docs/stories/TFA-005-openrouter-provider-integration.md`).
2. Read `docs/story-workflow.md` for scope and approvals.
3. Read `docs/architecture.md` only when changing API, data, AI, or cross-app boundaries.
4. Load `.agents/skills/mvp-delivery/SKILL.md` only for approved story implementation or verification; do not preload it for planning.

Do not scan other repositories, bulk-load every document, or repeat repository analysis after scope is clear.

## Architecture boundaries

- `apps/api`: one NestJS modular monolith; thin controllers, small services, Prisma persistence, and one Ollama adapter.
- `apps/web`: standalone Angular UI, Signals for local state, and one typed REST API boundary; in the Docker demo, ship the built UI via Nginx with relative `/api` requests.
- `infra`: one minimal Docker Compose project for Angular/Nginx (`web`), NestJS (`api`), and PostgreSQL (`db`), plus a small Nginx `/api` proxy config. Use the default Compose network and one named persistent database volume; Ollama stays outside Compose.
- `docs`: Release 0.1 scope, stories, and evidence.
- `Task` and `Subtask` are the only business entities; there is no `User`, `Project`, or generic workflow engine.
- Validate HTTP input and AI responses at the backend. Do not trust model-generated JSON.
- Use Ollama as a host-installed HTTP service reached through a configurable URL from the API container. Do not containerize or install Ollama as part of the demo; avoid exposing the model server on public interfaces. No AI framework, speculative multi-provider abstraction, tools, background jobs, or fallback to cloud APIs. Only approved post-MVP TFA-005 may add a small, explicitly selected OpenRouter adapter; Ollama remains the default and there is never automatic cloud fallback.
- Generate a plan only on explicit request. Persist it only on explicit acceptance.
- Do not add layers, utilities, libraries, or UI components without a concrete use in an active story.

## Token-efficient agent workflow

- **One writer at a time.** The main agent should normally implement directly; use `implementation_worker` only when delegated as the sole writer.
- Do not spawn architect or reviewer subagents by default. Review the diff and targeted checks in the main flow.
- Never run two agents on the same story or duplicate parallel research, test runs, or file edits.
- Work on one approved `TFA-*` story at a time; complete and verify TFA-001–004 before starting optional TFA-005. Prefer small changes and focused checks.
- Summarize the scope and checks briefly before implementation; ask for approval to start a new story.
- A complex or risky change needs an explicit small plan and approval before edits.
- Do not commit, push, reset, rewrite history, or start another story without separate user approval.
- Report actual test commands and results; for TFA-005, keep details in its story and update the separate optional status row in Release 0.1 verification. Do not invent CI, screenshots, releases, or verification evidence.

## Source comments and license headers

Use short comments only when code does not explain the reason. Keep the following exact two-line SPDX header at the start of **new hand-written** TypeScript, JavaScript, SCSS, CSS, SQL, and shell files, in the appropriate comment syntax:

```text
SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
SPDX-License-Identifier: Apache-2.0
```

For example, TypeScript files start with `// SPDX-FileCopyrightText: ...` and `// SPDX-License-Identifier: Apache-2.0`.

Do not add headers to Markdown, JSON, TOML, YAML, `.env.example`, Dockerfiles, generated Angular/Nest files, lock files, or binary assets. Existing third-party license notices must be preserved. The complete license lives in `LICENSE`.

## Status and later ideas

Release 0.1 has only TFA-001–004. Optional TFA-005 has its own standalone story and acceptance criteria but no release assignment; implement it only after the MVP and separate approval. `docs/future.md` contains other non-binding ideas, not a backlog. Do not build them or create releases without an explicit request.
