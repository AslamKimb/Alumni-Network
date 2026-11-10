# API image. Build from the repo root:
#   docker build -f apps/server/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/
COPY packages/config/package.json packages/config/
# --ignore-scripts: the root postinstall runs varlock codegen, which needs the
# .env.schema files that are not copied yet. Run it explicitly after COPY.
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
# Generates src/env.ts from .env.schema (gitignored, so it must be built here).
RUN pnpm env:generate
RUN pnpm --filter server build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /app ./
WORKDIR /app/apps/server
ENV NODE_ENV=production
EXPOSE 3000
# Varlock reads the committed .env.schema in this directory and validates the
# platform-injected environment on boot.
CMD ["bun", "run", "dist/index.mjs"]
