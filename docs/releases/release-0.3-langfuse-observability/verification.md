# Release 0.3 verification

## Status and authorization

TFA-008 was explicitly requested for implementation on **2026-10-17**. The adapter was initially verified with mocks. The user then explicitly approved the project-integrated self-hosted Docker variant on the same date, including local runtime verification. Hosted/cloud trace export and paid model calls were not authorized or performed. The user subsequently authorized a commit conditional on review and confirming that real credentials are excluded; push was not requested.

| Story | Focused mock tests | Default-Ollama regression | Local / hosted Langfuse | Status |
| --- | --- | --- | --- | --- |
| [TFA-008](stories/TFA-008-optional-langfuse-tracing.md) | 32 passed (included in API suite) | Passed with mocks plus actual credential-free Docker startup; API suite 285/285 | Local SDK ingestion, persistence, dashboard passed; hosted Not run | Implemented; local verification |

Current local setup: Langfuse belongs to the `task-flow-ai` Compose project, all application/server/client settings are in the root `.env`, and `sh infra/langfuse.sh up` starts everything. This final choice supersedes the intermediate shared sibling deployment; the chronological records below document both migrations.

## Adapter implementation boundary

- Added the backend-only `LangfuseTracingService`, using `@langfuse/core`, `@langfuse/otel` and `@langfuse/tracing` **6.0.0** with OpenTelemetry API **1.9.1** and SDK/resources **2.12.0** in the lockfile.
- `PlanPreviewService` passes the existing safe call event to the adapter after its unchanged JSON log. Manual generations use a private tracer provider, empty root context, fixed resource/labels and an explicit metadata allowlist. No HTTP/database auto-instrumentation or global tracer registration.
- `LANGFUSE_ENABLED` defaults to false. Enabled configuration requires valid public/secret key shapes and an explicit HTTP(S) base URL without URL credentials/query/fragment. Invalid settings safely disable tracing. Secrets are also excluded if accidentally used as a model name.
- Recorded data: generated request/trace/span IDs, provider/model, timestamps/duration, outcome, fixed error category when applicable, and only reported numeric usage. Missing usage is unknown; no app-calculated totals/costs. Task content/IDs, prompts, responses, auth headers and raw errors are excluded.
- SDK debug/payload logging and media uploads are disabled. Export is batched, with a two-second network timeout. Recording exceptions do not alter a plan response. On Nest shutdown, explicit flush and shutdown are attempted separately so a failed batch does not skip exporter cleanup.
- Added only optional API environment variables to Compose and both env examples. The adapter did not alter frontend, provider HTTP adapters, application schema/migrations or persistence; the separately approved deployment extension is described below. Unit-test setup disables inherited remote telemetry configuration; the opt-in tests replace transport with a mock.
- README documents choosing the destination/region, backend credentials, locating a trace by `metadata.requestId`, private project access/public-sharing controls, retention/deletion, possible ingestion/storage costs and the restart-based off switch. The previous process can flush already-buffered data during shutdown; disabling does not delete remote history.

## Commands and results

Runtime: Linux Node **v24.18.0** from `/home/zsolti-wsl/.nvm/versions/node/v24.18.0/bin`; npm commands below run in `apps/api` unless noted.

| Command | Result |
| --- | --- |
| `npm run build` | Passed final implementation build: Prisma client generation and Nest compilation |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | Passed; includes test source types |
| `npm test` | Passed: **8 suites, 285 tests**, including **32 Langfuse tests**; 76.174 s |
| `docker compose --env-file .env.example config --services` (root) | Passed: exactly `db`, `api`, `web` |
| `docker compose --env-file .env.example config --format json` with a local JSON assertion (root) | Passed: only `postgres_data`; `AI_PROVIDER=ollama`; `LANGFUSE_ENABLED=false`; keys/base URL empty; no Langfuse environment in `web` |
| Dependency-map/SPDX assertions | Passed: package/lockfile root dependencies match; new handwritten sources have the required two-line headers |
| Modified Markdown local-link/new-source whitespace assertions | Passed: 35 local links resolve; new sources have no trailing whitespace |
| `git diff --check` (root) | Passed |

