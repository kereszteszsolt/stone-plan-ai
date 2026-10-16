# Release 0.2 verification

## Status

Implemented and locally verified on 2026-10-16. Both stories passed their separate mocked/local checks; live model/endpoint verification is limited as recorded below. TFA-006 commit was separately approved on 2026-10-16. Local completion does not claim a published or hosted release. Release 0.1 completion and its historical evidence are unchanged.

| Story | Focused API tests | Docker smoke | Optional live OpenRouter check | Status |
| --- | --- | --- | --- | --- |
| [TFA-005](stories/TFA-005-openrouter-provider-integration.md) | 177/177 API tests passed | Production builds, isolated startup and HTTP CRUD passed | Not run; no credentials or billable call approved | Implemented; commit approved |
| [TFA-006](stories/TFA-006-basic-llm-observability.md) | 143/143 focused diagnostics/provider tests passed | API build, isolated startup/CRUD and observed request/log correlation passed | Not run; no credentials or billable call approved | Implemented; commit approved |

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

## TFA-005 not run and evidence limits

- **Real OpenRouter generation: not run.** No credentials or specific billable request were approved. Request/response behavior was tested with mocks; live model/endpoint compatibility is not claimed.
- **Real Ollama generation: not run for TFA-005.** Local-model adapter and scheduling regressions passed with fixtures. The Docker startup smoke intentionally used an unconfigured model so no external model was contacted.
- **Rendered live-browser smoke: not run.** Angular behavior was verified by component/HTTP tests and a production Docker build; the HTTP smoke checked the served shell, not a browser interaction or screenshot.
- **Full stateful `sh infra/smoke.sh`: not run.** No schema or persistence implementation changed; this story used the isolated startup/CRUD check above and the existing save/progress unit contracts.
- TFA-005 did not introduce diagnostic events. TFA-006's later request-ID/token-metadata verification is recorded separately below.

## TFA-006 approval and implementation

The user's explicit request to implement the next story approved TFA-006 on 2026-10-16. The user separately approved committing the verified changes on 2026-10-16; push was not requested.

`PlanPreviewService` writes exactly one fixed-shape JSON `ai_plan_call` event around each selected provider attempt, including rejected proposals and budget failures. The preview controller generates the UUID returned in `X-Request-ID`; caller-provided IDs are ignored. The event contains provider, a bounded configured model identifier, monotonic whole-millisecond duration, outcome, a fixed error category, and any valid reported token counts. Missing/invalid usage stays absent; zero is retained; no totals or costs are computed. The adapters report usage before proposal validation without changing their existing subtask return type. Error codes, API bodies, prompts, scheduling, save behavior, Angular, Compose, schema and dependencies are unchanged.

The README documents `docker compose logs api`, each field, token mapping, privacy exclusions, and the distinction from distributed tracing/Langfuse. Only Release 0.2 status documents were advanced; Release 0.1 verification was left intact.

## TFA-006 executed checks

Native commands used Node 24.18.0 from `/home/zsolti-wsl/.nvm/versions/node/v24.18.0/bin`.

