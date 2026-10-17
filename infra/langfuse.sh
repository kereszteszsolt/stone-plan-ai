#!/bin/sh
# SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
# SPDX-License-Identifier: Apache-2.0

set -eu
cd "$(dirname "$0")/.."

compose() {
  docker compose --env-file .env -f compose.yaml -f infra/compose.langfuse.yaml "$@"
}

if [ ! -f .env ]; then
  printf '%s\n' 'Create .env from .env.example and configure the local credentials first.' >&2
  exit 1
fi

command_name="${1:-up}"
case "$command_name" in
  up)
    compose up -d --build --wait --wait-timeout 360
    # Refresh the static API upstream after container recreation.
    compose exec -T web nginx -s reload
    printf '%s\n' 'Task Flow AI and local Langfuse are ready. Dashboard: http://localhost:3000; login settings are in .env.'
    ;;
  down) compose down ;;
  ps) compose ps ;;
  logs) compose logs --tail 100 api langfuse-web langfuse-worker ;;
  off)
    LANGFUSE_ENABLED=false LANGFUSE_PUBLIC_KEY= LANGFUSE_SECRET_KEY= LANGFUSE_BASE_URL= \
      docker compose --env-file .env -f compose.yaml up -d --wait --wait-timeout 120
    docker compose --env-file .env -f compose.yaml exec -T web nginx -s reload
    compose stop langfuse-worker langfuse-web langfuse-db langfuse-clickhouse langfuse-redis langfuse-minio
    printf '%s\n' 'Tracing disabled and local Langfuse stopped. All project data and credentials retained.'
    ;;
  *) printf '%s\n' 'Usage: sh infra/langfuse.sh [up|down|off|ps|logs]' >&2; exit 2 ;;
esac