The restricted sandbox initially rejected npm DNS access (`EAI_AGAIN`) and local HTTP test binding (`listen EPERM: operation not permitted 127.0.0.1`). Dependency installation and the local mock HTTP tests were rerun with approved execution permissions. These were environment restrictions, not evidence of a live-provider check. During focused test development, the failed-export case exposed SDK cleanup being skipped after a rejected batch; separate flush/shutdown handling was added and tested.

## Mock evidence and limits

`test/langfuse.spec.ts` exercises real Langfuse generations, processing/filtering and batching with only the exporter transport replaced. It covers:

- Disabled mode with settings absent or keys present: zero exporter initialization/exports; health, task reads and the default Ollama preview remain usable.
- Enabled invalid/missing settings: fixed safe diagnostics; health/task reads/preview still succeed; no telemetry exporter.
- Successful Ollama/OpenRouter generations: exactly one selected model request, unchanged response and one existing JSON event; generated response correlation, SDK trace ID, matching duration, numeric usage including zero, and no inferred Ollama total.
- Missing usage, unavailable providers, timeout errors, invalid output and budget rejection: original status/code, safe failure category, preserved known usage and no saved subtasks or fallback/retry.
- Exclusion of task/prompt/response/header/key/error markers from exported attributes/events/links/resource and captured logs, even with SDK debug environment variables set. Langfuse environment/release overrides do not leak into fixed labels.
- Concurrent calls with separate trace IDs, request IDs and usage; startup/recording failures; deferred failed export after the API already returned; flush errors followed by exporter cleanup; shutdown rejection without raw-error disclosure.
- Health, task reads and saved-plan rejections do not emit generations. Prisma writes are asserted absent throughout the preview tests.

Example of the allowlisted observation fields (illustrative fixture values, **not a hosted trace**):

```json
{
  "name": "ai-plan-generation",
  "type": "generation",
  "model": "fixture:small",
  "metadata": {
    "requestId": "4206c355-753b-44ab-852b-818e538ff1cb",
    "provider": "ollama",
    "durationMs": 12,
    "outcome": "success",
    "usageStatus": "reported"
  },
  "usageDetails": { "input": 12, "output": 0 }
}
```

A failed observation uses the fixed category in `metadata.errorCategory` and its status message, for example `OLLAMA_TIMEOUT`; missing usage has `usageStatus: "unknown"` and no usage counts. Actual SDK trace/span IDs are generated independently; `requestId` correlates with `X-Request-ID` and local logs.

| External/runtime check | Result |
| --- | --- |
| Hosted/cloud Langfuse endpoint, project access, ingestion and dashboard screenshot | **Not run** — no hosted endpoint/data-transmission authorization |
| Live OpenRouter generation | **Not run** — no paid-call authorization |
| Live Ollama generation | **Not run** — default-provider behavior verified with mocks |
| Default three-service Compose build/start | **Passed** in isolated `task-flow-ai-tfa008-check`; empty Langfuse credentials, Ollama selection, website/Nginx health proxy and task create/read/update/delete verified |
| Angular application UI smoke | **Not run** — no Angular changes; separate local Langfuse dashboard browser check passed below |

The earlier mock tests alone do not prove real OTLP authentication/serialization or dashboard presentation; the separately authorized local Docker checks below cover actual SDK transport and ingestion. Hosted-cloud access/retention remains unverified. This release adds metadata-only LLM observations, not full distributed tracing or answer-quality evaluation. Release 0.1/0.2 history remains unchanged.


## Approved self-hosted Docker extension (2026-10-17)

Scope: `infra/compose.langfuse.yaml`, `infra/langfuse.sh`, `apps/api/test/langfuse-smoke.cjs`, the root env example and current Release 0.3/architecture/workflow documentation. The earlier adapter implementation and its 285 passing API tests are unchanged; no redundant API suite rerun was needed for this deployment-only extension. Docker rebuilt the API successfully from the current package lock/source (Prisma generation, Nest build, production dependency pruning); the unchanged web build reused its existing cache.

