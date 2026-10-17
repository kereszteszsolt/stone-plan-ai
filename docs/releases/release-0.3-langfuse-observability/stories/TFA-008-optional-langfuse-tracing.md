# TFA-008: Add optional Langfuse tracing to AI plan generation

## Status

Implemented

The metadata-only adapter was implemented with local mocks on 2026-10-17. The user approved optional self-hosting and finally chose a project-owned deployment with one root `.env`, superseding the intermediate shared sibling setup. See [Release 0.3 verification](../verification.md) for evidence and limits.

## User story

As a developer, I want to inspect model-call performance in a separate Langfuse dashboard without storing my task content there.

## Goal

Trace the existing NestJS plan-generation path with explicit opt-in, metadata-only telemetry and no impact on the local default setup.

## Dependencies

`TFA-005`, `TFA-006` and `TFA-007` implemented and locally verified in Release 0.2.

## Acceptance criteria

- [x] Provide a small version-appropriate Langfuse JS/TS SDK integration into the existing NestJS `PlanPreviewService` path, using explicit/manual observations rather than broad automatic instrumentation.
- [x] `LANGFUSE_ENABLED` defaults to `false`; public/secret keys and base URL are read **only** from backend environment. Missing/invalid settings produce clear, safe diagnostics when enabled and never leak credentials to frontend, API errors or logs.
- [x] One selected LLM call can emit a Langfuse generation/span with safe correlation ID, provider/model identifier, `durationMs`, outcome/sanitized error category, and available numeric token usage; missing usage is recorded as unknown.
- [x] No user task text, description, prompt, full model answer, auth header, raw provider error or other sensitive payload is attached to traces/attributes/events. Document telemetry destination, access settings and disable/retention considerations.
- [x] Trace/export errors or an unreachable Langfuse endpoint do **not** change model-provider choice, save policy, retry policy, API response, or existing JSON structured `ai_plan_call` logs. No extra LLM requests occur.
- [x] The original `web`, `api`, `db` Compose stack starts with no Langfuse credentials; only optional API environment settings are passed through. Ollama remains the default and OpenRouter requires explicit selection.
- [x] Mock-based tests verify disabled mode (zero outbound telemetry), successful Ollama and OpenRouter spans, errors/timeouts, absent token usage, secret/prompt exclusion and non-blocking exporter failure, including graceful shutdown/flush behavior.
- [x] README and environment examples document activation, how to view a trace in a real Langfuse account, cost/privacy limits and safe off-switch. Record a real dashboard trace/screenshot **only if an endpoint and remote transmission are explicitly authorized**, otherwise mark that check **Not run** in Release 0.3 verification.

## Approved self-hosted extension (2026-10-17)

- [x] Add `infra/compose.langfuse.yaml` as an explicit opt-in overlay; the base file continues to start only `web`, `api`, `db` with no Langfuse credentials required.
- [x] Provide `sh infra/langfuse.sh up` to build/start the combined stack from configured root `.env` settings and provision the local administrator, organization, project and matching backend keys once. Existing credentials must never be overwritten automatically.
- [x] Expose the dashboard on loopback only; keep Langfuse's PostgreSQL, ClickHouse, Redis and S3-compatible storage separate from application data, on an internal network. Disable Langfuse's deployment telemetry; add no cloud/model calls.
- [x] Verify real local SDK export/ingestion with a deterministic model fixture and assert no task/prompt/response/key contents in stored observations. Distinguish this from a live model or hosted-cloud check.
- [x] Verify volume/trace persistence and a working off switch that restores the basic application stack while preserving data and credentials. Document dashboard login, startup, shutdown, storage and update boundaries.


## Final project-owned configuration (2026-10-17)

The user requested simpler operation with Langfuse belonging exclusively to this project. This supersedes the intermediate shared deployment; previous results remain in the verification history.

- [x] Keep all server/client settings in the root `.env`, preserving existing keys, encryption settings, data volumes and model-provider selection.
- [x] Manage the application and Langfuse as one nine-service `task-flow-ai` project, with no sibling-folder, separate client env or external-network dependency.
- [x] Verify retained tasks/observations, actual local SDK export and the combined lifecycle/off switch; remove the obsolete separate deployment after successful migration.

## Out of scope

No Angular monitoring UI, new application entity/schema/migration, unrelated Compose service, production/HA telemetry deployment, auto-tracing all NestJS endpoints, model judge, Langfuse prompt management, implicit paid cloud calls or auto-fallback. Avoid claiming full distributed tracing or objective answer-quality measurement from a single AI span.
