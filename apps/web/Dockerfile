# Web image. Build from the repo root:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_SERVER_URL=https://api.example.com .
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/
COPY packages/config/package.json packages/config/
# --ignore-scripts: the root postinstall runs varlock codegen, and the generated
# src/env.ts files are already committed. Rerun `pnpm env:generate` if a schema changes.
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
# Inlined into the client bundle by next build; changing it needs a rebuild.
ARG NEXT_PUBLIC_SERVER_URL
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL
RUN pnpm --filter web build

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /app ./
WORKDIR /app/apps/web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
