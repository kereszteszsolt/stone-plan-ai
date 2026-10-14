# TFA-003: Structured AI plan preview

## Status

Implemented

## User story

As a user, I want a goal split into steps I can review.

## Goal

Generate a short plan without saving it yet.

## Dependencies

`TFA-002`.

## Acceptance criteria

- [x] `POST /api/tasks/:id/plan-preview` sends task details and available time to the configured local Ollama model.
- [x] A small service owns prompt construction, the Ollama HTTP request, timeout, and JSON response parsing; the configured Ollama endpoint is reachable from the containerized NestJS service without shipping a model in Compose.
- [x] Zod validates the returned task list, titles, count, and positive time estimates.
- [x] The backend assigns ordered steps to days and rejects plans that exceed the available budget.
- [x] Angular displays the unsaved plan and lets the user edit subtask titles and minute estimates.
- [x] The UI explains offline-model, invalid-output, and time-budget errors and allows the user to retry.
- [x] Fixed-response unit tests and one real local-Ollama smoke test through the Docker-run web/API path verify the preview flow; Linux host-network setup is documented if necessary.

## Verification evidence

See the [Release 0.1 verification record](../verification.md#tfa-003-evidence--2026-10-14). Both builds, 79 backend tests, 21 Angular tests, the existing CRUD/persistence smoke, and a real browser → Nginx → API → host-Ollama preview passed. `qwen3:0.6b` returned 3 steps totaling 90 minutes; editing/reload checks confirmed no subtask persistence or task timestamp change. A first real response was rejected for exceeding a daily limit; the request schema/prompt was tightened to the task's daily maximum and the final real flow passed. No Ollama installation, model download, database migration, plan save or completion endpoint was added.

## Out of scope

No saved plans, tool calling, LangChain, RAG, model selection UI, or cloud provider.
