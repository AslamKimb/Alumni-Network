# Gauntlet Run Board

## Summary
- Goal: User-facing /events ("Events tab") gets List + Calendar views with toggle, default matching admin (calendar); new listPublishedInRange procedure; published-only calendar; recurring series instance chips with root/native distinction.
- Quality bar: Each todo has passing critic, whole-system PASS + evidence.
- Overall state: SETUP
- Current wave: W1-initial
- Passed modules: 3 / 3
- Active: none
- Blocked: none
- Whole-system gate: PASS (fresh whole-system critic)
- Last update: 2026-11-08T12:30:00Z

## Modules

| ID | Output | Depends on | Quality gate | Owner | Round | Status | Last verdict | Largest gap | Evidence | Next action |
|---|---|---|---|---|---|---|---|---|---|---|
| M1 | Backend: `listPublishedInRange({from,to})` in events router | None | C2, C4 | Builder | 1 | PASSED | PASS | None | Fresh critic: flags + published-only + range + asc verified, api typecheck clean | M3 |
| M2 | Frontend: `/events` view toggle (default calendar), calendar grid, list preserved | M1 parallel | C1-C6 | Builder | 1 | PASSED | PASS | None | Fresh critic: default calendar, toggle, chips+↻, guards intact, web check-types+build passed | M3 |
| M3 | Whole-system critic | M1, M2 PASS | All criteria + evidence | Critic | 1 | PASSED | PASS | None | Fresh whole-system critic: C1-C6 verified, check-types 6/6, build 28/28, runtime 401-not-404 | Run complete |

## Criteria

- C1: /events shows Calendar/List toggle; default = calendar.
- C2: Calendar fetches published events in visible month via listPublishedInRange; hides drafts/unpublished; chips navigate to /events/[id]; past months respect show_past_events.
- C3: List view still works with Upcoming/Past tabs.
- C4: Recurring series instances show correctly on calendar (each occurrence anchored to root date); instance detail links work.
- C5: Events module-disabled => /events shows Not found (existing guard preserved).
- C6: pnpm check-types + pnpm build pass; hooks correct.

## Backend contract (M1 implements; M2 depends on its name/shape)

- `listPublishedInRange({ from: Date, to: Date })` protectedProcedure -> published-only rows in range, ordered asc, respects events module flag (empty when disabled) and show_past_events (when false, only startsAt >= now even in calendar).

## Dependency DAG

```
M1 (listPublishedInRange) ─┐
                           ├-> M3 whole-system
M2 (user events views) ────┘
```

Parallel now: M1, M2 (disjoint files; M2 builds against contract). Free worker slots: 2.

## Event Log

| When | Module | Transition | Evidence or decision | Unlocked / next |
|---|---|---|---|---|
| 2026-11-08T12:00:00Z | — | CREATED | Request: user /events tab shows Upcoming/Past only; user wants same List + Calendar views as admin (default calendar) | M1+M2 READY |
