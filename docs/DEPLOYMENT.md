# Deploying Alumni Network on a VPS with Dokploy

Two apps, one repo, one server. The web app (Next.js) talks straight to the API (Hono + tRPC) from the browser, so both need a public HTTPS domain. The database is a SQLite file on a Docker volume.

```
browser ──► https://app.example.com   (Next.js container, :3000)
   │
   └──────► https://api.example.com   (Bun/Hono container, :3000) ──► /data/alumni.db (volume)
```

## Pick a build path first

Both paths deploy the same two apps to the same domains with the same environment. They differ only in how the image is produced.

| Path | Use it when | Where |
| --- | --- | --- |
| **Railpack** (default) | You want zero build files and Dokploy to infer everything from the pnpm workspace | §4 → §6 |
| **Dockerfile** | You want pinned base images and the exact same build locally, in CI, and on the VPS | **§11** |

Sections 1–3 (server, install, project) are shared. Sections 7–10 and 12 (first run, verify, environment reference, backups, troubleshooting) apply to both paths.

### Railpack settings, at a glance

| Dokploy app | Source | Build | Start |
| --- | --- | --- | --- |
| `alumni-api` | repo root | `pnpm --filter server build` | `cd apps/server && bun run dist/index.mjs` |
| `alumni-web` | repo root | `pnpm --filter web build` | `cd apps/web && node node_modules/next/dist/bin/next start -p 3000` |

Railpack detects the pnpm workspace from `pnpm-workspace.yaml`, installs all workspace packages, and installs Bun on its own because the API start command calls `bun`. Because both apps build from the repo root, each one reads its own Railpack config file through `RAILPACK_CONFIG_FILE` (see §4). Without that, both would run the root `build` script and build every app in every container.

### Dockerfile settings, at a glance

| Dokploy app | Dockerfile Path | Docker Context Path | Build Time Arguments |
| --- | --- | --- | --- |
| `alumni-api` | `apps/server/Dockerfile` | `.` | — |
| `alumni-web` | `apps/web/Dockerfile` | `.` | `NEXT_PUBLIC_SERVER_URL=https://api.example.com` |

Full walkthrough in **§11**. Skip the `RAILPACK_*` variables there; they do nothing with Dockerfiles.

---

## 1. Prerequisites

- VPS: 2 GB RAM, 30 GB disk minimum (Ubuntu 24.04 tested path), root access.
- A domain you control, with two DNS A records pointing at the VPS IP:
  - `app.example.com` → web
  - `api.example.com` → api
- Ports 80, 443 and 3000 free on the host before install.
- The repo reachable from the VPS (GitHub app integration or a deploy key).

Keep both hostnames on the **same registrable domain**. Auth cookies are `SameSite=None; Secure`, and same-site subdomains keep them first-party in browsers that block third-party cookies.

## 2. Install Dokploy

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Open `http://<vps-ip>:3000`, create the admin account, then add a domain + Let's Encrypt certificate for the panel itself before you close port 3000.

Updates: `curl -sSL https://dokploy.com/install.sh | sh -s update`

## 3. Create the project

1. **Projects → Create Project** → name it `alumni-network`.
2. **Create Service → Application** twice: `alumni-api` and `alumni-web`.
3. For each app, **General → Provider → GitHub** (or Git), pick the repo, branch `master`, and leave the build path at the repo root. Both apps build from the same commit.

## 4. Build config files (both apps)

Two committed Railpack configs tell each app what to build and how to start. They exist because the repo root has one `build` script for the whole workspace; each container must build only its own app.

`deploy/railpack.api.json`

```json
{
  "$schema": "https://schema.railpack.com",
  "provider": "node",
  "steps": {
    "build": { "commands": ["pnpm --filter server build"] }
  },
  "deploy": {
    "startCommand": "cd apps/server && bun run dist/index.mjs"
  }
}
```

`deploy/railpack.web.json`

```json
{
  "$schema": "https://schema.railpack.com",
  "provider": "node",
  "steps": {
    "build": { "commands": ["pnpm --filter web build"] }
  },
  "deploy": {
    "startCommand": "cd apps/web && node node_modules/next/dist/bin/next start -p 3000"
  }
}
```

Each app selects its file with `RAILPACK_CONFIG_FILE` in the Environment tab. `deploy.startCommand` replaces Railpack's auto-detected start command; `steps.build.commands` replaces the auto-detected build command, so the filter is what keeps each image small.

## 5. API app (`alumni-api`)

**General**

- Build Type: `Railpack`
- Build Path: `/` (repo root)

**Environment** — paste this, then edit the four marked values:

