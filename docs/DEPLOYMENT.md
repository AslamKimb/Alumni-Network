# Deploying Alumni Network on a VPS with Dokploy

One Dokploy app. One `docker-compose.yml`. Three containers.

```
Dokploy app: alumni  (type: Compose → Docker Compose)
├── migrate   one-shot   drizzle-kit migrate, exits 0
├── api       https://api.example.com  :3000  ──► /data/alumni.db
└── web       https://app.example.com  :3000
                                    volume: alumni-db → /data
```

| Container | Image | Job |
| --- | --- | --- |
| `migrate` | `apps/server/Dockerfile`, `build` stage | Applies pending migrations, then exits. The API waits for it. |
| `api` | `apps/server/Dockerfile` | Bun + Hono + tRPC + Better Auth. Reads and writes the SQLite file. |
| `web` | `apps/web/Dockerfile` | Next.js server. The browser talks to the API directly. |

Everything is driven from the Dokploy UI. No shell on the server, no manual `docker` commands.

## 1. Prerequisites

- A VPS: 2 vCPU, **2 GB RAM minimum** (the Next.js build needs it), 20 GB disk, Ubuntu 22.04 or 24.04, root SSH access.
- Two DNS `A` records pointing at the VPS IP: `app.example.com` and `api.example.com`.
- This repo pushed to GitHub, branch `master`.

Both hostnames must sit on the **same registrable domain**. Auth cookies are `SameSite=None; Secure`, which browsers refuse across unrelated domains.

## 2. Install Dokploy

On the VPS, as root:

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Then open `http://<VPS-IP>:3000` and create the admin account. That port is Dokploy's own panel, not the app.

## 3. Create the Compose app

1. **Create Project** → name it `alumni`.
2. Inside the project: **Create Service** → **Compose**.
3. Fill in the General tab:

| Field | Value |
| --- | --- |
| Name | `alumni` |
| Compose Type | `Docker Compose` |
| Provider | `GitHub` |
| Repository | `AslamKimb/Alumni-Network` |
| Branch | `master` |
| Compose Path | `./docker-compose.yml` |

4. **Save**.

The compose file builds both images from the repo root and passes every value through `${...}`. Nothing else needs configuring here — no build type, no start command, no publish directory.

Do not add `container_name` to any service. Dokploy's logs, metrics and domain routing all key off the generated names.

## 4. Environment tab

One block, for the whole stack. Paste this and replace the two URLs and the admin email:

```
BETTER_AUTH_SECRET=replace-with-openssl-rand-hex-32
BETTER_AUTH_URL=https://api.example.com
CORS_ORIGIN=https://app.example.com
DATABASE_URL=file:/data/alumni.db
ADMIN_EMAILS=you@yourdomain.com
NEXT_PUBLIC_SERVER_URL=https://api.example.com
```

That is the complete list. `NODE_ENV=production` is already hardcoded per service in `docker-compose.yml`.

How these values reach the containers: Dokploy writes this block to a `.env` file next to the compose file, and the compose file maps each one into the right service with `${VAR}`. Variables in the Environment tab are **not** injected automatically — that mapping is why every name above appears twice (once here, once in the compose file).

Per-variable rules, the precedence model, and what each one does: **[ENVIRONMENT.md](./ENVIRONMENT.md)**.

## 5. Domains tab

**Add Domain** twice:

| Host | Service | Container Port | HTTPS | Certificate |
| --- | --- | --- | --- | --- |
| `api.example.com` | `api` | `3000` | on | `letsencrypt` |
| `app.example.com` | `web` | `3000` | on | `letsencrypt` |

Leave Path, Internal Path and Strip Path empty. Dokploy turns each entry into Traefik labels on the selected service.

For Compose apps, domain changes only take effect after a **redeploy** — there is no hot reload. If you add or edit a domain, deploy again.

## 6. Deploy

Click **Deploy** and watch the Deployments tab. What happens, in order:

1. Both images build from the repo root. First build takes 5–10 minutes; later ones reuse the layer cache.
2. `migrate` starts, applies every migration in `packages/db/src/migrations`, and exits `0`.
3. `api` starts only after that exits successfully.
4. `web` starts in parallel with `api`.
5. Traefik issues certificates. Give it ~30 seconds after the deploy finishes.

Every deploy re-runs `migrate`. It is idempotent — nothing to do means it exits immediately.

## 7. First run

Open `https://app.example.com` and sign up using an address from `ADMIN_EMAILS`. That account is granted admin on first login; the variable only bootstraps while no active admin exists.

## 8. Verify

| Check | Expected |
| --- | --- |
| `https://api.example.com` | A response from the API, not a 502 |
| `https://app.example.com/login` | Login page, certificate valid |
| Deployments → `migrate` logs | `migrations applied` or similar, container exited `0` |
| Browser devtools on the login page | Requests go to `https://api.example.com`, not `localhost` |
| Sign up, then reload | Session persists (proves cookies and CORS agree) |

## 9. Backups

The entire application state is the `alumni-db` volume.

1. **S3 Destinations** (left nav) → add a destination.
2. Open the `alumni` app → **Volume Backups** → create a schedule for the `alumni-db` volume.
3. Keep a copy off the VPS. A backup that lives only on the machine it protects is not a backup.

Restore: stop the app, restore the archive into the `alumni-db` volume, deploy again.

## 10. Updating

Push to `master`, then click **Deploy** — or enable Auto Deploy on the General tab to deploy on every push.

Two things behave differently from a normal restart:

- **A code change needs a rebuild**, which Deploy does by default.
- **A change to `NEXT_PUBLIC_SERVER_URL` needs a rebuild too**, because `next build` inlines it into the browser bundle. Editing the Environment tab alone will not move it; click Deploy.

Changing any other variable only needs the containers recreated — also a Deploy.

## 11. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `migrate` exits non-zero, `api` never starts | Migration failed, usually `DATABASE_URL` | Read the `migrate` logs; confirm `file:/data/alumni.db` |
| `api` logs `Value is required but is currently empty` | A variable is missing from the Environment tab | Add it, Deploy |
| `api` logs `Invalid URL` | A URL without `https://` | Add the scheme, Deploy |
| `api` logs `[varlock] No .env files found` | Image built without `.env.schema` | Keep `apps/*/.env.schema` committed, rebuild |
| `api` crash-loops with `SQLITE_CANTOPEN` | Volume not mounted at `/data` | Check the `api` service still has `alumni-db:/data` |
| Domain returns 404 or 502 | Domain added but not redeployed, or wrong service selected | Redeploy; confirm the domain points at `api` / `web` and port `3000` |
| Login works, then every request 401s | `CORS_ORIGIN` does not match the web origin exactly | Make it the exact `https://app.example.com`, no trailing slash |
| Web app calls `localhost:3000` | `NEXT_PUBLIC_SERVER_URL` was empty at build time | Set it in the Environment tab and Deploy (rebuild) |
| `docker build` fails with `Cannot find module './env'` | `src/env.ts` was never generated in the image | Keep `RUN pnpm env:generate` after `COPY . .` in the Dockerfile |
| Build dies with `commit failed: input/output error` | The host is out of disk | Free space on the VPS, redeploy |

For anything else, the **Deployments** tab shows the full build log per service, and **Logs** shows each container separately.
