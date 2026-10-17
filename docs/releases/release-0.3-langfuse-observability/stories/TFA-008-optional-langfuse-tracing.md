# TFA-008: Add optional Langfuse tracing to AI plan generation

## Status

Planned

## User story

As a developer, I want to inspect model-call performance in a separate Langfuse dashboard without storing my task content there.

## Goal

Trace the existing NestJS plan-generation path with explicit opt-in, metadata-only telemetry and no impact on the local default setup.

## Dependencies

`TFA-005`, `TFA-006` and `TFA-007` implemented and locally verified in Release 0.2.

## Acceptance criteria

- [ ] Provide a small version-appropriate Langfuse JS/TS SDK integration into the existing NestJS `PlanPreviewService` path, using explicit/manual observations rather than broad automatic instrumentation.
- [ ] `LANGFUSE_ENABLED` defaults to `false`; public/secret keys and base URL are read **only** from backend environment. Missing/invalid settings produce clear, safe diagnostics when enabled and never leak credentials to frontend, API errors or logs.
- [ ] One selected LLM call can emit a Langfuse generation/span with safe correlation ID, provider/model identifier, `durationMs`, outcome/sanitized error category, and available numeric token usage; missing usage is recorded as unknown.
- [ ] No user task text, description, prompt, full model answer, auth header, raw provider error or other sensitive payload is attached to traces/attributes/events. Document telemetry destination, access settings and disable/retention considerations.
- [ ] Trace/export errors or an unreachable Langfuse endpoint do **not** change model-provider choice, save policy, retry policy, API response, or existing JSON structured `ai_plan_call` logs. No extra LLM requests occur.
- [ ] The original `web`, `api`, `db` Compose stack starts with no Langfuse credentials; only optional API environment settings are passed through. Ollama remains the default and OpenRouter requires explicit selection.
- [ ] Mock-based tests verify disabled mode (zero outbound telemetry), successful Ollama and OpenRouter spans, errors/timeouts, absent token usage, secret/prompt exclusion and non-blocking exporter failure, including graceful shutdown/flush behavior.
- [ ] README and environment examples document activation, how to view a trace in a real Langfuse account, cost/privacy limits and safe off-switch. Record a real dashboard trace/screenshot **only if an endpoint and remote transmission are explicitly authorized**, otherwise mark that check **Not run** in Release 0.3 verification.

## Out of scope

No Angular monitoring UI, new persistent entity, new Compose service, database migration, auto-tracing all NestJS endpoints, model judge, Langfuse prompt management, implicit paid cloud calls or auto-fallback. Avoid claiming full distributed tracing or objective answer-quality measurement from a single AI span.
