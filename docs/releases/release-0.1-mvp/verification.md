# Release 0.1 verification

## Status

Release 0.1 MVP is implemented and locally verified. All four stories and the complete Docker UI flow passed, including accepted plans and completion retained after page reload and full Compose stop/start.

## Story evidence

| Story | Focused checks | Browser / model smoke | Status |
| --- | --- | --- | --- |
| TFA-001 | API/web builds, 3 HTTP tests, schema/migration checks | Native and Docker shell rendered; Compose health/persistence smoke passed; model smoke not applicable | Implemented |
| TFA-002 | Both builds; 37 backend HTTP tests and 10 Angular tests; live CRUD and cascade smoke | Browser create/edit/delete with reload; failed-save recovery; 320/390/1200 px and light/dark forms | Implemented |
| TFA-003 | Both builds; 79 backend tests, including 42 fixed-response/scheduling/preview tests; 21 Angular tests | Real host Ollama through Docker web/API; editable unsaved preview and responsive/error-state smoke | Implemented |
| TFA-004 | Both builds; 115 backend tests, including 36 acceptance/progress tests; 33 Angular tests; real PostgreSQL concurrency checks | Complete real-model Docker UI flow, edited plan acceptance/completion, reload and full Compose stop/start preservation | Implemented |

Record only actual commands, relevant results, and blockers after implementation. Mark a story `Implemented` only when its acceptance criteria are checked and supported by evidence.

## TFA-001 evidence — 2026-10-14

Checked on WSL with Node.js 24.18.0, npm 11.16.0, Docker 29.6.1, and Compose 5.3.0. Applications have separate lock files. Docker builds use `npm ci`.

| Location | Command | Result |
| --- | --- | --- |
| `apps/api` | `npm run prisma:validate` | Schema valid; only Task and Subtask business models |
| `apps/api` | `npm run build` | Strict TypeScript build and Prisma client generation passed |
| `apps/api` | `npm test` | 1 suite, 3 tests passed: health JSON contract, required `/api` prefix, absent task endpoint |
| `apps/api` | `npm audit --omit=dev` | 0 runtime dependency vulnerabilities after the scoped Prisma CLI dependency overrides |
| `apps/api` | `npm run prisma:migrate` | Native connection to localhost PostgreSQL; no pending migrations |
| `apps/api` | `npm run start:dev` | Watch compilation had 0 errors; native NestJS started at port 3000 |
| `apps/web` | `npm run build` | Angular production build passed; initial bundle 93.19 kB |
| `apps/web` | `npm start -- --host 127.0.0.1` | Native Angular dev server started on port 4200 |
| Root | `docker compose config --quiet` | Compose configuration valid |
| Root | `OLLAMA_BASE_URL=http://host.docker.internal:1 docker compose up --build -d --wait` | API/web images built; all three services started with an unreachable Ollama URL |
| Root | `docker compose exec -T web nginx -t` | Configuration syntax valid |
| Root | `docker compose exec -T api npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | Exit 0; no difference between migrated PostgreSQL and the schema |
| Root | `sh infra/smoke.sh` | Website, proxied health, migration status, Prisma defaults, unique order, foreign key, restart persistence, and cascading deletion passed; temporary task cleaned up |

Live HTTP assertions passed for `http://localhost:3000/api/health` and `http://localhost:4200/api/health`, both returning status 200 and `{"status":"ok"}`. The second URL exercises Angular's development proxy. The Compose smoke checks the same contract through Nginx at `http://localhost:8080/api/health`.

Headless Chrome DOM checks passed at ports 8080 and 4200: Angular rendered `<h1>Task Flow AI</h1>` and its tagline. These were live local browser checks, not screenshot or hosted deployment evidence. The browser used cached `chrome-headless-shell` with temporary local shared libraries, `--dump-dom --timeout=5000 --virtual-time-budget=2000`.

