# Release 0.1 verification

## Status

Release 0.1 is in progress. TFA-001–002's local stack, persistent task CRUD API, and Angular task screen have been checked. The AI planning, plan save, and completion flow remains pending TFA-003–004.

## Story evidence

| Story | Focused checks | Browser / model smoke | Status |
| --- | --- | --- | --- |
| TFA-001 | API/web builds, 3 HTTP tests, schema/migration checks | Native and Docker shell rendered; Compose health/persistence smoke passed; model smoke not applicable | Implemented |
| TFA-002 | Both builds; 37 backend HTTP tests and 10 Angular tests; live CRUD and cascade smoke | Browser create/edit/delete with reload; failed-save recovery; 320/390/1200 px and light/dark forms | Implemented |
| TFA-003 | Not run | Not run | Planned |
| TFA-004 | Not run | Not run | Planned |

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

The release closes after one successful end-to-end local demo: create task → generate Ollama plan → edit → save → mark complete → reload and verify persistence.

## Optional post-MVP story (not part of Release 0.1)

The row below is for tracking only. **TFA-005 does not block or change Release 0.1 completion.** Keep commands and detailed test results in the [TFA-005 story](../../stories/TFA-005-openrouter-provider-integration.md).

| Story | Focused checks | Live OpenRouter smoke | Status |
| --- | --- | --- | --- |
| [TFA-005](../../stories/TFA-005-openrouter-provider-integration.md) | Not run | Not run | Planned (optional) |

A live provider smoke test is optional and requires approved credentials; record it as **not run** if not authorized.
