# ONE image for the whole project: builds both apps, runs both in one container.
# Dokploy application settings:
#   Build Type           = Dockerfile
#   Dockerfile Path      = ./Dockerfile
#   Docker Context Path  = .
# Domain targets:  app.example.com -> container port 3001 (web)
#                  api.example.com -> container port 3000 (api)
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable

# Manifests first: the install layer is cached between deploys.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/

# --ignore-scripts: the root postinstall runs varlock codegen and needs the
# .env.schema files, which must be committed but are not copied yet.
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
# Generates src/env.ts from .env.schema; that file is gitignored.
RUN pnpm env:generate

# The web build needs NEXT_PUBLIC_SERVER_URL (it is inlined into the browser
# bundle). apps/web/.env.production supplies it, so Dokploy needs no build arg.
RUN pnpm --filter server build && pnpm --filter web build

FROM node:22-bookworm-slim
WORKDIR /app
# pnpm runs migrations, bun runs the API server. The API needs Bun, the
# migration needs Node's node:sqlite, so this image carries both.
RUN npm i -g pnpm@12.14.0 bun@1.3.8
COPY --from=build /app ./

ENV NODE_ENV=production
EXPOSE 3000 3001
# bash, not the shebang: git file modes do not survive Windows checkouts, so the
# script's exec bit cannot be relied on.
CMD ["bash", "/app/deploy/app-start.sh"]
