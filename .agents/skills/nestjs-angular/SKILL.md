---
name: nestjs-angular
description: Use for Task Flow AI changes in NestJS REST endpoints, Angular components and Signals, Prisma/PostgreSQL persistence, Nginx or Docker Compose.
---

# NestJS / Angular delivery

## When to load

Use only for an approved story changing `apps/api` controllers/services or Prisma, `apps/web`, or `infra`/Compose. Provider-only changes belong to `llm-provider-integration`.

## Technical workflow

1. Inspect the affected controller/service, Zod schema, Angular API service and related tests; avoid unrelated modules.
2. Trace the contract from Angular's typed `/api` client through NestJS validation to the service and Prisma transaction.
3. Keep HTTP routes thin, scheduling deterministic and persistent writes explicit. Preserve validation and concurrency handling in the backend.
4. Keep Angular local state in existing Signals/components; distinguish editable transient previews from persisted results. Preserve error/retry behavior.
5. Preserve Nginx same-origin `/api`, internal Compose service names and one PostgreSQL volume. Do not add Nx, new services or a second app-wide state framework.

## Focused checks

Run `npm test` and/or `npm run build` only in changed `apps/api` or `apps/web` first. Add `npm run prisma:validate`, Compose config or `sh infra/smoke.sh` when schema/deployment behavior changes and the user approved stateful smoke tests. Record actual results in the active release `verification.md`.