Configuration: six optional services, five dedicated Langfuse volumes plus the independent app PostgreSQL volume, a private storage network and a separate dashboard bridge. Only Langfuse Web publishes a loopback port. Web/Worker are Langfuse **4.63.0**; both and the new ClickHouse/Redis/MinIO images are pinned by digest. `HOSTNAME=0.0.0.0` makes image healthchecks reachable inside their containers. The worker waits for the web service's migrations/health before startup. The helper reloads Nginx after the API is recreated so its upstream address is refreshed.

The local secrets file is ignored by Git and both Docker build contexts. Initializer syntax, 64-character hexadecimal secret formats (32 random bytes per value), no credential output and byte-identical reuse were verified. The application provider is not changed by the overlay. Langfuse deployment telemetry and the in-app AI agent are disabled; the web service can still check upstream releases, and browser assets can make external requests. No air-gap claim is made.

All runtime checks used a distinct Compose project (`task-flow-ai-tfa008-check`), app port **18080**, dashboard port **13000**, its own named volumes and the generated `.env.langfuse` credentials. The user's existing application database volumes and unrelated running Compose projects were not changed.

Commands (all from the repository root; execution permission was approved for Docker socket access):

```sh
# Original stack, rebuilt without Langfuse credentials:
AI_PROVIDER=ollama LANGFUSE_ENABLED=false LANGFUSE_PUBLIC_KEY= \
LANGFUSE_SECRET_KEY= LANGFUSE_BASE_URL= WEB_PORT=18080 \
docker compose -p task-flow-ai-tfa008-check --env-file .env.example \
  -f compose.yaml up -d --build --wait --wait-timeout 180

# Local helper up/off/down/restart checks all used these same safe test overrides:
COMPOSE_PROJECT_NAME=task-flow-ai-tfa008-check WEB_PORT=18080 \
TFA_LANGFUSE_PORT=13000 AI_PROVIDER=ollama \
POSTGRES_PASSWORD=replace-with-local-demo-password POSTGRES_USER=taskflow POSTGRES_DB=taskflow \
sh infra/langfuse.sh up

# Real SDK transport, local authenticated readback, deterministic model fixture:
docker compose -p task-flow-ai-tfa008-check \
  --env-file .env.example --env-file .env.langfuse \
  -f compose.yaml -f infra/compose.langfuse.yaml exec -T api node \
  < apps/api/test/langfuse-smoke.cjs
```

Actual exported fixture record: request ID `da472c75-0d6e-4be3-b14a-64265b753b5d`, SDK trace ID `95e6f1ec02d69ab9b3d5944900276762`, provider `ollama`, model `fixture:local`, duration **37 ms**, success, reported input/output tokens **12/7**. Exactly one model-fixture request occurred, with no real LLM call or app database writes. The actual SDK OTLP HTTP transport sent to `http://langfuse-web:3000`; authenticated **Observations API v2** readback verified the stored generation and absence of task/reply/key markers and input/output bodies. The local v4 server no longer serves the old observations read endpoint, so the smoke uses `/api/public/v2/observations` with a bounded time range and explicit metadata/model/usage/I/O fields.

The same request/trace was read back after `off`, `down` and `up` recreated all containers/networks while preserving volumes. Verification-only execution used `exec -T -e TFA_LANGFUSE_SMOKE_REQUEST_ID=da472c75-0d6e-4be3-b14a-64265b753b5d api node < apps/api/test/langfuse-smoke.cjs` and reported `modelCalls: 0`, `persisted: true`, `metadataOnly: true`.

The `off` helper successfully recreated the API with `LANGFUSE_ENABLED=false`, empty keys/destination and a working Nginx `/api/health` response. Only `api`, `web`, `db` remained running; optional services were stopped, and all credentials/volumes remained intact. A later fresh `up` reused the credentials and restored the local record.

