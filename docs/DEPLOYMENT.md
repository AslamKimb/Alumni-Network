# Deploying Alumni Network on Dokploy

**One application. One Dockerfile. One container.** The API (port `3000`) and the web app (port `3001`) run side by side inside it, and Traefik points two domains at their ports.

```
                          ┌────── container (this repo's Dockerfile) ──────┐
browser ► app.example.com │ :3001   next server                            │
   │                      │                                                │
   └►►► api.example.com   │ :3000   bun + hono api   ──►  /data/alumni.db  │
                          └────────────────────────┴─── volume ────────────┘
                          (migrations run automatically at startup)
```

Every step below is done in the Dokploy UI.

## 1. What you need

- A VPS: 2 vCPU, **2 GB RAM minimum** (the Next.js build needs it), ~20 GB disk.
- Two DNS `A` records → the VPS IP: `app.example.com` and `api.example.com`. They must share the domain — auth cookies are `SameSite=None; Secure` and browsers reject them across unrelated domains.

## 2. Install Dokploy

On the VPS, as root:

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Open `http://<VPS-IP>:3000` (this is the Dokploy panel, not the app) and create its admin account.

## 3. Create the application

1. **Create Project** → name `alumni`.
2. Inside it: **Create Service** → **Application** → name `alumni`.
3. *General* tab:
   - Source Type `GitHub` → authorize → select `AslamKimb/Alumni-Network` → branch `master`.
   - Build Type `Dockerfile`.
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Context Path**: `.`
   - **Docker Build Stage**: leave empty.
4. **Save**.

## 4. Environment tab

**Environment** — paste exactly this and change the four uppercase placeholders:

```
NODE_ENV=production
BETTER_AUTH_SECRET=<64 random hex characters, e.g. openssl rand -hex 32>
BETTER_AUTH_URL=https://api.example.com
CORS_ORIGIN=https://app.example.com
DATABASE_URL=file:/data/alumni.db
ADMIN_EMAILS=you@yourdomain.com
ADMIN_PASSWORD=<pick a strong one>
NEXT_PUBLIC_SERVER_URL=https://api.example.com
```

At startup the container runs the migrations, then the admin seed: the first address in `ADMIN_EMAILS` is created if it does not exist, and its password is set to `ADMIN_PASSWORD` every time the container starts. Delete `ADMIN_PASSWORD` once you have changed your password in **Settings → Account**, or the next restart puts the old one back.

This is the complete list — the same block goes to both servers, each one reads what it needs. Varlock validates it against the committed schemas at startup; a wrong value stops the container with a named error instead of half-booting.

**Build-time Arguments** — leave empty. The one build-time value, `NEXT_PUBLIC_SERVER_URL`, is committed in `apps/web/.env.production` because `next build` compiles it into the browser bundle. Nothing to paste, nothing to save.

No trailing slashes on any of the URLs. `CORS_ORIGIN` is compared against the browser's `Origin` header, which never ends in `/`, and better-auth appends paths to `BETTER_AUTH_URL` verbatim.

`ADMIN_EMAILS` must be an address you control — that is the account you sign in with.

What each variable enforces, precedence rules, and failure messages: **[ENVIRONMENT.md](./ENVIRONMENT.md)**.

## 5. Assign the two domains

*Domains* tab → **Add Domain** twice:

| Host | Container Port | HTTPS | Certificate |
| --- | --- | --- | --- |
| `api.example.com` | `3000` | on | `letsencrypt` |
| `app.example.com` | `3001` | on | `letsencrypt` |

Domain changes need a redeploy to apply (no hot reload).

## 6. Create the volume

*Advanced* tab → **Volumes** → create one:

- Name: `alumni-db` — Mount Path: `/data`

This volume holds the SQLite database. Without it the data disappears on every deploy.

## 7. Deploy

Click **Deploy** and watch the *Deployments* tab:

1. Image build (~5 min first time, cached after).
2. At startup the container runs the DB migrations, seeds the `ADMIN_EMAILS` account, then starts both servers.
3. Traefik issues the certificates — give it ~30 seconds after the deploy finishes.

## 8. First run

Open `https://app.example.com/login` and sign in with the address from `ADMIN_EMAILS` and the password from `ADMIN_PASSWORD`. The container created that account during startup — do not sign up, it already exists.

Then change the password in **Settings → Account** and delete `ADMIN_PASSWORD` from the Environment tab. While it stays, every restart resets the password to it.

## 9. Verify

| Check | Expected |
| --- | --- |
| `https://api.example.com/api/auth/get-session` | HTTP `200` with an empty session |
| `https://app.example.com/login` | Login page, valid certificate |
| Logs | Both servers running, `migrations applied successfully` |
| Sign up + reload | You stay logged in (proves cookies + CORS) |

## 10. Updating

Push to `master`, click **Deploy** (or enable Auto Deploy in the General tab). Any env-var change only needs a redeploy — except the API domain, which is baked into the browser bundle at build time: change `apps/web/.env.production` too, or the app keeps calling the old host.

## 11. Backups

*Volume Backups* tab → schedule backups of the `alumni-db` volume to an S3 destination (add one under *S3 Destinations*). Keep copies off the VPS.

## 12. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Container restarts in a loop with `Value is required but is currently empty` | Missing variable in the Environment tab | Read the name in the log, add it, deploy |
| Sign-up says `User already exists` | The startup seed already created that address | Sign in instead, with the `ADMIN_PASSWORD` value |
| Page stuck on `Loading your record…`, console full of `401` | The browser holds a session cookie the API rejects (left over from an earlier deploy) | Clear the cookies for the domain, then sign in again |
| `Invalid URL` in the logs | URL without `https://` | Add the scheme, deploy |
| `[varlock] No .env files found in /app/apps/...` | Image built without `.env.schema` | Keep `apps/*/.env.schema` committed, rebuild |
| `table 'account' already exists` at startup | Volume was filled by `drizzle-kit push` (dev flow), not migrate | Wipe the volume and let startup migrations create it |
| Domain returns 404/502 | Added the domain but did not redeploy, or wrong port | Redeploy; check port `3001` for web, `3000` for api |
| Login 401s on every request | `CORS_ORIGIN` does not exactly match the web origin | Set it to `https://app.example.com`, no trailing slash |
| App calls `localhost:3000` | Image was built before `apps/web/.env.production` was correct | Fix the file, push, redeploy |
| Build fails: `NEXT_PUBLIC_SERVER_URL` is empty | `apps/web/.env.production` is missing or excluded by `.dockerignore` | Keep the file committed |
| `SQLITE_CANTOPEN` | Volume not mounted at `/data` | Re-check Advanced → Volumes |
| Build dies with `commit failed: input/output error` | VPS out of disk | Free space, redeploy |
