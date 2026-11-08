# Gauntlet Run Board

## Summary
- Goal: Rework `/admin/access` so it stays usable with 1,000 users: searchable, filterable, paginated list + per-user detail view for role/permissions/deactivation.
- Quality bar: Each tick grants exactly that feature (C1-C6 carry over); search/filter/count consistent with action outcome; no regression on guards; typecheck + build pass.
- Overall state: SETUP
- Current wave: W1-initial
- Passed modules: 3 / 3
- Active: none
- Blocked: none
- Whole-system gate: PASS (fresh whole-system critic)
- Last update: 2026-11-08T07:00:00Z

## Modules

| ID | Output | Depends on | Quality gate | Owner | Round | Status | Last verdict | Largest gap | Evidence | Next action |
|---|---|---|---|---|---:|---|---|---|---|---|
| M1 | Backend list search/filter/pagination on `access.list` | None | C1-C5 + U1/U2 + typecheck | Builder | 1 | PASSED | PASS | None | Critic: search LIKE verified, role/status filters + counts consistent, pagination newest-first 25, guards intact, check-types 0 | M2 unlocked |
| M2 | User-management UI rework: toolbar + table + detail drawer | M1 PASS | C6 + U1-U4 + build | Builder | 1 | PASSED | PASS | None | Critic: search 300ms, filters+count, drawer toggles, pagination, check-types 0, build 26/26 | M7 |
| M7 | Whole-system verification | M1, M2 PASS | C1-C6 + U1-U4 live + typecheck/build | Critic | 1 | PASSED | PASS | None | Fresh whole-system critic: guards intact, search/filter/count/pagination/drawer verified, check-types 6/6, build 26/26, runtime 401-not-404 | Run complete |

## Criteria

- C1: Ticked Manage events grants events CRUD page + API for non-admin; blocked without tick.
- C2: No-tick user alumnus-only everywhere.
- C3: Non-admin cannot set permissions (server rejects).
- C4: Unknown permission values rejected server-side.
- C5: Full admin keeps all powers + user-management; last-admin guard intact.
- C6: `pnpm check-types` + `pnpm build` pass.
- U1: With 1,000 users, admin finds any user via search in under a few seconds (debounced 300ms, server-side).
- U2: Filters (role + status) narrow the list correctly; count on screen matches filtered set.
- U3: Permissions edited from detail view, not a cluttered inline row; save reflects immediately.
- U4: Mobile layout remains usable (stacked cards, drawer scrolls).

## UI shape (M2)

- Toolbar: search (name/email) + Role filter + Status filter + count text.
- Table rows: name, email, role chip, status chip, "Manage" action. Pagination at 25 (reuse alumni pattern).
- Click row / Manage → detail drawer: user summary, role control (Make/Remove admin), permission toggles (6), deactivate/reactivate.

## Dependency DAG

```
M1 (backend list) → M2 (UI) → M7 (whole-system)
```

## Event Log

| When | Module | Transition | Evidence or decision | Unlocked / next |
|---|---|---|---|---|
| 2026-11-08T06:00:00Z | — | CREATED | Prior run (per-user permission ticks) PASS. New run: usable access UI at 1,000 users — search/filter/paginate + detail drawer | M1 READY |
