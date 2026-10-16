# TFA-006: Add basic LLM call diagnostics

## Status

Planned — Release 0.2; not part of Release 0.1.

## User story

As a developer, I want to see if each AI plan call worked and how long it took.

## Goal

Make model calls easier to debug with small, safe logs.

## Dependencies

`TFA-005` implemented and verified, so both Ollama and OpenRouter can be checked.

## Acceptance criteria

- [ ] Each `plan-preview` provider call writes one structured outcome event with provider, model, success or failure, duration in milliseconds, and a safe error category.
- [ ] A generated non-sensitive request ID ties that event to its backend request and works for both selected providers.
- [ ] Token usage is recorded only when the provider returns it; missing usage stays absent or unknown.
- [ ] Logs never include API keys, task text, prompts, raw model replies, or other user content.
- [ ] The existing API and Angular flow, Ollama default, plan rules, database schema, and three-service Compose stack remain unchanged.
- [ ] Mocked tests cover success, timeout, provider errors, missing usage, and absence of sensitive data in both provider paths.
- [ ] README explains `docker compose logs api`, event fields, and why these logs are not distributed tracing or a Langfuse integration.
- [ ] Release 0.2 verification records only commands, logs, and results actually observed, including any authorized live-provider checks.

## Out of scope

No Langfuse, LangSmith, OpenTelemetry collector, metrics database, dashboard, new endpoint, log of full payloads, cost calculation, retries, or provider fallback. Do not claim full observability or distributed tracing from one NestJS log event.
