---
name: llm-provider-integration
description: Use for Task Flow AI Ollama/OpenRouter adapters, structured JSON/Zod outputs, provider diagnostics and optional, metadata-only Langfuse integration in TFA-008.
---

# LLM provider and observability

## When to load

Use only for an approved AI integration or observability story, primarily in `apps/api/src/plan`, provider config, focused tests and environment examples. TFA-008 adds **optional Langfuse telemetry** but not an always-on tracing SaaS, agent workflow, RAG or generic provider framework.

## Integration boundaries

1. Read the active story, existing Ollama adapter, plan schema and related tests. Keep the existing preview endpoint and validated response contract stable.
2. Preserve **explicit** provider selection; default to Ollama with no automatic cloud fallback. Put OpenRouter secrets in backend environment only, never Angular, logs or Git.
3. Keep model requests bounded by timeout and response size. Parse/validate structured output with Zod regardless of provider; return safe error categories, not raw provider responses.
4. Keep plan scheduling and persistence independent of the chosen LLM adapter. Generation alone must not save a plan.
5. Preserve existing TFA-006 metadata-only logging (provider/model, duration, outcome, safe error category, available token counts). In optional TFA-008, export only those allowlisted fields with an explicitly enabled Langfuse SDK; **never** send task text, prompts, raw replies, secrets, auth headers or raw errors. Default disabled and non-blocking exporter failure are required.
6. Unit-test provider selection, invalid output, missing credentials, timeout and safe diagnostics with mocks. One real-provider smoke is optional and needs explicit permission and credentials; record **not run** otherwise.

## Scope and evidence

Do not build dashboards, new Compose services or databases for telemetry. Use **Release 0.3 verification** for TFA-008, preserving historical Release 0.2 evidence. Report only focused tests and authorized external checks. Follow `AGENTS.md` for approvals and commits.