The optional `infra/compose.dev.yaml` database port was used for the native checks. The final demo uses the regular Compose file: one default network, one named PostgreSQL volume, and only the web port published to `127.0.0.1:8080`. Local `.env` files and generated Prisma source are ignored. Hand-written source SPDX headers, shell syntax, local Markdown links, and diff whitespace were checked.

`docker compose up --build -d --wait` also passed when returning from the native development override to the regular demo. A temporary Prisma task/subtask survived the database container recreation, then was verified and deleted with its children. This additionally checks persistence beyond a process restart.

Jest uses Node's experimental VM modules to load NestJS 12's ESM dependencies; its experimental warning does not indicate a failed test. The Prisma CLI's `deepmerge-ts` and `mysql2` overrides are covered by configuration validation, migration deployment/status, and the live database smoke.

No AI request, model smoke, task CRUD UI, CI run, or full MVP end-to-end flow is claimed in TFA-001.

## TFA-002 evidence — 2026-10-14

Uses the same WSL/Node/Docker environment as TFA-001. No Prisma schema or migration changed. The old task-endpoint absence test was replaced by CRUD boundary tests; health contract/prefix coverage remains.

| Location | Command | Result |
| --- | --- | --- |
| `apps/api` | `npm run build` | Strict TypeScript build and Prisma generation passed |
| `apps/api` | `npm test` | 2 suites, 37 HTTP tests passed: CRUD contracts, text normalization, bounds/types, unknown fields, partial updates, 400/404/409 responses, and concurrent deletion mapping |
| `apps/web` | `npm run build` | Angular production build passed; initial bundle 225.57 kB |
| `apps/web` | `npm test` | 1 file, 10 Angular/Vitest tests passed: loading/empty/error states, validation, typed HTTP requests, failed-save draft retention, update/delete, and stale detail response rejection |
| Root | `docker compose up --build -d --wait` | Updated API/web images built and the local demo started |
| Root | `sh infra/smoke.sh` | Live task create/list/read/patch/delete, persisted edits, invalid update rejection without data changes, real HTTP cascade deletion, and database restart persistence passed; fixtures removed |
| `apps/web` | `CHROME_EXECUTABLE=… LD_LIBRARY_PATH=… npm run test:smoke` | Live Angular CRUD/reload, failed-save recovery, deletion confirmation/cancel, list failure/retry, and responsive theme checks passed; no page JavaScript errors; fixture removed |

The HTTP tests need permission to bind an ephemeral localhost server. Their first sandboxed invocation failed with `listen EPERM`; rerunning with local-network access passed. Two Angular assertions initially read before their async state/render update; waiting for the promise continuation corrected the tests. A browser form assertion likewise needed to wait for the form to render before counting fields. No targeted test failure remains.

The standalone browser smoke ran after the database smoke. It created a task through the real UI, verified create and edit after reloads, forced a 503 on an edit and confirmed the draft and persisted data stayed intact, retried successfully, cancelled a deletion, then deleted and reloaded to confirm absence. A failed list request was shown with a working retry. It never uses a mock successful CRUD response.

Browser checks covered 1200 px/light, 390 px/dark, and 320 px/light. All four form fields were present and horizontal document overflow checks passed. Local screenshots were captured to `/tmp/task-flow-ai-tfa002-KwpBOk/`; the desktop light and mobile dark images were visually inspected. These are local browser artifacts, not committed assets or hosted deployment evidence. Chrome used the cached headless-shell executable and temporary shared libraries described in TFA-001.

README launch/check instructions and REST/input documentation were updated. The regular Compose stack remains active at `http://localhost:8080`; API and database ports remain unpublished. There are no AI requests or plan/completion controls in TFA-002, and Release 0.1 is still incomplete.

## TFA-003 evidence — 2026-10-14

Uses the existing Node.js 24.18.0/npm 11.16.0/Docker 29.6.1/Compose 5.3.0 environment and the existing external local Ollama server. No new dependency, migration, model installation or Ollama Compose service was needed.

