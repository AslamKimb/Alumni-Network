# Gauntlet Run Board

## Summary
- Goal: Fix OrganizationForm hooks crash + org logo upload reflects in header + org name replaces "Alumni Network" in header + sidebar collapsible on desktop.
- Quality bar: All criteria below pass with independent critic; typecheck + build pass; live runtime verified (app on 3000/3001).
- Overall state: PASS
- Current wave: W1-whole-system complete
- Passed modules: 3 / 3
- Active: none
- Blocked: none
- Whole-system gate: PASS (fresh whole-system critic)
- Last update: 2026-11-08T09:30:00Z

## Modules

| ID | Output | Depends on | Quality gate | Owner | Round | Status | Last verdict | Largest gap | Evidence | Next action |
|---|---|---|---|---|---|---|---|---|---|---|
| M1 | Org page hooks fix + logo/name propagation verify | None | C1-C3 | Builder | 1 | PASSED | PASS | None | Fresh critic: all hooks before early returns, save/cache verified, logo+monogram fallback live, check-types 0 | M3 |
| M2 | Desktop collapsible sidebar | None | C4-C6 | Builder | 1 | PASSED | PASS | None | Fresh critic: desktop toggle + icon rail + localStorage, mobile drawer intact, check-types 0 build 26 routes | M3 |
| M3 | Whole-system critic | M1, M2 PASS | All criteria + evidence | Critic | 1 | PASSED | PASS | None | Fresh whole-system critic: C1-C6 verified, check-types 6/6, build 26/26, 3000+3001 200 | Run complete |

## Criteria

- C1: /admin/settings/organization renders without hooks error (all hooks before any early return; useMutation unconditionally called).
- C2: Saving org settings persists all 10 fields; getOrganization returns updated values; landing + header show new name immediately.
- C3: Setting logoUrl to a valid HTTPS image makes header show that image (monogram fallback when empty/broken).
- C4: Desktop sidebar collapsible: toggle button collapses to icon rail or hidden; state persists across navigation; expand restores.
- C5: Mobile behavior unchanged (overlay drawer); desktop links still role/permission-gated.
- C6: pnpm check-types + pnpm build pass; no regression on prior routes.

## Dependency DAG

```
M1 (org page + header/logo) ─┐
                             ├-> M3 whole-system
M2 (sidebar collapse) ───────┘
```

## Event Log

| When | Module | Transition | Evidence or decision | Unlocked / next |
|---|---|---|---|---|
| 2026-11-08T09:00:00Z | — | CREATED | Console: hooks order crash in OrganizationForm (useMutation after early returns); sidebar needs desktop collapse; logo/name propagation to verify | M1+M2 READY |
