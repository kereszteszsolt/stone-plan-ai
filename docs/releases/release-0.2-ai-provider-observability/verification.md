# Release 0.2 verification

## Status

TFA-005 and TFA-006 are implemented and locally verified on 2026-10-16. The explicitly approved TFA-007 follow-up is also implemented and locally verified, with evidence recorded separately below and commit separately approved on 2026-10-16. Live model/endpoint verification is limited as recorded below. Local completion does not claim a published or hosted release. Release 0.1 completion and its historical evidence are unchanged.

| Story | Focused API tests | Docker smoke | Optional live OpenRouter check | Status |
| --- | --- | --- | --- | --- |
| [TFA-005](stories/TFA-005-openrouter-provider-integration.md) | 177/177 API tests passed | Production builds, isolated startup and HTTP CRUD passed | Not run; no credentials or billable call approved | Implemented; commit approved |
| [TFA-006](stories/TFA-006-basic-llm-observability.md) | 143/143 focused diagnostics/provider tests passed | API build, isolated startup/CRUD and observed request/log correlation passed | Not run; no credentials or billable call approved | Implemented; commit approved |
| [TFA-007](stories/TFA-007-thirty-day-plans.md) | Initial 250/250; final scheduler regression 149/149 passed | Production startup, live CRUD/30-day acceptance/concurrency and fixture-generation browser flow passed | Not run; generation mocked | Implemented; commit approved |

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

## TFA-005 follow-up: bounded OpenRouter output budget, 2026-10-16

The user reported `The model returned an invalid plan` while trying Mistral Large. Existing safe API logs showed an actual user-triggered request for `mistralai/mistral-large-4-0`: `INVALID_AI_OUTPUT`, 10077 ms, 377 input tokens, 1024 output tokens and 1401 total tokens. The adapter was requesting a fixed `max_tokens: 1024`. Exhausting exactly that ceiling strongly suggests an incomplete completion, potentially including reasoning; the previous event did not retain `finish_reason`, so the exact rejection cause is not proven and no raw task/reply was inspected or logged. This is a failed user attempt, not a successful live-provider smoke.

The targeted correction adds backend `OPENROUTER_MAX_TOKENS` (default 4096, integer range 256–8192), passes it through Compose and documents it in both environment examples and README. Normalized `finish_reason: "length"` now returns `OPENROUTER_OUTPUT_TRUNCATED` (502), including when content is empty or parseable but incomplete. Angular recognizes the safe error, and the diagnostics allowlist retains the category and available numeric usage. Strict schema validation, the 64 KiB response cap, selected model, credentials, one-request behavior, no fallback and explicit plan saving are preserved. A higher configured budget permits more per-request usage; no retry or reasoning-mode change was added.

Observed checks for this follow-up:

| Check | Actual command / result |
| --- | --- |
| Targeted API regression tests, `apps/api` | `npm --ignore-scripts test -- --runTestsByPath test/diagnostics.spec.ts test/plan.spec.ts test/openrouter.spec.ts`: **3 suites, 153/153 tests passed**. All model requests mocked; includes default/custom/boundary/invalid output caps, truncated empty/partial/parseable content, preserved usage, one failure event and no partial-plan writes or retry. |
| Angular, `apps/web` | `npm test`: **2 files, 44/44 tests passed**, including the safe truncation message and retry. |
| API source/test type checking, `apps/api` | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`: passed. |
| Compose and documentation assertions | Default/custom/empty `OPENROUTER_MAX_TOKENS` values were checked through `docker compose --env-file /dev/null config --format json` with dummy database credentials: backend-only budget, default Ollama and the unchanged three-service/one-volume layout passed. Markdown links/fences passed for 18 relative links; Release 0.1, schema, dependencies and Ollama adapter are unchanged. |
| Production Docker update | `docker compose up --build -d --wait --wait-timeout 180`: API/web builds passed; all three normal project containers reported healthy and the existing database stayed running. No volume was removed. |
| Runtime configuration and served frontend | A Node check via `docker compose exec -T api` verified `AI_PROVIDER=openrouter`, output cap `4096`, key presence and a model hash matching the current local Compose config. HTTP GET checks verified `http://localhost:8080/api/health`, the app shell, and `OPENROUTER_OUTPUT_TRUNCATED` in the served JavaScript bundle. No generation request was sent. |

The initial runtime assertion compared the model with the earlier Mistral error event and failed that literal-name check. Inspection showed that the current local `.env` already selects `qwen/qwen3.8-flash`; the final check verified that the running API matches that current setting. The fix did not change the user's local model or credentials, and does not claim a live Mistral success after the update.

