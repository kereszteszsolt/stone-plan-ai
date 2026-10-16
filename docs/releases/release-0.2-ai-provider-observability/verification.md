# Release 0.2 verification

## Status

Planned. There is no implementation evidence for either story yet. Release 0.1 completion is tracked separately.

| Story | Focused API tests | Docker smoke | Optional live OpenRouter check | Status |
| --- | --- | --- | --- | --- |
| [TFA-005](stories/TFA-005-openrouter-provider-integration.md) | Not run | Not run | Not run | Planned |
| [TFA-006](stories/TFA-006-basic-llm-observability.md) | Not run | Not run | Not run | Planned |

## Evidence to record after approval

- Each story's explicit implementation approval and later commit approval, commands, test outcomes, and commit hash.
- `apps/api` build/tests, relevant Angular checks, and `docker compose up --build` with the unchanged default Ollama configuration.
- Mocked OpenRouter cases for schema/validation, auth errors, rate limits, timeouts, and secret-safe failures.
- A sanitized example of provider, model, duration, outcome, request ID, and known token usage from the TFA-006 logs.
- Proof that user text, prompts, raw model replies, and secrets are absent from logs and error responses.
- A real OpenRouter smoke only if credentials and the specific billable call are explicitly authorized; otherwise mark it **not run**.

Do not add synthetic success metrics or rewrite [Release 0.1 verification](../release-0.1-mvp/verification.md). Keep separate test results for each story.