Dashboard browser check: **Passed** with local Windows Node v24.18.0, installed Chrome and the existing Playwright Core. The generated administrator signed in successfully after the container recreation; the local project's Tracing list displayed both stored `ai-plan-generation` observations, with empty input/output. External browser requests were blocked in this check. Screenshot: `test-results/langfuse-local-dashboard.png` (ignored local artifact; visually inspected). No application prompt/key contents appear in it.

Final configuration/source checks: both Compose variants parsed and passed service/network/loopback/provider/key-boundary assertions; the base still has exactly three services and one volume. New shell/CJS syntax, required source notices, ignored secrets, Markdown local links and whitespace were checked. The final combined stack had all nine services running, all eight configured healthchecks passing, and the actual dashboard binding was `127.0.0.1:13000`.

Cleanup removed only this newly created test project's containers, networks and fixture-only volumes with `docker compose -p task-flow-ai-tfa008-check ... down --volumes`. The generated ignored `.env.langfuse`, screenshots and pinned images were retained for normal local use. No normal application stack was deployed or stopped. Start the requested variant normally with `sh infra/langfuse.sh up` (default app/dashboard ports 8080/3000); its data belongs to the normal project's own volumes.

Commit/push: **Not performed**; separate user approval is still required.

## Normal project restart (2026-10-17)

The user separately requested a Docker restart after approving the integrated local Langfuse variant. The normal `task-flow-ai` project was rebuilt and recreated from this checkout with the existing `.env`, unchanged `.env.langfuse` and existing `task-flow-ai_postgres_data` volume:

```sh
docker compose --env-file .env --env-file .env.langfuse \
  -f compose.yaml -f infra/compose.langfuse.yaml \
  up -d --build --force-recreate --wait --wait-timeout 360
docker compose --env-file .env --env-file .env.langfuse \
  -f compose.yaml -f infra/compose.langfuse.yaml exec -T web nginx -s reload
```

Result: all nine services running; all eight configured healthchecks healthy. Actual host HTTP requests passed for the Angular page at `http://127.0.0.1:8080/`, Nginx `/api/health` (`status: ok`), `/api/tasks`, Langfuse `/api/public/health` (`status: OK`, version `4.63.0`) and `/auth/sign-in` at `http://127.0.0.1:3000`. The five existing tasks had identical canonical JSON SHA-256 values before and after recreation; no task contents were printed. Langfuse's five normal-project volumes were newly created, while the existing application database volume was retained.

Runtime API settings confirm the user's existing explicit `openrouter` selection was preserved, tracing is enabled, both keys are present and the destination is the bundled `http://langfuse-web:3000`. No real model request or paid cloud call was made during this restart. No volumes were deleted, and unrelated Compose projects were not changed. Commit/push: **Not performed**.


## Shared Langfuse extraction (2026-10-17)

The user subsequently requested an independent sibling deployment reusable by multiple projects. This supersedes the integrated stack's current ownership/lifecycle instructions above; those earlier results remain historical evidence.

Created `/mnt/c/P/ghpub/www-temp/langfuse/` with `compose.yaml`, `.env`, `task-flow-ai.env`, secret-free `.env.example` / `task-flow-ai.env.example`, `.gitignore` and `README.md`. The server is a separate Compose project named `langfuse`. Its six services retain the pinned images, original administrator/project keys, encryption key, salt and storage credentials. Every legacy server setting/credential was compared for equality after renaming its variable; only then was the obsolete app-local `.env.langfuse` removed. The app's existing `.env` and explicit OpenRouter selection were not changed.

All five existing `task-flow-ai_langfuse_*` volumes are reused as external volumes, with their historical names retained to avoid copying/resetting data. They are no longer declared by the app. After graceful API/worker/web/storage shutdown, only the six old Langfuse containers were removed, without volume removal. The separate server was started with:

```sh
cd ../langfuse
docker compose up -d --wait --wait-timeout 360
cd ../task-flow-ai
sh infra/langfuse.sh up
```

