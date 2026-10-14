#!/bin/sh
# SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
# SPDX-License-Identifier: Apache-2.0

set -eu
cd "$(dirname "$0")/.."
web_url="${TASK_FLOW_SMOKE_URL:-http://localhost:8080}"

health="$(curl --fail --silent --show-error "$web_url/api/health")"
[ "$health" = '{"status":"ok"}' ]
curl --fail --silent --show-error "$web_url/" | grep -q '<app-root>'
curl --fail --silent --show-error "$web_url/api/tasks" | docker compose exec -T api node -e \
  'const list=JSON.parse(require("node:fs").readFileSync(0,"utf8")); if(!Array.isArray(list)) process.exit(1)'
docker compose exec -T api npm run prisma:status
docker compose exec -T api node < apps/api/test/tasks-smoke.cjs

fixture_id="$(docker compose exec -T api node -e 'process.stdout.write(require("node:crypto").randomUUID())')"
cleanup() {
  docker compose exec -T -e SMOKE_TASK_ID="$fixture_id" -e SMOKE_PHASE=cleanup api node \
    < apps/api/test/database-smoke.cjs
}
trap cleanup EXIT
docker compose exec -T -e SMOKE_TASK_ID="$fixture_id" -e SMOKE_PHASE=create api node \
  < apps/api/test/database-smoke.cjs
docker compose restart db
docker compose up -d --wait db
docker compose exec -T -e SMOKE_TASK_ID="$fixture_id" -e SMOKE_PHASE=verify api node \
  < apps/api/test/database-smoke.cjs
health="$(curl --fail --silent --show-error "$web_url/api/health")"
[ "$health" = '{"status":"ok"}' ]
printf '%s\n' 'Compose website, /api proxy, migration and persistence smoke: passed'