| Check | Actual command / result |
| --- | --- |
| Focused diagnostics and provider regression suites, `apps/api` | `npm --ignore-scripts test -- --runTestsByPath test/diagnostics.spec.ts test/plan.spec.ts test/openrouter.spec.ts`: **3 suites, 143/143 tests passed**. Every provider request was mocked. |
| API source and test type checking, `apps/api` | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`: passed. |
| Production build and isolated startup | The `up --build` command below passed: the changed API ran `npm run build`, the unchanged web image reused its cached production build, and `web`/`api`/`db` reported healthy with a newly created test volume. |
| HTTP and actual diagnostic log smoke | `python3 /tmp/tfa006-docker-smoke.py`: passed. The script checked the served Angular shell, `/api/health`, isolated task CRUD, unsaved progress and safe `OLLAMA_NOT_CONFIGURED` behavior; then asserted one actual event from `docker compose --env-file /dev/null --project-name task-flow-ai-tfa006-check logs --no-color --no-log-prefix api` with the same UUID as the failed HTTP response. No private task/header fixture marker or task ID appeared anywhere in captured API logs. |
| No real-model call guard | Before HTTP generation, the smoke ran a Node assertion via `docker compose ... exec -T api` requiring `AI_PROVIDER=ollama`, the unconfigured model placeholder and an empty OpenRouter key. Model configuration failed before fetch, so no real model was contacted. |
| Cleanup | `POSTGRES_PASSWORD=tfa006-local-check docker compose --env-file /dev/null --project-name task-flow-ai-tfa006-check down --volumes`: removed only the newly created test containers, network and `task-flow-ai-tfa006-check_postgres_data` volume. The smoke deleted its one fixture task in a `finally` block first. |
| Final review | `git -c core.whitespace=cr-at-eol diff HEAD --check`: passed. Relative Markdown link/fence checks passed for 28 links; both new TypeScript files have SPDX headers. Release 0.1 evidence, Prisma schema, Angular, Compose/infrastructure, environment examples and dependencies are unchanged; implementation review left the changes unstaged for separate commit approval. |

The exact isolated startup command was:

```sh
POSTGRES_PASSWORD=tfa006-local-check AI_PROVIDER=ollama OPENROUTER_API_KEY= OPENROUTER_MODEL= WEB_PORT=18086 \
  docker compose --env-file /dev/null --project-name task-flow-ai-tfa006-check \
  up --build -d --wait --wait-timeout 120
```

The first focused run passed 141 tests and failed two timeout fixtures, which rejected a synthetic exception without aborting the configured request signal. The fixtures were corrected to exercise actual signal cancellation; both timeout paths and the final 143-test run passed. An initial type check also found missing Express declarations; the header setter now uses Node's existing `ServerResponse` type instead of adding a dependency. No failure remains in the focused checks.

Tests cover both providers' success, missing/partial/malformed/zero usage, timeout, unavailable provider, rejected model output with known usage, and budget rejection. Concurrent requests retain separate generated IDs and usage. Private title/description/step/error/header/key markers are absent from captured log/warn/error calls; even an API key accidentally assigned as the model becomes `unknown`. Model identifiers are bounded to 160 safe characters and fixed error categories reject arbitrary exception text/codes. Rejections before a provider is selected produce no invented call event. Existing Ollama/OpenRouter schema, parsing and preview HTTP regression tests passed in the same focused run.

An actual event observed in the isolated Docker API, with its UUID verified against the response header, was:

```json
{"event":"ai_plan_call","requestId":"eec53e19-d353-4789-808b-ffcef4cad915","provider":"ollama","model":"unknown","outcome":"failure","durationMs":1,"errorCategory":"OLLAMA_NOT_CONFIGURED"}
```

This configuration-failure event had no usage to report. Mocked success events separately asserted Ollama input/output counts of 12/7 and OpenRouter input/output/total counts of 12/7/19; those are fixtures, not live-provider measurements.

## TFA-006 not run and evidence limits

- **Real Ollama/OpenRouter generation: not run.** Provider outcomes and token reporting were mocked; the Docker check observed only the guarded configuration-failure path. No cloud credentials or billable call were approved.
- **Angular tests and live-browser smoke: not rerun.** No Angular source changed; unchanged preview bodies were checked through the HTTP tests, and the Docker smoke fetched the served shell. No live browser interaction or screenshot is claimed.
- **Complete API suite and full stateful `sh infra/smoke.sh`: not rerun for TFA-006.** Verification used the 143 focused diagnostics/provider/preview tests and isolated Docker CRUD smoke; existing TFA-005 results above are historical, not a new complete-suite run.
- No distributed trace, hosted dashboard, log of model payloads, cost measurement, schema migration, added dependency or new Compose service was introduced.

Do not add synthetic success metrics or rewrite [Release 0.1 verification](../release-0.1-mvp/verification.md). Keep separate test results for each story.