The app overlay now contains only the API's external-network attachment. `langfuse_clients` is managed by the separate server, with Web alias `langfuse`; client destination is `http://langfuse:3000`. Storage and worker remain on the private internal network. Only Web publishes `127.0.0.1:3000`. Actual API network inspection confirmed exactly `task-flow-ai_default` and `langfuse_clients`, with no storage-network access. The two unused legacy Langfuse networks were inspected for zero attached containers and removed; no volumes were deleted.

Results:

- Server/app Compose configuration assertions passed: separate six-service/five-external-volume server and three-service/one-volume application; default env template still selects Ollama, disables tracing and requires no Langfuse credentials.
- All six shared services are running and healthy. The app has only `web`, `api`, `db`, all running, with API/DB healthchecks passing.
- Real host HTTP checks passed: Angular root at port 8080, Nginx `/api/health`, `/api/tasks`, Langfuse `/api/public/health` (4.63.0) and `/auth/sign-in` at port 3000.
- The **six** tasks present at the start of this extraction had the same canonical JSON SHA-256 after migration. The one existing observation captured before migration was readable afterward with its unchanged project key. No task/observation contents or credentials were printed.
- Actual SDK export/readback over the new shared network passed using the deterministic fixture: request ID `616c6ba2-b599-4074-996f-afabdb7fbbd7`, trace ID `60c5b885a7305cef228829ca17f55524`, model `fixture:local`, provider `ollama`, duration 11 ms, reported tokens 12/7. Stored generation input/output were empty and private task/reply/key markers absent. No live model or app database write occurred.
- `sh infra/langfuse.sh off` recreated only the application API with tracing false and empty keys/destination. All six shared services remained healthy and both host health URLs returned 200. `sh infra/langfuse.sh up` then restored tracing without controlling the server. Verification-only smoke read the same new fixture back with `modelCalls: 0`.
- Shell syntax and whitespace checks passed. Docker reused the unchanged application source build cache. The API production adapter and 285-test mock suite were unchanged, so no redundant full-suite rerun was needed. The local smoke's destination assertion was updated to the new shared address.

The separate README explains independent lifecycle, existing volumes/admin login, and separate project keys/client env files for other apps. No extra application/project was provisioned, backup automation configured, live model or hosted Langfuse smoke call made, Git repository initialized, commit or push performed. A fresh browser-login screenshot was not repeated for this configuration move; earlier browser evidence above belongs to the original integrated setup, while this move verified the sign-in HTTP page, authenticated API access and persisted data.

Suggested repository commit message: `chore: connect Task Flow AI to shared local Langfuse`.


## Final project-owned deployment, one env file (2026-10-17)

The user requested simpler operation and explicitly returned Langfuse to this project. Current files are `infra/compose.langfuse.yaml`, `infra/langfuse.sh` and the single ignored root `.env`. The env example lists the optional server settings. Existing server/client credentials were consolidated without regeneration; project public/secret keys are shared by the API and local headless initializer rather than duplicated in separate files. Non-Langfuse app settings, including the explicit OpenRouter selection, were preserved.

Before migration, snapshots captured six existing tasks and two existing observations without printing their contents. The API was gracefully stopped and its stateless container removed to detach the old shared network. `docker compose down` in the former sibling deployment removed its six containers and two networks without deleting volumes. The five original Langfuse volumes were verified to retain `task-flow-ai` ownership labels, then reattached as managed volumes in the combined project. No data copying, schema migration or volume deletion occurred.

```sh
# From the application repository; only this .env is needed:
sh infra/langfuse.sh up

# Actual SDK transport with a deterministic model fixture:
docker compose --env-file .env -f compose.yaml -f infra/compose.langfuse.yaml \
  exec -T api node < apps/api/test/langfuse-smoke.cjs

# Combined off/on verification, retaining all data:
sh infra/langfuse.sh off
sh infra/langfuse.sh up
```

