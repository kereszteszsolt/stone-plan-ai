# TFA-006: Add basic LLM call diagnostics

## Status

Implemented — Release 0.2; locally verified on 2026-10-16 with mocked provider tests, type checking, and an isolated Docker diagnostic/CRUD check. Real model generation was not run. Commit was separately approved on 2026-10-16.

## User story

As a developer, I want to see if each AI plan call worked and how long it took.

## Goal

Make model calls easier to debug with small, safe logs.

## Dependencies

`TFA-005` implemented and verified, so both Ollama and OpenRouter can be checked.

## Acceptance criteria

- [x] Each `plan-preview` provider call writes one structured outcome event with provider, model, success or failure, duration in milliseconds, and a safe error category.
- [x] A generated non-sensitive request ID ties that event to its backend request and works for both selected providers.
- [x] Token usage is recorded only when the provider returns it; missing usage stays absent or unknown.
- [x] Logs never include API keys, task text, prompts, raw model replies, or other user content.
- [x] The existing API and Angular flow, Ollama default, plan rules, database schema, and three-service Compose stack remain unchanged.
- [x] Mocked tests cover success, timeout, provider errors, missing usage, and absence of sensitive data in both provider paths.
- [x] README explains `docker compose logs api`, event fields, and why these logs are not distributed tracing or a Langfuse integration.
- [x] Release 0.2 verification records only commands, logs, and results actually observed, including any authorized live-provider checks.

## Verification evidence

The user's request to implement the next story approved TFA-006 on 2026-10-16. The [Release 0.2 verification](../verification.md) records 143/143 focused diagnostics/provider tests, successful source/test type checking, the production API build, isolated three-service startup, and an observed Docker event whose request ID matches its HTTP response header. Real provider generation and a rendered browser smoke were not run. The user separately approved committing these verified changes on 2026-10-16; push was not requested.

## Out of scope

No Langfuse, LangSmith, OpenTelemetry collector, metrics database, dashboard, new endpoint, log of full payloads, cost calculation, retries, or provider fallback. Do not claim full observability or distributed tracing from one NestJS log event.
