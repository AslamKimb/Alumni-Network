# Gauntlet Run Board

## Summary
- Goal: PRODUCT.md §3.1 — First visit and sign-up with onboarding flow (3 steps), resume-on-sign-in, dashboard only after completion.
- Quality bar: 10 cases pass: consent enforcement/new signup storage; legacy re-consent; saved-step resume; zero/many optional entries; dashboard gate/re-sign-in; admin bypass. `pnpm check-types`, `pnpm build`, `pnpm lint` pass; runtime verified at 1440px/390px in light/dark.
- Overall state: PASS
- Current wave: W6-whole-system complete
- Passed modules: 6 / 6
- Active: none
- Blocked: none
- Whole-system gate: PASS (fresh independent M6 critic)
- Last update: 2026-11-02T20:13:09Z

## Dependency DAG

```
M1 schema -> M2 API -> M4 onboarding ─┐
M3 signup ────────────┘               ├-> M6 whole-system
M2 API -> M5 dashboard ───────────────┘
```

## Modules

| ID | Output | Depends on | Quality gate | Owner | Round | Status | Last verdict | Largest gap | Evidence | Next action |
|---|---|---|---|---|---:|---|---|---|---|---|
| M1 | PRODUCT §5 `alumnus_profile`, `duty`, and `education` schema + Drizzle migration artifacts, applied locally | None | exact PRODUCT fields/FKs/cascades including `consent_at`; migration artifacts exist and replay on clean DB; local schema/typecheck pass; user data preserved | Builder | 4 | PASSED | PASS | None | Fresh critic: schema and migrations match PRODUCT; clean SQLite replay, no-diff generation, local PRAGMAs/integrity and DB typecheck pass; auth rows preserved (3 users) | M2 and M3 unlocked |
| M2 | Onboarding tRPC status/save procedures using profile-owned data | M1 PASS | protected per-user reads/writes; server validation; step saves preserve data; status returns saved profile and entries plus first incomplete step; missing profile reports `needsConsent`; explicit acceptance creates profile with server timestamp; finalization only after successful writes | Builder | 5 | PASSED | PASS (independent M2/M4 critic) | None | Reviewer verified consent/time/name transaction and country membership; 16 targeted API tests pass; 248-code set matches official M49 alpha-2 column | M5 and M6 unlocked |
| M3 | Signup consent checkbox + trusted server enforcement and profile `consent_at` persistence; route to onboarding | M1 PASS | full name 2–120; server rejects missing/false consent before user creation; accepted signup creates profile with server timestamp and no client-controlled time; success routes to onboarding | Builder | 5 | PASSED | PASS (lead-run) | None | UI unchecked consent shows inline error and disables submit; direct signup without consent 400 “Consent is required.”; name “A” 400 “Name must be 2–120 characters.”; accepted signup created profile with server `consent_at` and redirected to `/onboarding` | M4/M6 unlocked |
| M4 | `/onboarding` page with 3 steps, Continue saves, Finish → /dashboard | M2, M3 PASS | all steps render, mutations awaited, saved fields hydrate, first-incomplete resume works; legacy profile-less account must explicitly consent before profile creation | Builder | 4 | PASSED | PASS (independent M2/M4 critic) | None | Reviewer inspected source and renders; browser: correction updates profile+account and refreshed header; searchable Canada selection saved `CA/Toronto`; 390px light/dark and 1440px dark inspected; no horizontal overflow | M5 and M6 unlocked |
| M5 | Dashboard server gate + incomplete resume prompt | M2 PASS | incomplete alumnus sees resume prompt only; complete user sees dashboard; admin optional bypass | Builder | 3 | PASSED | PASS (fresh independent M6 critic) | None | Current runtime: incomplete alumnus sees resume-only state at step 3; zero-entry Finish reaches dashboard; completed greeting uses corrected name. Whole-system critic accepted existing sign-in and admin-bypass evidence against current source. | M6 whole-system PASS |
| M6 | Whole-system verification | M3, M4, M5 | C1 unchecked consent rejected; C2 accepted signup persists server timestamp; C3 legacy re-consent gates profile creation; C4/C5 saved steps resume correctly; C6 zero entries complete; C7 multiple entries persist; C8 incomplete dashboard hides content/prompts resume; C9 completed sign-out/sign-in reaches dashboard; C10 admin bypass; typecheck/build/lint and desktop/mobile light/dark runtime checks | Critic | 5 | PASSED | PASS (fresh independent whole-system critic) | None | Critic verified all original cases and current source; API tests 16/16; typecheck 6/6; build 2/2; lint exit 0 with existing empty-export warning; exact 248-code M49 comparison; browser consent/country/resume/completion and 1440/390 light/dark evidence. DB restored to baseline. | Run complete |