All nine services started in `task-flow-ai`, with eight configured healthchecks passing. Real host requests passed for Angular on port 8080, Nginx `/api/health`, `/api/tasks`, Langfuse health (4.63.0) and the sign-in page on port 3000. The six tasks had identical canonical JSON SHA-256 before/after migration; both earlier observation IDs remained readable with the original project key.

Local SDK export/readback passed: request ID `2cefd836-5bc3-4ef0-9177-5c2be9c48dc0`, trace ID `bc5d64a28de2921043debee4ac008ec4`, provider `ollama`, model `fixture:local`, duration 12 ms, reported tokens 12/7. Stored input/output were empty and private task/reply/key markers absent. This used one deterministic model fixture call, with no real model or app database write.

The `off` helper left exactly `web`, `api`, `db` running and stopped all six Langfuse services. The API had tracing false, empty keys/destination, unchanged OpenRouter selection and a working Nginx health proxy. The base-only Compose phase emitted the expected optional-service orphan warning; the helper then explicitly stopped those services without removing volumes. The final `up` restored the combined deployment from the root env after the sibling folder had been removed. Final checks confirmed nine running services/eight passing healthchecks, unchanged task data, no old standalone containers, and verification-only readback of the same new observation with `modelCalls: 0`.

The obsolete sibling folder's exact seven generated files were checked against their pre-migration hashes. Every server credential was also compared with its value in the root `.env` before those unchanged files and the folder were removed. No unrelated files were deleted. Current documentation and the story describe only the final project-owned workflow; earlier release verification remains historical evidence.

Focused checks: combined Compose has nine services/six project-owned volumes and no external networks; the API uses the project-local dashboard bridge rather than the private storage network. Base env-template configuration still has three services/one app volume, Ollama default, disabled tracing and empty keys/destination. Shell/CJS syntax, local Markdown links and whitespace checks passed. The production API adapter did not change; application builds reused the verified source cache, so the unchanged 285-test suite was not rerun. No fresh browser screenshot, live provider call or hosted Langfuse smoke was run.

Suggested commit message: `chore: consolidate local Langfuse in the project`. Commit/push: **Not performed**.


## Commit review and credential audit (2026-10-17)

The user authorized committing after review and credential checks. Reviewed the complete implementation/deployment/doc changes on `dev_r0.3`, including the existing unstaged changes and six new files; the index was initially empty. All changes belong to TFA-008. Earlier release evidence and the Angular implementation remain unchanged.

- Focused privacy/adapter rerun: `npm test -- --runTestsByPath test/langfuse.spec.ts` in `apps/api` passed **32/32 tests** in **25.921 s**. Model HTTP and telemetry transport were mocked; no live model call occurred. The earlier complete **285/285** API result and Docker builds remain recorded above; the unchanged full suite was not repeated.
- Redacted source audit covered **106** tracked/reviewable files, comparing **11** configured credential values, URL/base64 encodings and the local Langfuse Basic-auth encoding, plus credential-shaped literals/private-key headers. **Zero findings**. The documented demo-password placeholder and deliberate short fake test credentials are not real secret findings.
- Only secret-free `.env.example` templates are tracked. The real `.env`, generated files and local screenshots are ignored. Both Docker build contexts exclude `.env` and `.env.*`; Dockerfiles copy only named source/build inputs.
- Runtime audit inspected all **four** frontend files, frontend container environment, image configurations, recent API logs and **three** authenticated local observations: no configured credential values were found. Frontend has no provider/tracing environment settings; all observation input/output bodies were empty. Audits printed only counts and safe metadata, never secrets or task contents.
- The current local stack still has **nine** running services and **eight** passing healthchecks. Package-lock root dependencies match `package.json`; the 15 added lockfile packages are confined to Langfuse/OpenTelemetry, with no unrelated dependency changes/removals.

Commit contents are checked again from the actual Git index before committing. The real `.env` remains local. Commit message: `feat: add optional Langfuse tracing and local Docker stack`. No push is part of this authorization.
