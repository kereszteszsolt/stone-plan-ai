# Release 0.3 — Optional Langfuse tracing

## Status

**Planned; not implemented.** The existing Ollama/OpenRouter call logs from Release 0.2 remain the default and functional without Langfuse.

## Goal

Offer an **opt-in Langfuse dashboard** for developer-only traces of plan generation, while preserving Task Flow AI's small three-service Compose deployment and privacy boundaries.

| Story | Scope | Status |
| --- | --- | --- |
| [TFA-008](stories/TFA-008-optional-langfuse-tracing.md) | Minimal opt-in NestJS LLM spans and usage/latency diagnostics | Planned |

## Technical constraints

- Keep `LANGFUSE_ENABLED=false` by default. Missing credentials must not break `GET /api/health`, CRUD or local Ollama use.
- Instrument **only** the NestJS AI plan-generation path; do not enable blanket HTTP or database auto-tracing.
- Export metadata only: generated request/trace ID, safe provider/model name, duration, outcome, safe error category and numeric tokens if returned. No task titles/descriptions, prompts, model replies, credentials or response bodies.
- Keep existing structured `ai_plan_call` logging for default use; outbound tracing is a small optional adapter, not a new database/API/dashboard in this repo.
- Use hosted Langfuse or an **existing external Langfuse endpoint** if explicitly configured; no Langfuse/ClickHouse/Redis containers in the Task Flow Compose stack.
- Failure to send telemetry must not fail a plan or trigger retries of the LLM. Avoid hidden cloud transmission and unnecessary cost.

## Codex-friendly effort estimate

**Estimated with Codex doing most coding:** approximately **2–4 hours of Codex iterations + 30–60 minutes of user review/commit work**, with extra time for account configuration or endpoint debugging. This is a forecast, not measured time. A single story avoids unnecessary review/commit cycles.

## Documentation / evidence

Use [TFA-008 acceptance criteria](stories/TFA-008-optional-langfuse-tracing.md) and [Release 0.3 verification](verification.md). Existing `llm-provider-integration` skill is appropriate; **no additional agent or skill is needed**.

Out of scope: tracing dashboard in Angular, self-hosted Langfuse infrastructure, OpenTelemetry tracing of all endpoints, prompt management, LLM quality scores, cost estimation without reliable provider rates, multi-user telemetry and automatic cloud provider fallback.
