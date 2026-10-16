# Release 0.2 — AI provider and basic observability

## Status

Implemented and locally verified. TFA-005 and TFA-006 passed their focused mocked checks and isolated default-Ollama Docker checks. A live OpenRouter call was not run; local completion does not claim hosted-provider verification or publication. TFA-006 commit was separately approved on 2026-10-16. Release 0.1 evidence is unchanged.

## Goal

Let the existing plan preview use OpenRouter when explicitly configured, then add small, privacy-aware model-call diagnostics. Keep the single-user application and its current Angular, NestJS, Prisma, and Docker Compose boundaries.

## Story order

| Order | Story | Scope | Status |
| ---: | --- | --- | --- |
| 1 | [TFA-005](stories/TFA-005-openrouter-provider-integration.md) | Optional OpenRouter adapter, Ollama remains the default | Implemented; live OpenRouter check not run |
| 2 | [TFA-006](stories/TFA-006-basic-llm-observability.md) | Structured provider/latency/error logs, no content or secrets | Implemented; commit approved |

## Constraints

- Both stories require their own implementation and commit approval; do not treat planning approval as implementation approval.
- `POST /api/tasks/:id/plan-preview`, the Angular UI, and existing task and plan data stay compatible.
- Provider selection is explicit and made server-side; there is **no** automatic fallback to a hosted model.
- Logs must not expose user task text, model output, credentials, or full prompts.
- Keep the existing Compose services (`web`, `api`, `db`) and external Ollama; OpenRouter is an HTTP service, not a container.
- TFA-006 uses simple NestJS structured logs, not Langfuse or a full tracing/monitoring stack.
- Preserve all Release 0.1 evidence and do not edit its acceptance criteria.

## Verification

The [Release 0.2 verification record](verification.md) contains separate actual commands and results for both stories, including an observed safe Docker diagnostic event. The optional live OpenRouter check remains *Not run*. Keep future results and publication status tied to actual evidence and separate approvals.

## Out of scope

No new entities, authentication, shared users, RAG, tool calling, calendar functions, new AI frameworks, model UI selector, auto-fallback, hosted observability service, or further release planning.