Provider semantics were checked against [OpenRouter's max-token documentation](https://openrouter.ai/docs/api/reference/parameters) and [reasoning-budget documentation](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens). They document that most reasoning providers share `max_tokens` between reasoning and visible text and can return `finish_reason: "length"` with empty content when that budget is consumed. The exact user request was not replayed. No new billable model call was approved or sent, and no live success is claimed after the change. The user separately approved a fix commit on 2026-10-16, before TFA-007 implementation.

## TFA-007: thirty-day horizons and balanced plans, 2026-10-16

The user explicitly requested creating TFA-007 and executing it. The previous generation-error correction was reviewed and separately committed first as `b8e28a0` (`fix: configure OpenRouter output budget`). The private environment files were confirmed untracked, and the files in that fix commit were compared with configured private API-key values without printing any key; no match was found. The user separately approved committing TFA-007 on 2026-10-16.

Task creation/editing now accepts 1–30 whole-number days in Angular and strict API input validation. Both providers share task-aware bounds: `max(3, days)` to `max(8, 2 * days)`, so a 30-day plan requires 30–60 steps. Prompt and requested schema include the stored horizon, daily and total minutes; task-specific response parsing rejects out-of-range step counts. The save endpoint first validates a strict 3–60-step payload, then checks the current task-specific count inside the existing task lock/transaction. One-day step estimates and impossible ordered packing remain server-validated. Existing saved schedules/progress are not redistributed or revalidated against the new minimum count, and saved budgets remain locked.

Preview and save use one deterministic ordered scheduler. It first minimizes the maximum daily load within the daily budget, then minimizes load variance across nonempty days. The second criterion was added after visual review of the first browser run showed avoidable front-loading when the final estimate increased. A fixed 60-step fixture with 59 ten-minute steps and a final twenty-minute step now must produce 29 twenty-minute days and one thirty-minute day, using all 30 days. No filler, step splitting or reordering is introduced.

Ollama's requested output budget scales from 1024 to 7680 tokens with the maximum step count. OpenRouter's existing configured ceiling is preserved (default 4096, configurable up to 8192); its safe truncation error, bounded response/timeout, one-call behavior, no retry/fallback and selected model/credentials are preserved. A longer plan can need a manually adjusted output ceiling, but no hosted budget is automatically increased.

| Check | Actual command / result |
| --- | --- |
| Initial focused API suites, `apps/api` | `npm --ignore-scripts test -- --runTestsByPath test/tasks.spec.ts test/plan.spec.ts test/plan-horizon.spec.ts test/openrouter.spec.ts test/progress.spec.ts test/diagnostics.spec.ts`: **6 suites, 250/250 passed**. Model HTTP mocked throughout. Includes create/edit boundaries, both provider prompts/schemas and 30-day preview/count rejection, accepted-plan count validation under the stored task lock, saved-plan compatibility and diagnostics. |
| Final scheduling refinement, `apps/api` | `npm --ignore-scripts test -- --runTestsByPath test/plan-horizon.spec.ts test/plan.spec.ts test/progress.spec.ts test/diagnostics.spec.ts`: **4 suites, 149/149 passed** after adding variance balancing and its regression. An independent exhaustive oracle compares all contiguous partitions for 972 small input/horizon combinations, checking rejection, minimum busiest-day load, minimum variance, day use, order and unchanged estimates. |
| Angular, `apps/web` | `npm test`: **2 files, 51/51 passed**. Includes 30-day create/edit, invalid days without writes, 60 editable preview fields, explicit acceptance payload and rendering 30 saved days/60 completion controls. No Angular source changed after this run. |
| Type checking | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` in `apps/api`: passed, including after the final scheduler change. An initial overly concrete JSON-schema test cast was rejected and replaced with a matcher assertion before the passing check. |
| Native builds | `npm run build` in `apps/api` and `apps/web`: passed. The API Prisma client was regenerated without a schema/dependency change. The final scheduler is also covered by the subsequent Docker API production build. |
| Initial Docker update | `docker compose up --build -d --wait --wait-timeout 180`: production API/web builds and three-service healthy startup passed; existing database remained running, no volume removed. |
| Live HTTP/database checks | `docker compose exec -T api node < apps/api/test/tasks-smoke.cjs` and `docker compose exec -T api node < apps/api/test/plan-save-smoke.cjs`: passed. Own fixtures cover CRUD validation, atomic save, duplicate/budget concurrency guards, 30-day/60-step save/read, count rejection without partial writes, 60-step progress, idempotent completion and cascade cleanup. No model requests. |
| Initial rendered browser flow | `test/horizon-smoke.cjs` passed using Windows Node/Chrome: 30-day native form validation/create, browser-fixture 60-step generation, edit, real API/database save/completion/reload, 1200×900 light and 390×844 dark rendering, no horizontal overflow or page errors, and fixture deletion. The screenshots were visually reviewed; that review motivated the final balancing refinement above. |
| Final Docker update and persistence regression | `docker compose up --build -d --wait --wait-timeout 180`: final API production build and healthy three-service startup passed. The existing database and web containers remained running. `docker compose exec -T api node < apps/api/test/plan-save-smoke.cjs` passed again against that final image. |
| Final rendered browser and edited-estimate balance | From `apps/web`: Windows Node `-e` set `CHROME_EXECUTABLE` to installed Chrome, set `TEMP`/`TMP` to the ignored `.angular` directory, then `require("./test/horizon-smoke.cjs")`. The complete 30-day/60-step flow passed again against the final image, now also asserting 29 twenty-minute days and one thirty-minute day after increasing the last estimate. Screenshots: `apps/web/.angular/task-flow-ai-tfa007-oHbsmA/desktop-preview.png` and `mobile-saved.png`; mobile rendering was visually reviewed. Temporary database fixtures were deleted and no provider request was sent. |
| Runtime/configuration and HTTP health | A Python subprocess check of `docker compose config --format json` and `docker compose exec -T api node -e ...` compared only SHA-256 hashes of runtime/configured provider, model, private key and output ceiling: all matched. HTTP root and `/api/health` passed; Compose still has three services and one volume. No secret values were printed. |
| Final source/docs/key review | `git -c core.whitespace=cr-at-eol diff HEAD --check` passed. Inline Python checks passed for 30 relative Markdown links, balanced fences, new-source SPDX headers, unchanged Release 0.1/schema/dependencies, untracked private environment files, no configured private key in the 27 changed/new files, and an empty Git index. |

The cached Linux Chromium could not launch because `libnspr4`/NSS/audio libraries are missing. Windows Node/Chrome were already installed; WSL command environment variables were not forwarded, so the passing browser command set `CHROME_EXECUTABLE`, `TEMP` and `TMP` inside Windows Node before requiring the script. Profiles/screenshots were isolated under the ignored `apps/web/.angular/` directory. No browser or system dependency was installed.

**Not run:** a real Ollama or OpenRouter generation, live 30-day model-quality verification, and the full `sh infra/smoke.sh` database-restart test. All model requests in this story were mocked; real acceptance/completion used temporary local database fixtures. No provider charge, model change, API-key change, database migration, added dependency/service or new release was introduced. Release 0.1 evidence is unchanged. The user separately approved commit `feat: implement TFA-007 thirty-day planning` on 2026-10-16. Push was not requested.

Do not add synthetic success metrics or rewrite [Release 0.1 verification](../release-0.1-mvp/verification.md). Keep separate test results for each story.

## StonePlan AI rename and local Docker redeployment, 2026-10-18

The user explicitly requested renaming Task Flow AI to **StonePlan AI** (`stone-plan-ai`) and redeploying Docker. This maintenance change updates the Angular heading/document title, API/web package and lockfile names, Compose project, fresh-install database defaults, README and repository-local agent/skill descriptions. Existing `TFA-*` IDs and previous verification results are retained. `STONE_PLAN_SMOKE_URL` is the current smoke-test URL setting; the previous variable remains a compatibility fallback.

The local `.env` keeps its existing database/user/password and provider settings. Only `POSTGRES_VOLUME_NAME=task-flow-ai_postgres_data` was added, selecting the original persisted database. Fresh installs default to a project-specific volume; an isolated `--project-name stone-plan-ai-isolation-check --env-file /dev/null` configuration check confirmed that its volume stays separate. The previous core application containers were stopped/removed without removing volumes. Separately running services were left intact. Compose warned about the reused volume's original project label; its actual mount and persisted rows were verified below.

| Check | Actual command / result |
| --- | --- |
| Production builds | `docker compose build`: API and web passed, including Prisma generation, NestJS build and Angular production build. Both package/lockfile names match `@stone-plan-ai/api` or `@stone-plan-ai/web`; dependency resolutions are unchanged. |
| Docker startup | `docker compose up -d --force-recreate --wait --wait-timeout 180`: passed. `stone-plan-ai-db-1` and `stone-plan-ai-api-1` are healthy; `stone-plan-ai-web-1` is running at `127.0.0.1:8080`. The API/web container image IDs match the rebuilt images, and the API runtime environment matches the current Compose configuration without printing credentials. |
| HTTP | Python `urllib.request` checks: `/`, `/api/health` and `/api/tasks` returned HTTP 200. The served document title is `StonePlan AI`; health returned `{"status":"ok"}`. |
| Live browser | From `apps/web`, installed Windows Node/Chrome ran `require("./test/crud-smoke.cjs")` with `CHROME_EXECUTABLE` set to installed Chrome, `TEMP`/`TMP` set to the ignored `.angular` directory, and `STONE_PLAN_SMOKE_URL=http://localhost:8080`. Passed: document title and visible H1, real task CRUD/reload, failed-save recovery, delete confirmation, list retry, 1200 px/light, 390 px/dark and 320 px/light with no horizontal overflow or page errors. The script deleted its own temporary task. Screenshots: `apps/web/.angular/stone-plan-ai-tfa002-gZP9f9/`. |
| Data preservation | Before replacement, `pg_dump --format=custom` saved a backup to `/tmp/stone-plan-ai-rename-dg1e6fbn/postgres-before-rename.dump`. Python compared SHA-256 fingerprints of ordered JSON containing every `Task` and `Subtask` row before deployment and after browser cleanup: identical; **6 tasks and 40 subtasks** retained. `docker inspect` confirmed the new database uses `task-flow-ai_postgres_data`. |
| Source checks | `sh -n infra/smoke.sh` and Windows Node `--check` for all four browser smoke scripts passed. Package/lock metadata and unchanged dependency resolutions checked with Python. No configured private API key appears in changed tracked files; private env files remain untracked. Release 0.1 evidence is unchanged. |

**Not run:** unit suites, the full database-restarting `sh infra/smoke.sh`, and live Ollama/OpenRouter generation. No model call or provider charge was incurred. No new story/release, dependency or schema change was introduced. Commit and push were not requested.

## Old Docker project cleanup and dedicated host port, 2026-10-18

The user subsequently requested deleting the old Docker deployment and choosing a host port distinct from other deployed applications. Project-label checks identified six remaining `task-flow-ai` Langfuse containers, three networks and eight unused project application image tags. These were stopped/removed with scoped `docker stop`, `docker rm`, `docker network rm` and `docker image rm`, without force or global pruning. The active StonePlan PostgreSQL volume and five historical Langfuse data volumes were retained. No old-project container, network or `task-flow-ai*` image tag remained after cleanup.

**The current StonePlan AI URL is http://localhost:33050.** Docker inspection of all running/stopped containers found no reservation for host port 33050; Windows `Get-NetTCPConnection -State Listen` also confirmed it was free before deployment. `WEB_PORT`, the Compose default, `.env.example`, current README/architecture URLs and smoke helper defaults now use 33050. The existing loopback binding and internal Nginx port 80 are retained.

| Check | Actual command / result |
| --- | --- |
| Port configuration/startup | Parsed `docker compose config --format json`: only `web` publishes `127.0.0.1:33050` to port 80, with the original PostgreSQL volume. `docker compose up -d --no-deps --force-recreate --wait --wait-timeout 60 web` passed. API/database container IDs are unchanged; both remain healthy. Production application sources/images did not require another build. |
| HTTP/browser | `/`, `/api/health` and `/api/tasks` at port 33050 returned HTTP 200. Installed Windows Chrome verified the document title, visible `StonePlan AI` H1 and same-origin health/task API fetches with no page errors. No fixture or model request was created. Docker inspection confirmed only `stone-plan-ai-web-1` reserves host port 33050. |
| Data preservation | Complete ordered Task/Subtask JSON SHA-256 fingerprints matched before cleanup, after cleanup and after the port change: **6 tasks, 40 subtasks** unchanged. All six existing named data volumes were retained. Local cleanup report: `/tmp/stone-plan-ai-old-docker-cleanup.json`. |
| Source review | `sh -n infra/smoke.sh` and `git -c core.whitespace=cr-at-eol diff HEAD --check` passed. Current URL/default references were checked; historical release evidence and Release 0.1 criteria retain their original port. |

Unit suites and the full stateful smoke were not repeated for these operational changes. No live model call or dependency/schema change was introduced. The user separately approved committing the complete rename/port change on 2026-10-18; push was not requested. Commit message: `chore: rename project to StonePlan AI and assign dedicated Docker port`.

## Brand-driven shell, favicon and About, 2026-10-18

The user requested consuming the supplied `brand/` catalog, creating a favicon in the poster's artistic style, separating tasks/details with an actual sidebar and fading lines, and displaying the configured license/current-year author attribution with About information. They explicitly clarified that Ways to support offers voluntary support for the author, and subsequently requested redeploying the finished app.

`brand/branding.json` supplies the app name, browser title, author, license label, optional links and artwork selection. The new shared SVG favicon/app mark uses the poster's indigo, cream, lavender, mint and gold palette. Original SVG/PNG posters are unchanged. The sidebar footer shows the configured author and current browser year; its attribution and the navbar About button open a native modal dialog. About includes the supplied poster, repository, author website/profile and clearly labelled **Support the author** links. Empty optional project websites are omitted. Existing task editing, preview acceptance and saved-plan behavior remain intact.

Angular rejected an initial direct asset input outside the web workspace. The dependency-free `scripts/prepare-brand.cjs`, run before npm start/build/watch/test, now copies the single editable catalog into ignored `.brand/`; Angular imports/packages that generated copy. Docker includes the source catalog and preparation script. No dependency or backend/schema change was added.

| Check | Actual command / result |
| --- | --- |
| Frontend tests | From `apps/web`, `PATH="/home/zsolti-wsl/.nvm/versions/node/v24.18.0/bin:$PATH" /home/zsolti-wsl/.nvm/versions/node/v24.18.0/bin/npm test`: **2 files, 54/54 passed**. Includes configured title/favicon/attribution, optional links and author-support semantics, About draft retention and existing task/preview regressions. Earlier Windows Node execution could not use the installed Linux esbuild binary; an attempted isolated Node container did not start because the standalone image was unavailable and credential lookup failed. The passing test run used the existing native Linux Node. |
| Production build/redeploy | `docker compose build web`, then `docker compose up -d --no-deps --force-recreate --wait --wait-timeout 60 web`: passed at `http://localhost:33050`. After visual review, dark-link contrast and the tablet sidebar height were refined; the same build/up commands passed for the final image. API/database containers were not recreated. |
| Real browser/data flow | Installed Windows Node/Chrome ran `require("./test/crud-smoke.cjs")` from `apps/web`, with Chrome configured and `TEMP`/`TMP` under ignored `.angular`. Passed: config-driven heading/title/favicon, sidebar/footer geometry, native modal autofocus/focus containment/Escape/focus return, footer trigger and unsaved draft retention; real task CRUD/reload, failed-save recovery, deletion confirmation and list retry. At 1200 px/light, 390 px/dark and 320 px/light, all four form fields remained present with no horizontal overflow or page errors. Own fixture deleted. Artifacts: `apps/web/.angular/stone-plan-ai-tfa002-fAXCTo/`. |
| Final visual regression | Windows Node ran ignored `.angular/branding-final-check.cjs` against the final image: 1200 px/light, 768 px/light, 390 px/dark and 320 px/light all passed heading/title, layout, footer, modal/keyboard and overflow checks with no page errors. Measured About-link contrast: **7.37:1 light, 7.90:1 dark**. Final images: `apps/web/.angular/stoneplan-brand-final/`; desktop and mobile/tablet screenshots were visually reviewed. |
| Assets/runtime/persistence | HTTP-fetched favicon and both posters matched source SHA-256 bytes. `/api/health` passed. The rebuilt web image uses host port 33050, and pre-deployment API/database IDs are unchanged. Complete ordered Task/Subtask JSON fingerprints before deployment and after browser cleanup matched: **6 tasks, 40 subtasks** unchanged. |
| Source review | `git -c core.whitespace=cr-at-eol diff HEAD --check`, Node syntax checks, SVG parsing, generated/source JSON equality and original artwork hashes passed. Private keys were absent from changed/new source, generated files are ignored, index is empty, dependencies/API/Compose and Release 0.1 evidence are unchanged. |

**Not run:** API unit suites, the full database-restarting smoke, and live model generation. No model call or charge was incurred. No commit or push was requested for this follow-up. Suggested commit: `feat: add brand-driven app shell and About dialog`.

## Footer website, visible URLs and author-support buttons, 2026-10-18

The user requested replacing the sidebar's redundant About trigger with `kereszteszsolt.hu`, keeping the copyright year automatic, showing the actual About URLs alongside link labels, and redeploying. They additionally requested reusing a sibling project's Buy Me a Coffee button and adding destination tooltips to both author-support links.

The footer website hostname and destination come from `authorWebsite`; the navbar retains the About button. All About destinations display their complete URLs and native hover tooltips, including the project source, author profile/site, license and voluntary author-support links. Long URLs wrap without truncation. `buy-me-a-coffee-orange.png` was copied unchanged from `../cite-nook-ai/docs/assets/` into `brand/assets/` and remains locally served. The coffee destination comes from the existing brand configuration. `currentYear` reads the browser's current year during rendering, including after a year change without rebuilding/reloading the app.

| Check | Actual command / result |
| --- | --- |
| Angular | Native Node 24.18.0 `npm test` in `apps/web`, with its bin directory prepended to PATH: **2 files, 54/54 passed**. Updated checks cover the website footer, visible URL/href equality, tooltip destinations, reused coffee asset and navbar About draft retention. |
| Build/redeploy | `docker compose build web && docker compose up -d --no-deps --force-recreate --wait --wait-timeout 60 web`: passed at `http://localhost:33050`. Latest image ID verified; API/database container IDs unchanged. |
| Real browser | Installed Windows Node/Chrome ran ignored `.angular/branding-links-check.cjs`: 1200 px/light, 390 px/dark and 320 px/light passed footer hostname/href, visible complete URLs, matching tooltip destinations, decoded 545 px coffee source image, modal closing and no horizontal overflow/page errors. Source/profile/website and author-support screenshots: `apps/web/.angular/stoneplan-links-final/`; desktop and mobile captures visually reviewed. |
| Year rollover | On an already loaded page, Playwright `page.clock.setFixedTime(new Date('2032-01-02T12:00:00Z'))` followed by opening About updated both sidebar/About copyright to **2032**, without reload. This runtime check replaced an initial unit-only Date prototype mock that did not refresh the view. Normal browser sessions retain the actual current year. |
| Assets/data | `cmp` confirmed the sibling/local PNG bytes are identical; HTTP-fetched PNG bytes also match. Existing poster hashes unchanged. `/api/health` passed; complete ordered Task/Subtask JSON fingerprints before/after matched: **6 tasks, 40 subtasks** retained. |

No model call, backend/schema/dependency change, database restart, commit or push was required. Full CRUD and database-restart smoke were not repeated for this presentation-only follow-up. Suggested commit for the complete pending UI change: `feat: add branded sidebar and About links`.

## Compact filled About actions, 2026-10-18

The user supplied a button-group reference and requested adapting it to this app while using less vertical space. The current About design supersedes the full URL rows and repeated project/author/support headings above: one wrapping group contains filled icon links for `kereszteszsolt.hu`, Source, GitHub profile, Ways to support, Buy me a Coffee and the configured license. Optional empty destinations remain omitted. Tooltips describe each link and include its unchanged configured URL; website/support tooltips include **hu | en | ro | de**. Support descriptions explicitly identify voluntary author support. The existing copyright identifies the author.

The poster is now a small preview alongside a shorter app description. The coffee action uses a warm gold fill and cup icon matching the poster palette. All original artwork, including the previously copied coffee PNG, remains unchanged in the asset catalog. Existing sidebar attribution and automatic year behavior are retained.

| Check | Actual command / result |
| --- | --- |
| Angular | Native Node 24.18.0 `npm test` in `apps/web`: **2 files, 54/54 passed**. Updated link checks verify button labels, configured URLs, descriptive/language tooltips, optional destinations and voluntary-support semantics. |
| Build/redeploy | `docker compose build web && docker compose up -d --no-deps --force-recreate --wait --wait-timeout 60 web`: passed at `http://localhost:33050`. Latest image verified; API/database IDs unchanged. |
| Live browser | Installed Windows Node/Chrome ran ignored `.angular/branding-buttons-check.cjs`: 1200 px/light, 768 px/light, 390 px/dark and 320 px/light passed six filled buttons, exact configured destinations, tooltip descriptions/languages, Escape/focus return, and no scrolling, horizontal overflow or page errors. Dialog heights: **331, 331, 335 and 386 px** respectively; button groups: **82, 82, 128 and 174 px**. Desktop uses two button rows; the narrower mobile layouts wrap naturally. Screenshots under `apps/web/.angular/stoneplan-buttons-final/`; desktop/light and mobile/dark visually reviewed. |
| Preservation/review | Complete Task/Subtask fingerprints before/after matched: **6 tasks, 40 subtasks** retained; HTTP health passed. Original artwork hashes and coffee PNG bytes are unchanged. The user had staged the earlier UI work before this request; the complete staged-diff SHA-256 was recorded and verified unchanged. This follow-up only adds working-tree edits. `git -c core.whitespace=cr-at-eol diff HEAD --check` passed. |

API unit suites, full CRUD/database-restart smoke and model calls were not repeated for this presentation change. No dependency, provider, schema, Git staging, commit or push operation was introduced. Suggested commit for the pending UI work: `feat: add branded workspace and compact About actions`.

## Large About poster, inline license and speech-bubble tooltips, 2026-10-18

The latest user request restores the large poster above the description and button collection. Buy me a Coffee and Ways to support now share a dedicated row, including at 320 px. Apache-2.0 is a plain clickable text link after the author's copyright, separated by a comma, in both About and the sidebar. The modal close control is a round button with an SVG cross and visible keyboard focus.

The dependency-free Angular tooltip directive replaces native link titles with speech bubbles. Each bubble includes its description and full destination URL, supports hover and keyboard focus, and remains visible while the pointer moves onto its content. Only one bubble appears at a time; Escape dismisses it before the native dialog closes. Positioning accounts for viewport/dialog edges, and tooltips are removed on scroll, resize, modal close and directive destruction. Names, destinations and artwork still come from the shared brand catalog; original posters and the coffee PNG are preserved.

| Check | Actual command / result |
| --- | --- |
| Angular | From `apps/web`, native Node 24.18.0 `npm test`: **2 files, 56/56 passed**. Includes inline copyright/license, grouped support links, configured destinations, keyboard tooltip descriptions/Escape, replacement of an existing hovered tooltip and cleanup on modal close, plus existing task/preview regressions. |
| Production deployment | `docker compose build web`, then `docker compose up -d --no-deps --force-recreate --wait --wait-timeout 60 web`: passed. HTTP serves the new `main-FNZOZJ2W.js` bundle at `http://localhost:33050`; only the web container was recreated. |
| Live Chrome | Windows Node/Chrome ran ignored `.angular/branding-bubbles-check.cjs`: **1200×900 light, 768×900 light, 390×844 dark, 320×640 light and 640×360 dark** passed. Verified large poster → description → five action buttons; paired support buttons; inline unfilled license; round SVG close button; hover/focus tooltip descriptions, URLs, language availability, ARIA association and placement within bounds; pointer movement into the bubble; first-Escape tooltip dismissal; focus return; unsaved draft retention; and automatic copyright after setting the browser clock to 2032. No horizontal overflow, page errors or API write requests. Short landscape view scrolls the modal while keeping its header accessible. Screenshots: `apps/web/.angular/stoneplan-bubbles-final/`; desktop and both mobile themes visually reviewed. |
| Preservation/review | Complete ordered Task/Subtask JSON fingerprints before/after matched: **6 tasks and 40 subtasks unchanged**. API/database container IDs are unchanged, `/api/health` returns OK and the web remains bound to `127.0.0.1:33050`. Original poster hashes match. Existing staged-diff SHA-256 is unchanged. `git -c core.whitespace=cr-at-eol diff HEAD --check` and Node syntax checks for the updated CRUD smoke/browser helper passed. |

The existing CRUD smoke was updated for custom tooltips but the full CRUD/database-restart smoke, API suites and model calls were **not run** for this UI follow-up. No dependency, provider, schema, staging, commit or push change. Suggested commit for the pending UI work: `feat: refine branded About layout and accessible tooltips`.

## Voluntary support note below About actions, 2026-10-18

The user supplied a Hungarian reference and requested a similar English note below the buttons, separated visually. About now has a fading divider and a small decorative circled exclamation icon above the existing copyright. The note reads: “Support is voluntary and creates no obligations or entitlement to priority service, special access, or anything in return. Thank you for your interest and for supporting my work in any way!” It uses the existing theme colors and a static `role="note"`; support destinations and buttons are unchanged.

- `docker compose build web` passed, followed by `docker compose up -d --no-deps --force-recreate --wait --wait-timeout 60 web`. The new web bundle is `main-3TFD6XSF.js` at `http://localhost:33050`; API/database container IDs are unchanged.
- Installed Windows Node/Chrome ran ignored `.angular/branding-support-note-check.cjs`: **1200×900 light, 390×844 dark and 320×640 light** passed exact English copy, note placement below buttons and above copyright, fading divider, decorative icon, paired support buttons, no horizontal overflow, Escape/focus return and HTTP health. No page errors or API write requests. Screenshots under `apps/web/.angular/stoneplan-support-note-final/`; desktop/light and mobile/dark visually reviewed.
- `git -c core.whitespace=cr-at-eol diff HEAD --check` and browser-helper Node syntax checks passed. The staged-diff SHA-256 is unchanged. Unit/API suites, full CRUD/database-restart smoke and model calls were **not run** for this static text/CSS addition. No dependency, schema, Git staging, commit or push operation. Suggested commit: `feat: clarify voluntary author support in About`.

### Exact support copy correction, 2026-10-18

The user supplied replacement copy, now reproduced verbatim: “Support is voluntary and does not create any obligation, priority service, special access or other consideration. Thank you for your attention, and also if you support my work in any way!” Only the paragraph text and the existing ignored browser check's expected text changed.

`docker compose build web` and `docker compose up -d --no-deps --force-recreate --wait --wait-timeout 60 web` passed; the new bundle is `main-DQBTKSMS.js`. Windows Node/Chrome `.angular/branding-support-note-check.cjs` passed the exact rendered copy, existing divider/placement, paired buttons, overflow, Escape/focus return and HTTP health at 1200×900 light, 390×844 dark and 320×640 light, with no page errors or API writes. API/database container IDs and the existing staged-diff hash are unchanged. `git -c core.whitespace=cr-at-eol diff HEAD --check` passed. Unit/API suites, CRUD/database-restart smoke and model calls were **not run** for this text-only correction. No commit or push. Suggested commit: `fix: use supplied voluntary support copy`.

### Commit approval and final review, 2026-10-18

The user explicitly requested committing the completed changes. Reviewed all 24 intended paths across the index and worktree; no unrelated files are included. Both `git -c core.whitespace=cr-at-eol diff HEAD --check` and its `--cached` equivalent passed. A pattern scan of both versions found no private keys, provider/GitHub/AWS tokens or credential-bearing URLs. Generated `.brand`/`.angular` output and local `.env` are untracked; prepared brand JSON matches its source, SVGs parse, and original poster hashes are unchanged. Existing 56/56 Angular test results and the subsequent successful production builds/browser checks above cover the final change; tests were not repeated for commit-only work. Approved commit message: `feat: add branded workspace and About dialog`. No push requested.

## Unused asset audit and coffee PNG removal, 2026-10-18

The user requested removing the old orange coffee-button PNG if unused and checking other unused assets. Audited all four tracked image assets and searched the repository's app, configuration, tests and documentation. `buy-me-a-coffee-orange.png` had only documentation/history mentions; the About action renders an inline SVG cup. Removed the 4,885-byte PNG and corrected the branding guide. Earlier verification entries remain historical evidence.

Retained `stoneplan-ai-favicon.svg`, selected for both favicon and app icon, and `stoneplan-ai-poster.svg`, selected for the About poster. `stoneplan-ai-poster.png` is not rendered by the app but remains the explicitly documented social-preview alternative. No other tracked image/font/media assets were found. Both original poster hashes are unchanged.

The brand-preparation script passed: all configured assets exist, prepared copies match their sources, SVG XML parses, and the removed PNG is absent from `.brand`. `docker compose build web` and `docker compose up -d --no-deps --force-recreate --wait --wait-timeout 60 web` passed. The deployed `/usr/share/nginx/html/assets/brand/` contains exactly the three retained files; each HTTP response matches its source bytes at `http://localhost:33050`. API health passed and API/database container IDs are unchanged. `git -c core.whitespace=cr-at-eol diff HEAD --check` passed. Unit suites, browser/CRUD smoke and model calls were **not run** for this asset-only removal. No commit or push requested for this follow-up. Suggested commit: `chore: remove unused coffee button asset`.

## License hover and support-tooltip width, 2026-10-19

The user requested keeping the Apache-2.0 text colored while underlining it only on hover, and widening the Ways to support tooltip so the German `de` label is not stranded on its own line. Both sidebar and About license links now use hover-only underlining. The tooltip directive accepts an optional width; Ways to support requests 352 px, clamped to the existing dialog/viewport limits. Other links retain their previous natural sizing and 304 px cap. The support description puts language availability on a separate line without changing the wording or destination.

`docker compose build web` and `docker compose up -d --no-deps --force-recreate --wait --wait-timeout 60 web` passed; the new bundle is `main-ZZNEF7CK.js`. Installed Windows Node/Chrome ran ignored `.angular/branding-link-polish-check.cjs` at **1200 px/light, 1200 px/dark, 390 px/dark and 320 px/light**. Both license links retained their color, showed no underline at rest or after pointer exit, and showed an underline during hover. The support bubble measured **352, 352, 352 and 284 px** respectively. DOM Range geometry confirmed all four language codes occupy one line at every width. No clipping, page errors or API writes; tooltip Escape dismissal passed. Desktop/light and mobile/dark screenshots under `apps/web/.angular/stoneplan-link-polish-final/` were visually reviewed.

API/database container IDs are unchanged, HTTP health passes, and the web remains published exclusively on `127.0.0.1:33050`. `git -c core.whitespace=cr-at-eol diff HEAD --check` and browser-helper syntax checks passed. Unit/API suites, CRUD/database-restart smoke and model calls were **not run** for this presentation follow-up. No dependency, schema, commit or push change. Suggested commit: `fix: refine license hover and support tooltip layout`.

## Two-line author-support tooltips, 2026-10-19

The user clarified that both Buy me a Coffee and Ways to support should use wider bubbles so the description does not wrap above the URL. Live font measurement found minimum outer widths of **314 px for Coffee** and **328 px for Ways to support**. Removed the previously inserted hard break before language availability and assigned both support actions a 384 px preferred width. Other actions, tooltip text/destinations and license hover behavior are unchanged. Viewport/dialog clamping remains active on narrow screens.

`docker compose build web` and `docker compose up -d --no-deps --force-recreate --wait --wait-timeout 60 web` passed; bundle `main-COF3NSEV.js` is deployed at `http://localhost:33050`. Windows Node/Chrome ran ignored `.angular/branding-two-line-tooltips-check.cjs`. At **1200 px/light and dark**, both bubbles measure 384 px; at **390 px/dark**, both measure 354 px. DOM Range geometry confirms exactly **one description line plus one URL line** for each action at these sizes. At **320 px/light**, the clamped 284 px bubbles safely wrap the full description to two lines plus the URL rather than clipping or shrinking the text. Full wording, configured URLs, ARIA association and Escape dismissal passed; no page errors or API writes. Desktop Coffee and mobile Ways to support screenshots under `apps/web/.angular/stoneplan-two-line-tooltips-final/` were visually reviewed.

API/database container IDs and existing staged content are unchanged; HTTP health and the localhost-only `127.0.0.1:33050` binding passed. `git -c core.whitespace=cr-at-eol diff HEAD --check` and browser-helper syntax checks passed. Unit/API suites, CRUD/database-restart smoke and model calls were **not run** for this layout correction. No dependency, schema, staging, commit or push change. Suggested commit: `fix: fit support tooltip descriptions on one line`.
