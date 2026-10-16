# Release 0.2 verification

## Status

In progress. TFA-005 is implemented and locally verified on 2026-10-16. TFA-006 remains planned, so Release 0.2 is not complete. Release 0.1 completion and its historical evidence are unchanged.

| Story | Focused API tests | Docker smoke | Optional live OpenRouter check | Status |
| --- | --- | --- | --- | --- |
| [TFA-005](stories/TFA-005-openrouter-provider-integration.md) | 177/177 API tests passed | Production builds, isolated startup and HTTP CRUD passed | Not run; no credentials or billable call approved | Implemented; commit approved |
| [TFA-006](stories/TFA-006-basic-llm-observability.md) | Not run | Not run | Not run | Planned |

## TFA-005 approval and implementation

Implementation approved by the user's explicit TFA-005 request on 2026-10-16. The user separately approved committing these changes on 2026-10-16 after verification and review. Push was not requested.

- Added direct backend-only OpenRouter selection beside the default Ollama adapter. Invalid selections fail on generation; missing provider settings do not prevent task CRUD or health checks.
- Shared the existing prompt and bounded response reader; retained the same strict Zod proposal validation, deterministic scheduling, preview response and explicit save boundary.
- Added strict JSON Schema requests with `require_parameters: true`, `allow_fallbacks: false`, a configured model, one request, a 64 KiB response cap and a 1–120-second timeout. No SDK, dependency, database migration, Compose service or provider-selector UI was added.
- Added fixed error categories for configuration, model/schema support, authentication/permissions, credits, rate limits, outages, timeouts and invalid output. Angular recognizes those safe codes and preserves drafts/retry behavior. Provider-neutral preview copy avoids describing hosted generation as local.
- Both environment examples, Compose backend settings, README and architecture describe the explicit opt-in and possible hosted usage charges.

## TFA-005 executed checks

Commands below used Node 24.18.0 from `/home/zsolti-wsl/.nvm/versions/node/v24.18.0/bin` for native npm checks. Existing lockfile dependencies were installed; package manifests and locks were not changed.

| Check | Actual command / result |
| --- | --- |
| Prisma client generation and initial API suite, `apps/api` | `npm test`: client generated successfully; sandbox loopback binding failed with `listen EPERM` for 91 HTTP tests, while 83 other tests passed. This was an environment restriction, not an accepted passing run. |
| API suite with local test ports permitted, `apps/api` | `npm --ignore-scripts test`: **5 suites, 177/177 tests passed** after the final envelope edge cases. The already generated Prisma client was reused; no test was skipped. |
| API source and test type checking, `apps/api` | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`: passed, including the final envelope edge cases. |
| Angular component/HTTP tests, `apps/web` | `npm test`: **2 files, 43/43 tests passed**. |
| Compose syntax | `POSTGRES_PASSWORD=tfa005-local-check docker compose --env-file /dev/null config --quiet`: passed. |
| Compose environment assertions | An inline Python subprocess check of `docker compose --env-file /dev/null config --format json` passed for omitted/default Ollama selection, explicit OpenRouter selection, preservation of an empty provider for API rejection, three services, one volume, and no provider credentials in `web`. Only dummy fixture credentials were used; resolved secret values were not printed. |
| API and web production builds | `POSTGRES_PASSWORD=tfa005-local-check docker compose --env-file /dev/null --project-name task-flow-ai-tfa005-check build`: passed, including each app's `npm run build`. |
| Default-Ollama stack startup | The isolated `up --build` command below passed: `web`, `api` and `db` all reported healthy; the API deployed the existing migration to its new test database. |
| HTTP smoke through Nginx | `python3 /tmp/tfa005-docker-smoke.py`: passed against `http://127.0.0.1:18085`. Checked the served Angular shell, `/api/health`, task create/read/update/delete, empty plan/progress, and safe `OLLAMA_NOT_CONFIGURED` preview failure without subtask writes. Deleted its one fixture task; no model request was sent. |
| Isolated fixture cleanup | `POSTGRES_PASSWORD=tfa005-local-check docker compose --env-file /dev/null --project-name task-flow-ai-tfa005-check down --volumes`: removed only the containers, network and database volume created by this check. |
| Diff and documentation | `git -c core.whitespace=cr-at-eol diff HEAD --check`, local Markdown link/fence checks, new TypeScript SPDX checks and unchanged Release 0.1 verification checks: passed. |

The isolated startup command was:

```sh
POSTGRES_PASSWORD=tfa005-local-check AI_PROVIDER=ollama OPENROUTER_API_KEY= OPENROUTER_MODEL= WEB_PORT=18085 \
  docker compose --env-file /dev/null --project-name task-flow-ai-tfa005-check \
  up --build -d --wait --wait-timeout 120
```

This used a newly created `task-flow-ai-tfa005-check_postgres_data` volume and dummy database password, not the normal project's database or `.env`. The temporary HTTP smoke script used Python's standard `urllib`/`json` modules, created one task with a two-day, 30-minute daily budget, and removed that task in a `finally` block.

The mocked API checks cover omitted/explicit/invalid provider selection, OpenRouter without credentials, matching prompts and schedules across providers, schema/body/auth fields, backend-only base URL and timeout, strict proposal rejection, refusals/truncation, oversized body cancellation, network errors and timeout during both request and body reading. Empty tool metadata is accepted, while unexpected tool calls and choice-level errors are rejected. HTTP 400/404/422, 401/403, 402, 429, 500/502/503, 408/504 and an error envelope inside HTTP 200 return fixed errors without echoing or logging fixture secrets/provider bodies. Failure cases issue no second request or fallback. Existing Ollama, CRUD, save/concurrency and progress HTTP contracts passed in the same API suite.

Angular checks cover each added safe AI error category, retry, preserving an edited preview after an OpenRouter failure, and hiding an unknown server failure's private message. They exercise the existing component and HTTP client with mocked responses.

## Not run and evidence limits

- **Real OpenRouter generation: not run.** No credentials or specific billable request were approved. Request/response behavior was tested with mocks; live model/endpoint compatibility is not claimed.
- **Real Ollama generation: not run for TFA-005.** Local-model adapter and scheduling regressions passed with fixtures. The Docker startup smoke intentionally used an unconfigured model so no external model was contacted.
- **Rendered live-browser smoke: not run.** Angular behavior was verified by component/HTTP tests and a production Docker build; the HTTP smoke checked the served shell, not a browser interaction or screenshot.
- **Full stateful `sh infra/smoke.sh`: not run.** No schema or persistence implementation changed; this story used the isolated startup/CRUD check above and the existing save/progress unit contracts.
- TFA-006 diagnostics, request IDs and token metadata remain planned and unverified. No content logging or diagnostic workflow was introduced by TFA-005.

Do not add synthetic success metrics or rewrite [Release 0.1 verification](../release-0.1-mvp/verification.md). Keep separate test results for each story.