```dotenv
NODE_ENV=production
PORT=3000

# Public URL of this API. Must be https, no trailing slash.
BETTER_AUTH_URL=https://api.example.com

# Public URL of the web app. Exactly one origin, no trailing slash.
CORS_ORIGIN=https://app.example.com

# 32+ chars. Generate: openssl rand -hex 32
BETTER_AUTH_SECRET=replace-with-64-hex-chars

# SQLite file on the mounted volume.
DATABASE_URL=file:/data/alumni.db

# Comma-separated. The first sign-up using one of these emails becomes admin.
ADMIN_EMAILS=you@example.com

# Build/start overrides (see §4). This file overrides the root build script
# and sets the start command for this app only.
RAILPACK_CONFIG_FILE=deploy/railpack.api.json
# Keep dev dependencies so drizzle-kit is available for migrations from the container.
RAILPACK_PRUNE_DEPS=false
```

**Advanced → Volumes**

- Volume Mount: name `alumni-db`, mount path `/data`
- Replicas: keep at `1`. SQLite on a single volume cannot be shared by replicas.

**Domains**

- Host `api.example.com`, path `/`, internal port `3000`, HTTPS on (Let's Encrypt).

**Deploy.** Then run the schema migrations once:

**Advanced → Run Command**

```bash
pnpm --filter @Alumni-Network/db db:migrate:deploy
```

## 6. Web app (`alumni-web`)

**General**

- Build Type: `Railpack`
- Build Path: `/` (repo root)

**Environment**

```dotenv
NODE_ENV=production

# Baked into the client bundle at build time. Must be the public API URL.
NEXT_PUBLIC_SERVER_URL=https://api.example.com

RAILPACK_CONFIG_FILE=deploy/railpack.web.json
```

**Domains**

- Host `app.example.com`, path `/`, internal port `3000`, HTTPS on.

Deploy **after** the API is up and migrated. `NEXT_PUBLIC_SERVER_URL` is inlined during `next build`, so changing it needs a full redeploy with rebuild, not just a restart.

## 7. First run

1. Open `https://app.example.com` → sign up with an address listed in `ADMIN_EMAILS`. That account gets `role=admin` because no active admin exists yet.
2. `ADMIN_EMAILS` only bootstraps the first admin; afterwards roles are managed in `/admin/access`, and demoting the listed email is not silently reversed.
3. Set the organisation settings, allowed email domains and sign-up switch in `/admin/settings/auth`.

## 8. Verify

| Check | Command | Expected |
| --- | --- | --- |
| API is listening | `curl -i https://api.example.com/` | `200 OK`, body `OK` |
| Auth route reachable | `curl -i https://api.example.com/api/auth/ok` | `200`, JSON body |
| CORS allows the web origin | `curl -i -H "Origin: https://app.example.com" https://api.example.com/api/auth/ok` | `access-control-allow-origin: https://app.example.com` |
| DB file exists on the volume | Advanced → Run Command: `ls -l /data` | `alumni.db` present |
| Client points at the API | DevTools → Network on the login page | requests go to `https://api.example.com/trpc`, no `localhost` |
| Cookie accepted | DevTools → Application → Cookies for the API domain | session cookie, `Secure`, `SameSite=None` |

If the login page calls `localhost:3000`, the web image was built without `NEXT_PUBLIC_SERVER_URL`; set it and redeploy with rebuild.

## 9. Environment reference

Both apps use [Varlock](https://varlock.dev). Each `.env.schema` file is committed and validated at boot; the values themselves only live in Dokploy. A missing or invalid value fails the container immediately with a `varlock` error - that is the validation working, not a crash to work around.

How the schemas, local files, precedence, build-time vs runtime values and the exact per-app paste blocks work: **[ENVIRONMENT.md](./ENVIRONMENT.md)**.

| Variable | App | Required | Rule / notes |
| --- | --- | --- | --- |
| `NODE_ENV` | both | yes | `development` \| `production` \| `test`. Railpack sets `production` anyway. |
| `PORT` | api | no | Listen port, default `3000`. Must match the domain's internal port. |
| `BETTER_AUTH_URL` | api | yes | URL type. Public API origin; used as Better Auth `baseURL`. |
| `BETTER_AUTH_SECRET` | api | yes | min 32 chars. Rotating it invalidates all sessions. |
| `CORS_ORIGIN` | api | yes | URL type, single origin. Also the only trusted auth origin. |
| `DATABASE_URL` | api | yes | `file:/data/alumni.db` (libsql). A remote Turso URL also works here. |
| `ADMIN_EMAILS` | api | yes | Comma-separated. Bootstraps the first admin only. Do not leave empty — the schema requires a value. |
| `NEXT_PUBLIC_SERVER_URL` | web | yes | URL type. Public API origin, inlined at build time. |
| `RAILPACK_CONFIG_FILE` | both | yes | `deploy/railpack.api.json` for the API, `deploy/railpack.web.json` for the web app. Build-time only. Railpack only — skip with Dockerfiles. |
| `RAILPACK_PRUNE_DEPS` | api | no | `false` keeps `drizzle-kit` in the image so migrations can run from the container. Railpack only. |

`packages/db` reuses `NODE_ENV` and `DATABASE_URL` from `apps/server/.env.schema`, so migrations run from the API container need no extra variables.

## 10. Backups

The whole application state is one file. Copy it off the host on a schedule:

```bash
docker volume ls | grep alumni-db          # find the volume Dokploy created
docker run --rm -v <volume-name>:/data -v "$PWD":/backup alpine \
  tar czf /backup/alumni-db-$(date +%F).tgz -C /data .
```

Restore: stop the API app, extract into the volume, start it again. For anything beyond a single VPS, move `DATABASE_URL` to Turso and drop the volume.

## 11. Option B: Dockerfile builds

Everything above still applies (volumes, domains, env, migrations). Only the build settings change. Both apps ship a Dockerfile that expects the **repo root** as build context.

| Setting | `alumni-api` | `alumni-web` |
| --- | --- | --- |
| Build Type | `Dockerfile` | `Dockerfile` |
| Dockerfile Path | `apps/server/Dockerfile` | `apps/web/Dockerfile` |
| Docker Context Path | `.` | `.` |
| Build Time Arguments | — | `NEXT_PUBLIC_SERVER_URL=https://api.example.com` |

Drop `RAILPACK_CONFIG_FILE` and `RAILPACK_PRUNE_DEPS` from the Environment tab; they do nothing here. `NEXT_PUBLIC_SERVER_URL` must come through **Build Time Arguments**, not the runtime environment, because `next build` inlines it.

What the images do:

- Build stage `node:22-bookworm-slim`, `corepack enable` picks pnpm from the `packageManager` field, `pnpm install --frozen-lockfile --ignore-scripts` over the copied workspace manifests, then `pnpm --filter <app> build`.
- API runtime `oven/bun:1-slim`, `CMD bun run dist/index.mjs` in `apps/server`.
- Web runtime `node:22-bookworm-slim`, `CMD next start -p 3000` in `apps/web`.
- `.dockerignore` keeps host `node_modules`, `.git`, `.next`, `dist` and the local `.env` files out of the context, so a Windows checkout cannot poison the Linux build and no secret is baked into a layer.

`--ignore-scripts` skips the root postinstall, because at install time the `.env.schema` files have not been copied yet. `RUN pnpm env:generate` right after `COPY . .` does that work instead: `src/env.ts` is gitignored, so it has to be generated inside the image before `next build` or `tsdown` can resolve `import { ENV } from "./env"`.

Manual build, for reproducing a failure outside Dokploy:

```bash
docker build -f apps/server/Dockerfile -t alumni-api .
docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_SERVER_URL=https://api.example.com -t alumni-web .
```

## 12. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Container exits with `[varlock] No .env files found` | `.env.schema` missing from the image | Keep `apps/*/.env.schema` committed; rebuild. |
| `docker build` fails with `Cannot find module './env'` | `src/env.ts` was never generated in the image | Keep `RUN pnpm env:generate` after `COPY . .` in the Dockerfile. |
| Container exits with a `varlock` validation error | A required variable is missing/empty/invalid | Fix the value in the Environment tab and redeploy. |
| `EADDRINUSE` on boot | Another process in the container already bound the port | Confirm only one start command runs; check `deploy.startCommand` in the app's railpack config. |
| Container starts the wrong app, or builds both apps | `RAILPACK_CONFIG_FILE` not set for that app | Set it to the matching file in `deploy/` and redeploy. |
| Build fails with `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` | The root build script ran instead of the filtered one | Same fix: the config file replaces the root build command. |
| Browser gets CORS errors | `CORS_ORIGIN` ≠ the exact web origin (scheme/host/port) | Set it to `https://app.example.com`, no trailing slash. |
| Login succeeds then bounces to `/login` | Cookies rejected: no HTTPS, or hostnames on different sites | Enable the certificate; keep web and api on the same registrable domain. |
| `SQLITE_READONLY` / data lost after redeploy | No volume mounted at `/data` | Add the `alumni-db` volume mount and redeploy. |
| `no such table: user` | Migrations never ran | Advanced → Run Command → `pnpm --filter @Alumni-Network/db db:migrate:deploy`. |
| Web build fails on env validation | `NEXT_PUBLIC_SERVER_URL` absent at build time | Add it, then redeploy with rebuild. |
| Login page calls `localhost:3000` | Image built without `NEXT_PUBLIC_SERVER_URL` | Same fix; the value is baked in at build, not read at runtime. |
| Build runs out of memory | Next.js build needs headroom | Give the VPS ≥ 2 GB RAM, or set `NODE_OPTIONS=--max-old-space-size=3072` in the web Environment tab. |
| `docker build` fails with `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` | Build context was `apps/server` or `apps/web` instead of the repo root | Set Docker Context Path to `.`. |
| Web image still points at `localhost:3000` | `NEXT_PUBLIC_SERVER_URL` set as a runtime env var instead of a build arg | Move it to Build Time Arguments and rebuild. |
| `docker build` dies with `commit failed: input/output error` | The Docker host is out of disk | Free space on the Docker data root (`docker system df`), then rebuild. |
