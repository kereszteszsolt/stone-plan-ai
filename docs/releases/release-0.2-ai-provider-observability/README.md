# Release 0.2 — AI provider and basic observability

## Status

In progress. TFA-005 is implemented and locally verified with mocked provider tests and the default-Ollama Docker stack. A live OpenRouter call was not run. TFA-006 remains planned; Release 0.2 is not complete. Release 0.1 remains completed and usable with external Ollama.

## Goal

Let the existing plan preview use OpenRouter when explicitly configured, then add small, privacy-aware model-call diagnostics. Keep the single-user application and its current Angular, NestJS, Prisma, and Docker Compose boundaries.

## Story order

| Order | Story | Scope | Status |
| ---: | --- | --- | --- |
| 1 | [TFA-005](stories/TFA-005-openrouter-provider-integration.md) | Optional OpenRouter adapter, Ollama remains the default | Implemented; live OpenRouter check not run |
| 2 | [TFA-006](stories/TFA-006-basic-llm-observability.md) | Structured provider/latency/error logs, no content or secrets | Planned |

## Constraints

- Both stories require their own implementation and commit approval; do not treat planning approval as implementation approval.
- `POST /api/tasks/:id/plan-preview`, the Angular UI, and existing task and plan data stay compatible.
- Provider selection is explicit and made server-side; there is **no** automatic fallback to a hosted model.
- Logs must not expose user task text, model output, credentials, or full prompts.
- Keep the existing Compose services (`web`, `api`, `db`) and external Ollama; OpenRouter is an HTTP service, not a container.
- TFA-006 uses simple NestJS structured logs, not Langfuse or a full tracing/monitoring stack.
- Preserve all Release 0.1 evidence and do not edit its acceptance criteria.

## Verification

The [Release 0.2 verification record](verification.md) contains TFA-005's actual mocked/local results; TFA-006 and the optional live OpenRouter check remain *Not run*. Update it with exact commands and results as each approved story is completed. Do not state that Release 0.2 shipped while either story is planned.

## Out of scope

No new entities, authentication, shared users, RAG, tool calling, calendar functions, new AI frameworks, model UI selector, auto-fallback, hosted observability service, or further release planning.