| Location | Command | Result |
| --- | --- | --- |
| `apps/api` | `npm run build` | Strict TypeScript build and Prisma generation passed |
| `apps/api` | `npm test` | 3 suites, 79 tests passed, including prompt escaping, contextual JSON schema, output bounds/types, malformed/truncated/oversized replies, timeout/offline/configuration errors, deterministic packing, and read-only preview HTTP contracts |
| `apps/api` | `npm test -- --runTestsByPath test/plan.spec.ts` | 42 focused tests passed after tightening the daily-limit schema and prompt; final full suite also passed |
| `apps/web` | `npm run build` | Angular production build passed; initial bundle 236.64 kB |
| `apps/web` | `npm test` | 2 files, 21 tests passed: CRUD plus explicit/duplicate generation, native editing, no save requests, retryable failures, draft retention, discard, stale task response rejection and HTTP cancellation |
| Root | `docker compose up --build -d --wait` | API/web rebuilt and started with the configured external model and timeout; three services only |
| Root | `sh infra/smoke.sh` | Existing task CRUD, HTTP cascade, Nginx proxy and database restart persistence passed before the model browser check |
| `apps/web` | `CHROME_EXECUTABLE=… LD_LIBRARY_PATH=… npm run test:preview-smoke` | Real model preview through browser/Nginx/API, unsaved editing and reload discard, four controlled failure responses and 1200/390/320 px theme checks passed |

Host `/api/tags` and an API-container probe confirmed the already installed `qwen3:0.6b` was reachable at `http://host.docker.internal:11434`. Only the ignored root/native `.env` model placeholders were changed to that installed model. The real smoke returned status 200 with **3 steps and 90 minutes**, stable 0-based order and 1-based days, and no daily total above 60 minutes for its 3-day task. The test made one real generation in its successful run; its four later offline/invalid-output/budget/timeout UI responses were controlled browser fixtures, not additional real inference calls.

The first real attempt returned 422 because a step exceeded the daily budget. The backend rejected it without storing a plan. The provider request now embeds the actual daily maximum in both JSON schema and prompt; backend validation/scheduling remains authoritative and was not relaxed. The successful rerun confirmed generation, edited title/estimate values, unchanged `updatedAt`, empty persisted `subtasks`, and no plan-save request. The test deleted only its own task; existing user tasks were preserved.

Light desktop (1200 px), dark mobile (390 px), and light narrow mobile (320 px) previews had every title/estimate input present and no horizontal document overflow. Live screenshots were captured under `/tmp/task-flow-ai-tfa003-I1a2w1/`; desktop/light and mobile/dark images were visually inspected. Chrome reported no page JavaScript errors. These are temporary local browser artifacts, not hosted deployment evidence or committed assets.

README documents native/container URLs, installed-model selection, timeout bounds, the host-gateway probe and private-interface Linux guidance. Nginx's 130-second read timeout exceeds the maximum 120-second provider timeout. The local Ollama server's configuration was left unchanged; the API model client has no automatic cloud fallback or response repair. Generation remains explicit and read-only. At TFA-003 delivery, plan saving/completion and the full MVP end-to-end flow were still pending TFA-004.

## TFA-004 evidence — 2026-10-14

Uses the existing WSL/Node.js 24.18.0/npm 11.16.0/Docker/Compose environment. No business entity, Prisma schema/migration, dependency or Ollama installation changed.

