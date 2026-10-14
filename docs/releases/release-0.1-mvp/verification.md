# Release 0.1 verification

## Status

Release 0.1 is in progress. TFA-001's API, Angular shell, PostgreSQL/Prisma foundation, and local stack have been checked. The task/AI end-to-end demo remains pending TFA-002–004.

## Story evidence

| Story | Focused checks | Browser / model smoke | Status |
| --- | --- | --- | --- |
| TFA-001 | API/web builds, 3 HTTP tests, schema/migration checks | Native and Docker shell rendered; Compose health/persistence smoke passed; model smoke not applicable | Implemented |
| TFA-002 | Not run | Not run | Planned |
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

The release closes after one successful end-to-end local demo: create task → generate Ollama plan → edit → save → mark complete → reload and verify persistence.

## Optional post-MVP story (not part of Release 0.1)

The row below is for tracking only. **TFA-005 does not block or change Release 0.1 completion.** Keep commands and detailed test results in the [TFA-005 story](../../stories/TFA-005-openrouter-provider-integration.md).

| Story | Focused checks | Live OpenRouter smoke | Status |
| --- | --- | --- | --- |
| [TFA-005](../../stories/TFA-005-openrouter-provider-integration.md) | Not run | Not run | Planned (optional) |

A live provider smoke test is optional and requires approved credentials; record it as **not run** if not authorized.
