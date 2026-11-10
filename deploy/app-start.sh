#!/bin/bash
# One container, two servers:
#   :3000  varlock-validated Bun API
#   :3001  Next.js server
# Point the Dokploy domains at those ports (see Dockerfile header).
# APPROOT = repo root: works in the container (/app) and locally.
set -e
APPROOT="$(cd "$(dirname "$0")" && cd .. && pwd)"
cd "$APPROOT"

pnpm --filter @Alumni-Network/db db:migrate:deploy

# Optional: creates ADMIN_EMAILS' first address and keeps its password equal to
# ADMIN_PASSWORD. No-op when ADMIN_PASSWORD is unset.
bun run "$APPROOT/packages/auth/scripts/seed-admin.ts"

cd apps/server
PORT=3000 bun run dist/index.mjs &
API_PID=$!

cd "$APPROOT/apps/web"
node node_modules/next/dist/bin/next start -p 3001 &
WEB_PID=$!

# wait -n returns as soon as ANY server exits; if one dies, take the whole
# container down (Docker restart policy picks it back up).
trap 'kill -9 $API_PID $WEB_PID 2>/dev/null' EXIT
wait -n
exit 1
