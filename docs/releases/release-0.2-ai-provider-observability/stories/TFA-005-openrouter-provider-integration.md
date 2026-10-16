# TFA-005: Optional OpenRouter provider integration

## Status

Implemented — Release 0.2; locally verified on 2026-10-16 with mocked provider tests and an isolated default-Ollama Docker stack. Optional live OpenRouter check not run. Current release completion is tracked in the [release map](../README.md).

## User story

As a user, I want to generate the same task plan through OpenRouter when I prefer a hosted model over local Ollama.

## Goal

Add one backend-only OpenRouter option to the existing plan preview flow, while keeping Ollama as the default and preserving the small demo architecture.

## Dependencies

`TFA-004` implemented and verified. Start this planned Release 0.2 story only with explicit user approval; do not change Release 0.1 acceptance criteria.

## Acceptance criteria

- [x] `AI_PROVIDER=ollama|openrouter` selects the plan-generation provider from the NestJS environment; omitted value defaults to `ollama`. Invalid values fail clearly, without silently switching providers.
- [x] `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and optionally `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`) are documented in `.env.example` and README. Required values are checked when OpenRouter is selected, without requiring them for Ollama mode.
- [x] NestJS sends a server-side authenticated request to OpenRouter `POST /chat/completions` using a configured model that supports `response_format: { type: "json_schema", ... }`. Request strict JSON Schema output and require compatible provider parameters rather than accepting silently ignored schema requirements.
- [x] Both providers produce the **same existing** Zod-validated subtask proposal, with the same prompt constraints, deterministic day assignment, time-budget rules, and unsaved preview behavior.
- [x] The existing `POST /api/tasks/:id/plan-preview` endpoint and Angular UI work unchanged for both providers; no provider selector UI, schema migration, additional persistence, or new Compose service is introduced.
- [x] Handle missing credentials, unsupported model/structured-output responses, 401/403, rate limits, provider outages, timeouts, and invalid model JSON with helpful, non-sensitive API/UI errors; never log, echo, or ship the API key to the browser.
- [x] Focused mocked API tests cover provider selection, a valid OpenRouter response, invalid output, representative HTTP failures, and no-regression Ollama behavior; default automated tests do **not** make billable external API calls.
- [x] `docker compose up --build` still starts `web`, `api`, and `db` with Ollama as the default; README documents how to run OpenRouter mode using backend environment variables, including possible usage charges. If the user provides credentials and approves a live request, record one real OpenRouter smoke test; otherwise clearly mark that smoke test as not run.
- [x] Record actual checks in Release 0.2 verification and do not mark this integration delivered while it remains documentation-only.

## Out of scope

No OpenAI/other direct-provider SDKs, LangChain, agent workflows, tool calling, automatic cloud fallback, multi-provider routing, model selection UI, user accounts, pricing dashboard, Dockerized Ollama, or further release planning.

## Verification evidence

See the [Release 0.2 verification](../verification.md): 177/177 API tests and 43/43 Angular tests passed; API/web production Docker builds and isolated default-Ollama startup/CRUD checks passed. A real OpenRouter call and a real Ollama generation were **not run** in this story. No credentials or billable request were authorized. Release 0.1 evidence is unchanged. Implementation approval was the user's explicit TFA-005 request on 2026-10-16; the user separately approved committing the verified changes on 2026-10-16.

## Reference

[OpenRouter: structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs) — support depends on the chosen model/provider endpoint.
