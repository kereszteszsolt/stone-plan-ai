# TFA-003: Structured AI plan preview

## Status

Planned

## User story

As a user, I want a goal split into steps I can review.

## Goal

Generate a short plan without saving it yet.

## Dependencies

`TFA-002`.

## Acceptance criteria

- [ ] `POST /api/tasks/:id/plan-preview` sends task details and available time to the configured local Ollama model.
- [ ] A small service owns prompt construction, the Ollama HTTP request, timeout, and JSON response parsing; the configured Ollama endpoint is reachable from the containerized NestJS service without shipping a model in Compose.
- [ ] Zod validates the returned task list, titles, count, and positive time estimates.
- [ ] The backend assigns ordered steps to days and rejects plans that exceed the available budget.
- [ ] Angular displays the unsaved plan and lets the user edit subtask titles and minute estimates.
- [ ] The UI explains offline-model, invalid-output, and time-budget errors and allows the user to retry.
- [ ] Fixed-response unit tests and one real local-Ollama smoke test through the Docker-run web/API path verify the preview flow; Linux host-network setup is documented if necessary.

## Out of scope

No saved plans, tool calling, LangChain, RAG, model selection UI, or cloud provider.
