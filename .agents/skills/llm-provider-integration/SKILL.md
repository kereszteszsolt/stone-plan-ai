---
name: llm-provider-integration
description: Use for StonePlan AI Ollama/OpenRouter adapters, provider selection, structured JSON/Zod outputs, timeouts, and privacy-safe AI-call diagnostics in planned Release 0.2.
---

# LLM provider and observability

## When to load

Use only for an approved AI-related story (`TFA-005` or `TFA-006`), primarily in `apps/api/src/plan`, provider config, focused tests and environment examples. Do not introduce agent workflows, RAG, tracing SaaS or a generic provider framework.

## Integration boundaries

1. Read the active story, existing Ollama adapter, plan schema and related tests. Keep the existing preview endpoint and validated response contract stable.
2. Preserve **explicit** provider selection; default to Ollama with no automatic cloud fallback. Put OpenRouter secrets in backend environment only, never Angular, logs or Git.
3. Keep model requests bounded by timeout and response size. Parse/validate structured output with Zod regardless of provider; return safe error categories, not raw provider responses.
4. Keep plan scheduling and persistence independent of the chosen LLM adapter. Generation alone must not save a plan.
5. For `TFA-006`, log only approved metadata (e.g. provider/model identifier, duration, success/failure, available token counts). Do **not** log task text, prompts, raw replies, credentials or authorization headers.
6. Unit-test provider selection, invalid output, missing credentials, timeout and safe diagnostics with mocks. One real-provider smoke is optional and needs explicit permission and credentials; record **not run** otherwise.

## Scope and evidence

Do not build dashboards, new Compose services or databases for telemetry. Report focused tests and exactly which external-provider checks were performed in the Release 0.2 verification file. Follow `AGENTS.md` for approvals and commits.