## Event Log

| When | Module | Transition | Evidence or decision | Unlocked / next |
|---|---|---|---|---|
| 2026-11-02T00:00:00Z | — | CREATED | §3.1 plan accepted from prior discussion | M1, M3 READY |
| 2026-11-02T18:50:00Z | M1 | BUILDING → CRITIC | `db:push`; `PRAGMA` confirmed all 3 tables and columns; fresh independent critic spawned | Await verdict |
| 2026-11-02T18:51:00Z | M2 | READY → BLOCKED | Discovered API code had been written before M1 critic PASS; stopped further M2 work until prerequisite formally passes | Await M1 |
| 2026-11-02T18:52:00Z | M3 | BUILDING | Checkbox callback corrected to TanStack FieldApi shape; `next typegen` fixed typed route; whole web check remains blocked by M4 draft errors | Continue M3 proof |
| 2026-11-02T19:00:00Z | M3 | BUILDING → CRITIC | Browser `/login`: clicking Sign Up unchecked shows “You must consent…”; checkbox click changes aria-checked false→true; button redirects via `router.push('/onboarding')` in code | Critic spawned |
| 2026-11-02T15:31:00Z | M1 | CRITIC → FIX | Fresh critic FAIL: PRODUCT §5 specifies `alumnus_profile`, profile-owned child FKs, duty description, education level/program/year/description; migration artifact missing. Consent timestamp finding conflicts with prior user decision and is held for clarification. | M1 round 2; M2 remains BLOCKED |
| 2026-11-02T15:31:00Z | M3 | CRITIC → FIX | Fresh critic FAIL: full name accepts over 120 characters, violating PRODUCT §9.1. | M3 round 2 |
| 2026-11-02T15:32:53Z | M1, M3 | FIX → BUILDING | Dispatched independent fixes in parallel; M1 must not change consent storage before user decision; M3 bounds name length only. | Await both builders |
| 2026-11-02T15:54:24Z | M1 | BUILDING → CRITIC | Schema now matches PRODUCT §5 except consent timestamp decision; builder reports typecheck, disposable migration, PRAGMA/cascade, and legacy-row guard pass; local DB not migrated because baseline would replay against existing tables. | Fresh M1 critic |
| 2026-11-02T15:54:24Z | M3 | BUILDING → CRITIC | Added 2–120 name validation; builder assertion confirms 121 rejected before auth, 120 accepted, unchecked consent blocks auth; package typecheck still blocked by unrelated onboarding errors. | Fresh M3 critic |
| 2026-11-02T15:54:24Z | M1 | CRITIC → BLOCKED | Schema/migration repair returned, but full M1 gate cannot be finalized until user resolves `consent_at` conflict and local DB can be safely advanced. | Await decision; keep M2 blocked |
| 2026-11-02T15:59:15Z | M3 | CRITIC → PASSED | Independent critic PASS: name boundaries, consent gate, auth payload, redirect, and M3 type scope verified. | M4 remains blocked on M2 |
| 2026-11-02T16:13:34Z | M1, M3 | SCOPE DECISION | User chose to persist `consent_at`, matching PRODUCT.md §§5/13; this supersedes the earlier validation-only decision. M3’s prior PASS is valid only for the old scope. | Add schema field; reopen M3 after M1 PASS |
| 2026-11-02T16:13:34Z | M1 | BLOCKED → READY | Consent policy now resolved; no prerequisites. Dispatch schema/migration round 3. | M1 builder |
| 2026-11-02T16:13:34Z | M3 | PASSED → BLOCKED | Scope expanded to server-side consent persistence, which depends on M1 profile schema. Prior form-only verdict retained as history, not current gate. | Wait for M1 PASS |
| 2026-11-02T16:24:01Z | M1 | BUILDING → CRITIC | Added required `consent_at`; disposable migration passed, local `db:migrate` was deliberately not run because baseline would collide with existing auth tables; local user count preserved at 3. | Fresh M1 critic |
| 2026-11-02T16:24:01Z | M1 | CRITIC → BLOCKED | Independent critic verified target schema and disposable migration but found local DB still on old schema; requires explicit safe local application. | Keep M2/M3 blocked |
| 2026-11-02T16:31:31Z | M1 | BLOCKED → READY | Prior user decision explicitly authorized local `db:push`; independent critic confirmed safe route; lead dry-run with explicit create hints plans only domain-table DDL, leaves auth `user` table untouched; existing domain tables have zero rows. | Round-4 builder backs up and applies, then verifies |
| 2026-11-02T16:41:20Z | M1 | BUILDING → CRITIC | WAL-safe backup created; reviewed explain plan was domain-only; hinted `db:push` applied once; 3 users preserved; target columns/FKs/indexes/integrity, DB typecheck, and no-diff generation verified by builder. | Fresh M1 critic |
| 2026-11-02T16:47:12Z | M1 | QUALITY BAR REFINED | Removed lead-added Git-tracking requirement: PRODUCT requires additive/reversible migrations, not staging/commit. Migration artifacts must exist, replay on clean DB, and match applied local schema. M1 remains in CRITIC pending fresh verdict; no repository staging. | Fresh corrected critic |
| 2026-11-02T16:55:29Z | M1 | CRITIC → PASSED | Corrected independent critic PASS: PRODUCT fields/FKs/cascades and consent_at match; migration artifacts replay on clean SQLite; local PRAGMAs/integrity/typecheck pass; auth rows preserved. | M2 and M3 unlocked |
| 2026-11-02T16:55:29Z | M2 | BLOCKED → READY | M1 formal PASS satisfies prerequisite; API repair can now align to profile-owned schema. | Dispatch with M3 |
| 2026-11-02T16:55:29Z | M3 | BLOCKED → READY | M1 formal PASS satisfies prerequisite; user chose required server-side consent timestamp behavior. | Dispatch with M2 |
| 2026-11-02T16:57:22Z | M2, M4, M6 | QUALITY BAR REFINED | Local DB has 3 legacy users without alumni profiles; do not fabricate consent. M2 must expose `needsConsent` and explicit acceptance; M4 collects consent before legacy profile creation. Whole-system matrix expanded from 9 to 10 cases, including admin bypass. | M2/M3 builders may proceed; M4 gate updated |
| 2026-11-02T17:10:00Z | M2 | READY → BUILDING | Rewrote router against profile-owned schema: status, legacy `acceptConsent`, saveStep1/2/3; `ensureProfile` removed so profile creation is signup-hook or explicit consent only. | Typecheck |
| 2026-11-02T17:20:00Z | M2 | BUILDING → CRITIC | API typecheck clean; added validation enums, year bounds, per-user scoping, and completion precondition so saveStep3 cannot bypass missing fields. | Runtime verification |
| 2026-11-02T17:30:00Z | M4 | BLOCKED → BUILDING | Rebuilt `/onboarding` around server `status`: server-driven step, hydration from saved fields/entries, consent panel, zero-or-many entry editors, await-before-navigate on Finish. | Typecheck then browser |
| 2026-11-02T17:32:00Z | M4 | BUILDING → FIX | Web typecheck: nullable profile in hydration and undeclared `consent` sign-up field. Added profile guard; documented payload cast for the server-consumed consent extension. | Recheck |
| 2026-11-02T17:33:00Z | M5 | READY → BUILDING | Dashboard page no longer server-renders content; client gate shows resume prompt for incomplete alumni and dashboard plus prompt for admins; shared page container added after visual review. | Browser verification |
| 2026-11-02T17:34:00Z | M2, M4 | BUILDING → CRITIC | Stale API process returned `requireProfileId is not defined`; restarted server with current code. Save step 1 then persisted 2020/2024 and advanced to step 2. | Continue matrix |
| 2026-11-02T17:40:00Z | M2, M4, M5 | CRITIC → PASSED | Lead-run matrix: consent blocked client+server; signup persisted server consent; legacy consent created profile; step 1 resumed with saved years; step 2 resumed at first incomplete step; duty+education persisted; Finish reached dashboard; re-sign-in reached dashboard directly; admin bypass showed dashboard+prompt. | M6 |
| 2026-11-02T17:44:00Z | M5 | FIX | Visual gate caught dashboard flush to viewport edge at 1440; wrapped dashboard and onboarding pages in the shared `max-w-6xl px-4 py-16` container. Rechecked 1440/390 and light/dark. | M6 |
| 2026-11-02T17:48:00Z | M6 | READY → CRITIC | All 10 cases exercised, including API-level zero-entry completion (`completed: true`, empty arrays). `pnpm check-types` 6/6, `pnpm build` 2/2, `pnpm lint` only pre-existing empty-export warning. Test accounts removed; local DB restored to 3 original users, 0 profiles. | Fresh code-reviewer |
| 2026-11-02T17:49:02Z | M6 | CRITIC | Independent review dispatched on the exact §3.1 file set; awaiting verdict before whole-system PASS. | Await critic |
| 2026-11-02T19:32:29Z | M2, M4, M6 | CRITIC → FIX | Fresh whole-system critic FAIL: country options cover only 12 codes and API accepts any uppercase pair; legacy acceptance can persist a name outside 2–120. Red API tests reproduce invalid 1/121 names, ignored correction input, and acceptance of `ZZ`/`UK`/`XK`. | Repair M2/M4 |
| 2026-11-02T19:32:29Z | M5 | PASSED → BLOCKED | M2 API changed after its dependent dashboard verification; preserve earlier evidence but revalidate after M2/M4 pass. | Wait for M2/M4 |
| 2026-11-02T20:00:02Z | M2, M4 | FIX → CRITIC | API enforces trimmed 2–120 legacy names and 248 official alpha-2 country codes; consent transaction updates account/profile names together. Tests 16/16; typecheck 6/6. Browser verified consent correction+session refresh, searchable country, mobile/desktop light/dark. | Fresh M2/M4 critic |
| 2026-11-02T20:00:02Z | M5 | BLOCKED | Revalidated with current API: incomplete dashboard shows resume-only state; Step 2 `CA/Toronto` persisted; zero-entry Finish reaches dashboard. Remains blocked until M2 critic PASS. | Await M2 critic |
| 2026-11-02T20:00:02Z | M6 | FIX → BLOCKED | Lead verification complete; `pnpm build` passed after transient TypeScript worker OOM; lint retains existing warning. Prior failure remains historical; do not close without fresh independent review. | Dispatch critic sequence |
| 2026-11-02T20:01:44Z | M6 | TEST DATA CLEANED | Removed only the uniquely named QA account and its related records. Local DB restored to 3 users, 0 profiles, 0 duties, 0 education rows. | Await M2/M4 critic |
| 2026-11-02T20:05:48Z | M2, M4 | CRITIC → PASSED | Independent critic PASS: all consent, 2–120 name, account/profile consistency, ISO membership, searchable picker, and onboarding behavior criteria passed; no fixes required. | Unlock M5; dispatch fresh M6 critic |
| 2026-11-02T20:05:48Z | M5 | BLOCKED → CRITIC | M2 prerequisite critic PASS recorded. Lead revalidation had already verified resume-only dashboard and completed zero-entry route against current API. | Fresh whole-system review |
| 2026-11-02T20:05:48Z | M6 | BLOCKED → CRITIC | M1–M4 gates passed; M5 lead proof reconciled; fresh whole-system review dispatched against original 10-case bar. | Await independent verdict |
| 2026-11-02T20:13:09Z | M5 | CRITIC → PASSED | Fresh whole-system critic accepted resume gate, completed dashboard, and admin bypass criteria against current source and supplied runtime evidence. | M6 whole-system PASS |
| 2026-11-02T20:13:09Z | M6 | CRITIC → PASSED | Fresh independent whole-system critic PASS: all 10 original cases, complete ISO country behavior, type/build/lint gates, and visual evidence supported; no failed criteria, gaps, or fixes. | Run complete |