| Location | Command | Result |
| --- | --- | --- |
| `apps/api` | `npm run build` | Strict TypeScript build and Prisma client generation passed |
| `apps/api` | `npm test` | 4 suites, 115 tests passed; 36 new acceptance/progress cases cover strict edited inputs, day recalculation, budget/duplicate conflicts, transaction placement, completion set/unset, missing/deleted rows, and list/detail progress |
| `apps/web` | `npm run build` | Angular production build passed, including the final singular/plural label correction; initial bundle 244.39 kB |
| `apps/web` | `npm test` | 2 files, 33 tests passed, including explicit confirmation/cancellation, edited-only save payload, duplicate-request guard, failed-save draft retention, daily saved view, completion failure/set/unset and fixed budget controls |
| Root | `docker compose up --build -d --wait` | Updated API/web images built and the three-service demo started |
| Root | `docker compose up --build -d --wait web` | Final web label correction rebuilt and served successfully |
| Root | `sh infra/smoke.sh` | Website/proxy/migration/CRUD checks, real concurrent plan-save and budget-edit protection, completion set/unset/idempotency, title edits preserving plans, cascade deletion and database restart passed |
| Root | `docker compose up -d --wait` | Applied only the ignored root `.env`'s `OLLAMA_TIMEOUT_MS=120000`, retaining the existing selected model and all other settings |
| `apps/web` | `CHROME_EXECUTABLE=… LD_LIBRARY_PATH=… npm run test:mvp-smoke` | Real Docker UI create → generate → edit → confirm → save → complete → reload passed; full stack stop/start retained the same accepted steps and completion |

Two simultaneous acceptance requests to the same real PostgreSQL task returned 201 and 409 and left exactly 3 ordered steps. Four simultaneous budget-edit/save checks accepted either the new budget with a rejected plan (200/422), or the plan with a rejected budget change (409/201); none left a plan outside its stored budget. Completion was explicitly set true twice and false once, with matching persisted progress. Invalid/day-assigned input and oversized estimates left no saved steps. Temporary API fixtures were deleted by ID; pre-existing user tasks were preserved.

The browser driver created its task through the real UI and used the current external `qwen3.5:9b` model. Its first call reached the 60-second default and returned `OLLAMA_TIMEOUT` (504), with no plan written. The ignored local API timeout was then raised to the supported 120-second maximum; the next full flow passed with one real generation in that run. The selected model and external server configuration were retained; no cloud fallback or automatic model switching occurred.

The successful flow produced **4 steps**. The driver edited the first title and all four estimates to 1 minute before confirming, so the accepted schedule had all steps on day 1. A cancelled confirmation made no save request. One controlled failed-save response preserved the edited draft; a real retry returned 201. One controlled failed-completion response kept the prior checkbox state; a real retry saved one completed step and **25% progress**. Editing the task description after acceptance kept its saved steps/progress and exposed disabled time-budget fields.

Page reload and `docker compose stop` followed by `docker compose up -d --wait` preserved the same task, accepted step IDs/fields, completion flags and progress. The PostgreSQL volume was retained. The browser removed only its own task after verification. Chrome reported no page JavaScript errors.

Saved-plan screenshots at 1200 px/light, 390 px/dark and 320 px/light were captured under `/tmp/task-flow-ai-tfa004-lExGvX/`; every checkbox remained present and there was no horizontal document overflow. Desktop/light and mobile/dark were visually inspected; a final small singular/plural minute-label correction followed that review. Screenshots are temporary local artifacts. README documents explicit acceptance, locked saved budgets, count-based progress, offline Ollama recovery, slow-model timeout configuration and the stack-restarting smoke command.

One initial Angular save test accidentally exceeded its fixture's 60-minute total; the UI correctly blocked confirmation. Correcting that test estimate yielded the final 33/33 result. No targeted test failure remains. This closes the required Release 0.1 local demo flow; optional TFA-005 remains Planned and separate.

## Post-MVP planning note (does not change Release 0.1 proof)

At Release 0.1 closeout, TFA-005 was a standalone, optional planned story. It has since been assigned to [planned Release 0.2](../release-0.2-ai-provider-observability/README.md) alongside TFA-006. Their future results belong to [Release 0.2 verification](../release-0.2-ai-provider-observability/verification.md); neither is implemented yet or changes the completed MVP evidence above.
