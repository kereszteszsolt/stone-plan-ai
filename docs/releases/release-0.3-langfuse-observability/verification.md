# Release 0.3 verification

## Status

**Planned; not run.** Langfuse telemetry has not been implemented or tested in this release.

| Story | Focused mock tests | Default-Ollama regression | Real Langfuse dashboard | Status |
| --- | --- | --- | --- | --- |
| [TFA-008](stories/TFA-008-optional-langfuse-tracing.md) | Not run | Not run | Not run | Planned |

## Evidence to record after implementation approval

- User implementation approval, touched files, test/build commands/results and separate commit approval.
- Off-by-default startup with no telemetry network calls and unchanged `web` / `api` / `db` services.
- Mock exporter test outcomes for metadata-only spans, failures, timeouts, missing usage and shutdown/flush.
- A redacted example of a trace ID, provider/model, duration, status, error category and usage fields; confirm **no prompts, task content or API secrets**.
- A real Langfuse trace/screenshots **only when endpoint, authorization and cost/data transfer were explicitly approved**. Otherwise record *Not run* and do not claim live tracing.

This release adds nothing to the historical Release 0.1/0.2 implementation evidence. Do not claim distributed tracing or model answer quality from these metadata-only observations.
