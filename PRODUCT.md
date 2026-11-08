# Alumni Network — Product Specification

**Status:** Draft for build - onboarding, roles/access, and auth complete; remaining MVP modules not started (see §0)  
**Owner:** Institution alumni office  
**Last updated:** 3 November 2026  
**Stack:** Next.js web app, Hono + tRPC API, Drizzle + SQLite, Better Auth, Bun (existing scaffold)

Alumni Network is a private registry for one institution. Alumni create an account, record where they are and what they have done since campus, and return to keep that record current. Administrators read the full record set, publish events and updates, and produce reports from live data instead of scattered spreadsheets.

The product has one hard boundary: an alumnus sees only their own record. There is no peer directory. Administrators see everything.

---

## 0. Build status

Last audited: 3 November 2026 against the current codebase.

Legend: **Done** = implemented and verified; **Partial** = implemented in part, with the remainder named; **Not started** = no implementation.

| Area | Status | Working now | Left |
|---|---|---|---|
| Auth and account | Done | Sign up with consent, sign in, sign out, server-side consent and name checks, account deletion, `ADMIN_EMAILS` bootstrap, change password, change email, `/settings/account`, closed sign-ups, allowed-domain allowlist, `/admin/settings/auth` | Password reset is unavailable by design until a transactional email provider exists (§4.1); email change is unverified for the same reason |
| Roles and access | Done | Server-enforced roles, admin access screen, promote/demote, deactivate/reactivate, last-admin guard | None for the MVP role matrix |
| Onboarding | Done | Three steps, per-step save, resume at first incomplete step, explicit consent, searchable ISO country picker, duties and education, zero-entry finish, dashboard gate | None |
| Profile | Partial | Record storage, duties, education, onboarding capture | Profile view (`/profile`), full editor (`/settings/profile`), completeness meter |
| Dashboard | Partial | Greeting, onboarding gate, admin incomplete prompt | Record summary, latest events, quick actions, admin links |
| Events and updates | Not started | — | Admin CRUD, draft/publish, alumni list and detail |
| Alumni records (admin) | Not started | — | Search, filters, sort, pagination, detail, export |
| Reports (admin) | Not started | — | KPIs, seven charts, filters, exports, print, presentation |
| Settings | Partial | `/admin/access` for roles and deactivation; `/admin/settings/auth` for sign-ups and the domain allowlist; `app_setting` store | `/settings/profile` editor, Organization tab, other module settings |
| Data model | Partial | `alumnus_profile`, `duty`, `education`, `app_setting` with indexes and cascades | `event` |

---

## 1. Product summary

### Problem

The alumni office cannot answer basic questions: how many alumni are reachable, where they live, what they do, and who held religious or political duties on campus. Answers live in old spreadsheets, chat groups, and personal contacts. Every report becomes a manual collection exercise, and the data is stale before it is finished.

### One-liner

A self-service alumni record that administrators can filter, report on, and export.

### Goals

1. Every alumnus maintains one accurate record, entered during sign-up and editable later. — **Partial** (entered at sign-up; editing not built)
2. Administrators can find any alumnus and see a complete profile in one place. — **Not started**
3. Reports answer location, work, education, and duty questions without manual spreadsheet work. — **Not started**
4. Each module can be configured or switched off without code changes. — **Not started**

### Non-goals

- Alumni-to-alumni discovery, messaging, or networking.
- Public profiles or a public alumni directory.
- Payments, donations, job boards, or event ticketing.
- Multi-institution or multi-campus tenancy.

### Product success

An alumnus signs up and completes a record in under four minutes, then returns to update it without help. An administrator filters records and exports a CSV in under one minute. No alumnus can reach another alumnus's data through the UI or the API.

---

## 2. Roles and permissions

**Build status:** **Done** for roles, deactivation, and the last-admin guard — server-enforced, verified 20/20 against the role/deactivation/last-admin matrix (`gauntlet-progress.md`). Password reset is deliberately unavailable (§4.1) because no transactional email provider is configured; the sign-in screen says so instead of offering a dead form.

Three access levels exist. Roles are stored on the user and enforced server-side on every procedure. Hiding a button is presentation, never security.

| Capability | Visitor | Alumnus | Admin |
|---|---|---|---|
| Create account, sign in, reset password | Yes | Yes | Yes |
| Complete onboarding | — | Yes | Optional |
| View and edit own profile | — | Yes | Yes |
| View all alumni records | No | No | Yes |
| Export records | No | No | Yes |
| Read published events | No | Yes | Yes |
| Create, edit, publish, delete events | No | No | Yes |
| View reports | No | No | Yes |
| Change module settings | No | No | Yes |
| Edit organization details | No | No | Yes |
| Assign or remove admin role | No | No | Yes |
| Deactivate an account | No | No | Yes |
| Delete own account | — | Yes | Yes, unless last admin |

**Role rules**

- New accounts receive `alumnus`. The first administrator is granted by matching `ADMIN_EMAILS` at sign-up or sign-in; there is no self-service promotion path.
- An admin may also hold an alumni profile. Admins are not forced through onboarding.
- The last remaining admin cannot be demoted, deactivated, or deleted. The UI disables the action and the server rejects it.
- Deactivating an account blocks sign-in and hides the record from default record lists and reports. Data is retained and reactivation restores access.

**Access principles**

- Alumni own their record. Admins read and export it; admins do not edit alumnus-entered fields. Corrections come from the alumnus.
- Every record read, export, and settings write is authorized on the server.
- Deleted accounts cascade to profile, duties, and education. Authored events remain with a null author.

---

## 3. Core journeys

### 3.1 First visit and sign-up

**Build status: Done** — fresh whole-system critic PASS on 3 November 2026.

1. Visitor opens `/`, sees the organization logo and name, a short description, and Sign in / Create account.
2. Visitor creates an account with full name, email, password, and a consent checkbox for storing the record.
3. Account is created and the user enters `/onboarding`.
4. Step 1, Identity and campus: full name (prefilled), optional phone, campus start year, campus end year.
5. Step 2, Location and work: country, city, region, work status, professional title, employer, short bio.
6. Step 3, Duties and education: add zero or more duty entries and zero or more education entries.
7. Finish sends the user to `/dashboard`.

City, region, professional title, and employer suggest values other alumni already entered. The browser filters on the characters typed and a click fills the field; choosing a known city also fills its region when the region is still empty. Suggestions never overwrite what the person typed.

Each step saves on Continue, so an abandoned onboarding resumes at the first incomplete step on the next sign-in. The dashboard appears only after Step 3 is submitted; a user who abandons earlier sees the resume prompt instead.

**Done when:** a new alumnus reaches the dashboard with a saved profile, and signing out and back in returns to the same state.

### 3.2 Return visit

**Build status: Partial** — sign-in routing and resume are done; dashboard content is not.

1. Alumnus signs in at `/sign-in`.
2. A completed profile lands on `/dashboard`; an unfinished one resumes at `/onboarding`, at the first incomplete step.
3. Dashboard loads with greeting, record summary, and the three latest published events.

**Done when:** sign-in lands on the dashboard or the resume step in one step, with no re-entry of profile data.

### 3.3 Profile edit

**Build status: Not started.**

1. Alumnus opens `/profile` and selects Edit, or uses the dashboard action.
2. `/settings/profile` shows the same fields and entry editors as onboarding, in one page.
3. Save validates, persists, and recalculates completeness.
4. The profile view reflects the change immediately.

**Done when:** every editable field, duty, and education entry can be changed or removed, and the profile view matches.

### 3.4 Admin record review

**Build status: Not started.**

1. Admin opens `/admin/alumni`.
2. Search or filter by country, campus year range, work status, education level, or duty type.
3. Admin opens a row and reads the full record and account metadata.
4. Admin exports the current filtered set as CSV.

**Done when:** the filtered count on screen equals the exported row count.

### 3.5 Event publish

**Build status: Not started.**

1. Admin opens `/admin/events` and creates an event or update.
2. Admin saves a draft, previews it, then publishes.
3. Alumni see the item under `/events` and on the dashboard.

**Done when:** a published item is visible to alumni and a draft is not.

### 3.6 Report

**Build status: Not started.**

1. Admin opens `/admin/reports`.
2. Default view shows all records with all-time totals.
3. Admin narrows filters; KPIs, charts, and the preview table update together.
4. Admin exports records or aggregates, or prints the report.

**Done when:** every panel respects the active filters and the export matches the screen.

---

## 4. Modules

Seven modules. Each has a single job, a clear owner, and a settings entry.

### 4.1 Auth and Account

**Build status: Done.** Verified 3 November 2026 against the running API and web app: 21/21 runtime checks covering closed sign-ups (403), domain rejection (400), allowlist normalisation, admin-only writes (403 for an alumnus), password change, old-password rejection, email change, sign-in under the new email, old-email rejection, and account deletion with profile cascade; plus 14/14 page checks covering `/settings/account` and `/admin/settings/auth` rendering for an admin, both redirecting an anonymous visitor to `/login`, and both reset screens explaining the missing provider. Password reset delivery and verified email change are excluded by design until an email provider exists.

**Purpose:** get the right person into the right account.

**Features:** sign up, sign in, sign out, forgot password, reset password, change email, change password, delete account, admin deactivation, role assignment.

**Rules**

- Email is unique and stored lowercase; duplicate sign-up returns a field error, not a server error.
- Password minimum 8 characters. Better Auth handles hashing and sessions.
- Password reset uses a single-use emailed link valid for 30 minutes. This requires a configured transactional email provider; without one, reset is unavailable. `/forgot-password` and `/reset-password` explain that no provider is configured and send the person back to sign in, rather than offering a form that cannot work.
- Email verification is not required in the MVP. Changing email therefore applies without proving the new address; the screen warns about that and revokes every other session so a hijacked session cannot quietly move the account.
- Changing the password also revokes other sessions.
- Sign-ups can be closed by setting (§7.3). Existing users still sign in, and the `ADMIN_EMAILS` bootstrap account still gets in, so the office cannot lock itself out.
- Optional allowed-email-domain list restricts new sign-ups only (§7.3). Domains are normalised to lowercase with any leading `@` stripped, and an invalid entry is rejected when the admin saves it.
- Account deletion requires explicit confirmation and revokes all sessions. Events authored by a deleted admin keep their content with a null author.
- Deactivation blocks sign-in immediately and keeps all data.

**Screens:** `/login` (one screen that holds sign-in and, while sign-ups are open, sign-up), `/forgot-password`, `/reset-password`, `/settings/account`.

### 4.2 Profile

**Build status: Partial.** Done: onboarding capture, repeatable duties and education, entry rules, country picker. Left: `/profile` view, `/settings/profile` editor, completeness meter.

**Purpose:** hold the single authoritative record of each alumnus.

**Features:** profile view, profile editor, onboarding wizard, repeatable duty entries, repeatable education entries, completeness meter.

**Profile view** shows an initials avatar, full name, professional title, current location, campus years, work status, employer, bio, duties grouped by type, education ordered by level, and the completeness indicator.

**Duties** are repeatable entries with type (religious, political, other), title, organization, start year, optional end year, and optional description. A null end year means ongoing. Display order is newest start year first.

**Education** entries have level (secondary, certificate, diploma, bachelor, master, doctorate, other), program, institution, year completed, and optional description. Display order is highest level first, then newest year.

**Completeness** counts required fields only: full name, campus start year, campus end year, country, city, work status, and professional title when work status is employed or self-employed. Duties, education, phone, region, employer, and bio are optional. The meter shows the percentage and names the missing required fields.

**Rules**

- One profile per user, created at sign-up. Fields may be empty during onboarding; required fields are enforced when onboarding completes.
- Campus years must be four-digit years between 1950 and the current year, and the end year must not precede the start year.
- Country is a searchable ISO 3166-1 alpha-2 select. City and region are free text, 2–80 characters.
- Entry limits come from module settings, default 10 duties and 10 education entries.
- Profile text is plain text, escaped on render. Bio is limited to 300 characters.
- Editing can be disabled by module setting; onboarding and completion remain allowed so new users are never locked out.

**Screens:** `/profile`, `/settings/profile`, `/onboarding`.

### 4.3 Dashboard

**Build status: Partial.** Done: greeting, onboarding gate, resume prompt, admin incomplete-record prompt. Left: record summary, latest events, quick actions, admin links, empty states for events.

**Purpose:** give the alumnus one clear starting point.

**Features**

- Greeting using the first name.
- Record summary: title, location, campus years, work status.
- Record status: complete, or a prompt to finish onboarding for an admin who skipped it.
- The three latest published events or updates, with a link to all events.
- Quick actions: Edit profile, View events, Settings.
- Admins additionally see links to Alumni Records, Reports, and Event management.

The dashboard shows no peer data and no institution-wide statistics. Those belong to Reports and are admin-only.

**Empty states:** no events yet shows "No updates yet"; a missing profile shows a prompt to create one.

**Screen:** `/dashboard`.

### 4.4 Events and Updates

**Build status: Not started.**

**Purpose:** keep alumni informed through one trusted channel.

**Alumni features**

- `/events` lists published items in two tabs: Upcoming and Past.
- Cards show title, category badge (Event or Update), start date, and location or Online.
- `/events/[id]` shows cover image, title, metadata, and rendered body.
- Past events appear only when the module setting allows it.

**Admin features**

- `/admin/events` table with search, status filter, and category filter.
- Create and edit form with live preview.
- Draft, publish, unpublish, and delete actions.
- Publishing requires title, summary, body, and start date. Drafts may lack summary, body, and start date.
- Unpublishing returns the item to draft and hides it from alumni immediately.

**Rules**

- Title 3–140 characters, summary up to 160, body up to 20,000 characters of Markdown.
- `ends_at`, when present, must not precede `starts_at`.
- Times are stored in UTC and displayed in the organization timezone setting.
- Cover images are external HTTPS URLs. No file upload in the MVP.
- Markdown is sanitized before render; links are limited to http and https.
- Deleting an event is permanent and confirmed.

**Screens:** `/events`, `/events/[id]`, `/admin/events`, `/admin/events/new`, `/admin/events/[id]`.

### 4.5 Alumni Records (admin)

**Build status: Not started.**

**Purpose:** let the alumni office find and read any record.

**Features**

- Table columns: name, campus years, location, work status, professional title, updated date, account status.
- Search across name, email, city, employer, and professional title, debounced at 300 ms.
- Filters: country, campus year range, work status, education level, duty type.
- Sort by name, campus end year, or last updated.
- Pagination at 25 rows.
- Detail view with the full profile, account email, sign-up date, last active date, and status.
- Admin actions: deactivate or reactivate the account.
- Export the current filtered set as CSV, when export is enabled.

Admins cannot edit alumnus-entered fields. The detail view offers no inline editing; corrections are requested from the alumnus.

**Rules**

- Deactivated accounts are hidden by default and revealed by the status filter.
- Profiles that have not completed onboarding appear with an Incomplete badge and are counted as incomplete in reports.
- Phone numbers are visible in the detail view but excluded from CSV unless the export setting enables them.
- A record deleted while an admin has it open returns a not-found state on the next action.

**Screens:** `/admin/alumni`, `/admin/alumni/[id]`.

### 4.6 Reports (admin)

**Build status: Not started.**

**Purpose:** turn live records into a defensible picture for leadership.

Specified in §8. This module owns `/admin/reports` and both CSV exports. It is read-only; no report is stored.

### 4.7 Settings

**Build status: Partial.** Done: `/admin/access` role and deactivation management, `/admin/settings/auth`, `/settings/account`, and the `app_setting` store with server-side validation. Left: `/settings/profile` editor, Organization tab, and the remaining module settings.

**Purpose:** give alumni control of their account and give admins control of each module.

Settings has two scopes. Alumni see Profile and Account. Admins additionally see a configuration area with Organization, Auth, Profile, Events, Records, Reports, and Access tabs.

**Profile settings (all users)**

- `/settings/profile` is the full record editor, shared with onboarding.
- `/settings/account` is live: change email, change password, sign out, and delete the account by typing the email to confirm.
- No per-module user preferences exist in the MVP.

**Admin settings**

- Organization tab: name, short name, description, logo, contact details, address, home country, timezone.
- Auth tab is live at `/admin/settings/auth`: one switch for new sign-ups and a comma-separated email-domain allowlist, saved as one section.
- Remaining tabs: Profile, Events, Records, Reports, Access.
- Each section saves as a unit with validation and a confirmation toast.
- Disabling a module hides its navigation and returns not-found for its routes. Data is retained and returns when re-enabled.
- The Settings area remains reachable by admins even when every module is disabled.
- Access tab lists current admins, promotes an alumnus by email, and demotes admins with the last-admin guard.

**Screens:** `/settings/profile`, `/settings/account`, `/admin/settings`, `/admin/settings/[module]`.

---

## 5. Data model

Five domain tables plus the Better Auth tables (`user`, `session`, `account`, `verification`), which Better Auth owns. The admin plugin adds `role`, `banned`, `banReason`, and `banExpires` to `user`; the default role is `alumnus`.

**Build status: Partial.** Done: `alumnus_profile`, `duty`, `education`, `app_setting` with the listed columns, indexes, cascades, and enums. Not started: `event`.

```text
alumnus_profile
  id                      text primary key
  user_id                 text unique not null -> user.id (cascade delete)
  full_name               text not null
  phone                   text null
  campus_start_year       integer null
  campus_end_year         integer null
  city                    text null
  region                  text null
  country_code            text null          ISO 3166-1 alpha-2
  work_status             text null          enum
  professional_title      text null          required when employed or self-employed
  employer                text null
  bio                     text null          max 300
  consent_at              integer not null   set at sign-up
  onboarding_completed_at integer null
  created_at              integer not null   epoch milliseconds
  updated_at              integer not null

duty
  id              text primary key
  profile_id      text not null -> alumnus_profile.id (cascade delete)
  type            text not null          religious | political | other
  title           text not null
  organization    text not null
  start_year      integer not null
  end_year        integer null           null means ongoing
  description     text null
  sort_order      integer not null

education
  id              text primary key
  profile_id      text not null -> alumnus_profile.id (cascade delete)
  level           text not null          secondary | certificate | diploma | bachelor | master | doctorate | other
  program         text not null
  institution     text not null
  year_completed  integer not null
  description     text null
  sort_order      integer not null

event
  id              text primary key
  title           text not null
  summary         text not null default ''
  body            text not null default ''
  category        text not null          event | update
  starts_at       integer not null
  ends_at         integer null
  location        text null
  is_online       integer not null       boolean, default 0
  cover_image_url text null
  status          text not null          draft | published
  published_at    integer null
  created_by      text null -> user.id (set null on delete)
  created_at      integer not null
  updated_at      integer not null

app_setting
  key        text primary key
  value      text not null     plain text: "true"/"false" or a comma-separated list
  updated_by text null -> user.id (set null on delete)
  updated_at integer not null
```

Profile columns stay nullable while onboarding is in progress; the required fields are enforced when `onboarding_completed_at` is set. Event `summary` and `body` default to empty strings so drafts can be saved incomplete; publishing enforces their content.

**Enums**

- `work_status`: `employed`, `self_employed`, `student`, `unemployed`, `retired`, `other`.
- `duty.type`: `religious`, `political`, `other`.
- `education.level`: `secondary`, `certificate`, `diploma`, `bachelor`, `master`, `doctorate`, `other`.
- `event.category`: `event`, `update`.
- `event.status`: `draft`, `published`.

**Indexes**

`user.email` unique; `alumnus_profile.country_code`, `work_status`, `campus_end_year`, `updated_at`; `duty.profile_id`, `duty.type`; `education.profile_id`, `education.level`; `event(status, starts_at)`.

**Derived values, never stored**

Completeness percentage, highest education level, abroad flag, report aggregates. They are computed at read time so edits cannot leave stale numbers.

**Why duties and education are separate tables**

Both are repeatable and both feed reports. Storing them as JSON on the profile would make duty-type and education-level filters and counts unreliable.

---

## 6. Routes

| Route | Access | Purpose | Build status |
|---|---|---|---|
| `/` | Public | Landing page, sign-in and sign-up entry | Done |
| `/login` | Public | Sign in; sign up when sign-ups are open | Done |
| `/forgot-password` | Public | Explains that reset needs an email provider, and links back | Done |
| `/reset-password` | Public | Explains that no reset link is ever issued, and links back | Done |
| `/onboarding` | Alumnus, Admin | Three-step profile collection | Done |
| `/dashboard` | Signed in | Personal summary and latest updates | Partial — gate and greeting only |
| `/profile` | Signed in | View own record | Not started |
| `/events` | Signed in | Published events and updates | Not started |
| `/events/[id]` | Signed in | Event detail | Not started |
| `/settings/profile` | Signed in | Edit own record | Not started |
| `/settings/account` | Signed in | Email, password, sign out, deletion | Done |
| `/admin/alumni` | Admin | Record table, search, export | Not started |
| `/admin/alumni/[id]` | Admin | Full record and account actions | Not started |
| `/admin/events` | Admin | Event table | Not started |
| `/admin/events/new` | Admin | Create event | Not started |
| `/admin/events/[id]` | Admin | Edit, publish, delete | Not started |
| `/admin/reports` | Admin | Report mode | Not started |
| `/admin/settings` | Admin | Redirects to Organization | Not started |
| `/admin/settings/[module]` | Admin | Organization and module configuration; `auth` is live, the rest are not started | Partial |
| `/admin` | Admin | Redirects to `/admin/alumni` | Not started |

A signed-in alumnus who opens an admin route receives not-found, not a redirect that reveals the route exists.

**Implemented outside this table:** `/admin/access` exists for role assignment, deactivation, and reactivation, and `/admin/settings/auth` is the Auth settings screen; the spec folds both into Settings → Access and Settings → Auth.

---

## 7. Settings

**Build status: Partial.** Done: `app_setting` with server-side validation and admin-only writes, `/admin/access` for roles and deactivation with the last-admin guard, `/admin/settings/auth`, and `/settings/account`. Left: the Organization tab and the remaining module settings.

### 7.1 Profile settings

| Area | What the user can do |
|---|---|
| Profile | Edit name, phone, campus years, location, work, bio, duties, and education; see completeness |
| Account | Change email, change password, sign out, delete account |

Name and phone live in the profile editor, not duplicated in Account. Email and password live in Account. Account deletion requires typing the account email and confirming; it revokes sessions and cascades the record.

### 7.2 Organization settings (admin)

The Organization tab defines who alumni are signing up to. These values are public-facing and must not contain alumnus personal data. They are stored in `app_setting` under the `organization.*` namespace and saved as one section.

| Setting | Default | Appears in | Rule |
|---|---|---|---|
| `organization.name` | `Alumni Network` | Landing page, app header, auth screens, report header, page titles | 2–120 characters, required |
| `organization.short_name` | empty | Compact and mobile header, logo fallback | 2–20 characters, optional |
| `organization.description` | empty | Landing page under the name | Up to 500 characters, plain text |
| `organization.logo_url` | empty | Landing page, app header, report header | HTTPS URL, up to 500 characters |
| `organization.contact_email` | empty | Landing footer, report footer | Valid email, up to 254 characters |
| `organization.contact_phone` | empty | Landing footer, report footer | 7–20 characters, optional |
| `organization.website_url` | empty | Landing footer, header link | HTTPS URL, up to 300 characters |
| `organization.address` | empty | Landing footer, report footer | Up to 300 characters, multiline |
| `organization.home_country` | none | Abroad metric | ISO 3166-1 alpha-2 |
| `organization.timezone` | `UTC` | Event times, report timestamp | Valid IANA timezone |

**Behavior**

- Name is the only required value. Empty optional values fall back to their defaults and hide their block instead of rendering a placeholder.
- Values are validated server-side; an invalid field blocks the section save.
- The logo is an external HTTPS URL, consistent with event covers; no upload in the MVP. A missing or broken logo falls back to a monogram from the short name, or the first letters of the name.
- Description and address render as plain text with line breaks preserved and HTML escaped.
- Contact email and phone are the public alumni-office contacts, separate from any admin account email.
- Changes save as one section and apply on the next request.

### 7.3 Module settings (admin)

All module keys are stored in `app_setting`, validated server-side, and written by admins only.

**Live now:** `auth.signups_open` and `auth.allowed_email_domains`, read and written by `packages/db/src/settings.ts` and edited at `/admin/settings/auth`. Every other key in the table is specified, not yet implemented.

| Key | Default | Effect |
|---|---|---|
| `auth.signups_open` | `true` | When false, new sign-ups are rejected; sign-in still works. **Live.** |
| `auth.allowed_email_domains` | empty | Empty allows any email; otherwise a comma-separated allowlist for new sign-ups. **Live.** |
| `profile.allow_edits` | `true` | When false, the editor is read-only after onboarding; onboarding itself is never blocked |
| `profile.max_duties` | `10` | Maximum duty entries per alumnus |
| `profile.max_education` | `10` | Maximum education entries per alumnus |
| `profile.allow_account_deletion` | `true` | Shows or hides the deletion action |
| `events.module_enabled` | `true` | Nav visibility and route availability |
| `events.show_past_events` | `true` | Past tab on the alumni event list |
| `records.module_enabled` | `true` | Admin records nav and routes |
| `records.export_enabled` | `true` | Records CSV button and endpoint |
| `records.include_phone_in_export` | `false` | Adds the phone column to records CSV |
| `reports.module_enabled` | `true` | Admin reports nav and routes |
| `reports.top_n` | `10` | Number of bars or slices before grouping into Other |
| `reports.export_enabled` | `true` | Both report CSV buttons and endpoints |

**Settings rules**

- Unknown keys are rejected; values are type-checked against the key's schema.
- A disabled module hides navigation and returns not-found for its routes, but keeps its data and its settings tab.
- Changes apply on the next request; no restart and no cache flush.
- The last admin cannot be removed through the Access tab.
- Settings changes are not audited in the MVP; Phase 2 adds an audit log.

---

## 8. Report mode

**Build status: Not started.**

Report mode is the admin surface at `/admin/reports`. It is a single, filter-driven view: every KPI, chart, table, and export reflects the same active filters.

### 8.1 Layout

1. Header: organization name and logo, generated timestamp, active filter summary, Reset filters.
2. KPI row: five cards.
3. Chart grid: seven panels, two columns on desktop, one on mobile.
4. Preview table: the first 10 filtered records.
5. Actions: Export records CSV, Export aggregates CSV, Print, Presentation toggle.
6. Footer: organization name and public contact details, with a page number when printed.

Presentation toggle hides admin navigation and page chrome for screen sharing and printing. Print uses A4 portrait with a repeated header and the active filters printed above the charts.

### 8.2 Metrics

| Metric | Definition |
|---|---|
| Total alumni | Profiles matching the filters, excluding deactivated accounts |
| Complete profiles | Share of matching profiles with every required field filled |
| Employed | Share with work status employed or self-employed |
| Abroad | Share whose country differs from `organization.home_country`; hidden with a setup note when no home country is set |
| New alumni (30 days) | Count of matching profiles created in the last 30 days; the card labels the window |
| Country distribution | Count by country, top N plus Other |
| City distribution | Count by city within the filtered set, top N plus Other |
| Campus year distribution | Count by campus end year |
| Work status distribution | Count per work status enum |
| Highest education | Per alumnus, the highest ranked level: secondary 1, certificate 2, diploma 3, bachelor 4, master 5, doctorate 6; entries at level other are excluded from the ranking, and an alumnus with no ranked entry is Not recorded |
| Top professional titles | Exact-match counts, top N plus Other; free-text limitation is stated on screen |
| Duty participation | Alumni with at least one duty of each type; an alumnus can count in more than one type |

All percentages use the filtered total as the denominator and are rounded to one decimal.

### 8.3 Filters

- Campus year range: from and to, inclusive.
- Country: single select, All by default.
- Work status: single select, All by default.
- Education level: single select, All by default.
- Duty type: single select, All by default.
- Reset filters clears the campus year range and returns every select to All.

Filters combine with AND. The record table and both exports use the same predicate as the metrics.

### 8.4 Exports

**Records CSV** columns: Full name, Email, Phone (only when enabled), Campus start, Campus end, City, Region, Country, Work status, Professional title, Employer, Bio, Duties, Education, Signed up, Updated. Dates use ISO 8601 (`YYYY-MM-DD`); country is the display name.

Duties are joined as `type: title, organization (start–end)` and education as `level: program, institution (year)`, separated by semicolons within a quoted cell.

**Aggregates CSV** columns: Metric, Dimension, Count, Percentage.

**Export rules**

- Filename: `alumni-records-YYYY-MM-DD.csv` and `alumni-aggregates-YYYY-MM-DD.csv`.
- UTF-8 with BOM, RFC 4180 quoting, CRLF line endings, for Excel compatibility.
- Cells starting with `=`, `+`, `-`, or `@` are prefixed with an apostrophe to prevent spreadsheet formula injection.
- Streamed response; no file is stored on the server.
- Export respects the active filters and the export settings.
- When export is disabled, the buttons are hidden and the endpoint rejects the request.

### 8.5 Edge cases

- Zero matching records: KPIs show zero, charts show "No data for these filters", export is disabled.
- Home country unset: the Abroad card shows "Set home country in Settings" and no percentage.
- One record: charts render a single bar or slice without percentage labels below 2%.
- Long free-text titles: the top-N list groups the tail into Other.
- Large data sets: aggregates run in SQL; the on-screen table is capped at 10 rows.

---

## 9. Validation and edge cases

**Build status: Partial.** Profile, onboarding, duty, education, and account rules are enforced server-side. Event rules are not applicable yet because events are not built. Rate limiting (§9.4) is not implemented.

### 9.1 Field rules

| Field | Rule |
|---|---|
| Full name | 2–120 characters, required |
| Email | Valid address, unique, lowercase, required |
| Password | Minimum 8 characters, required |
| Phone | Optional, 7–20 characters, digits with optional leading `+` and spaces |
| Campus start / end year | Four-digit year, 1950 to current year; end not before start |
| Country | Required ISO 3166-1 alpha-2 code |
| City, region | 2–80 characters; city required, region optional |
| Work status | Required enum value |
| Professional title | Required when employed or self-employed; 2–120 characters otherwise optional |
| Employer | Optional, up to 120 characters |
| Bio | Optional, up to 300 characters |
| Duty title, organization | Required, up to 120 characters each |
| Duty years | Start required; end optional; end not before start; neither after current year |
| Education program, institution | Required, up to 120 characters each |
| Year completed | Required, 1950 to current year |
| Event title | 3–140 characters |
| Event summary | Required to publish, up to 160 characters |
| Event body | Required to publish, up to 20,000 characters |
| Event times | Start required to publish; end not before start |
| Cover image URL | Optional, HTTPS only |

Errors appear inline under the field, the submit is blocked, and the server repeats the validation on every write. Client validation never replaces server validation.

### 9.2 Account edge cases

- Duplicate email at sign-up: field error, no account created.
- Sign-ups closed: the form is replaced with a closed notice; direct API calls are rejected.
- Banned user signs in: generic invalid-credentials message, no data shown.
- Last admin attempts demotion or deletion: action disabled and rejected.
- Admin deletes own account while other admins exist: allowed, authored events keep a null author.
- Password reset for an unknown email: same confirmation message as a known email.

### 9.3 Data edge cases

- Profile deleted while open in an admin tab: next action returns not-found.
- Concurrent edits to one profile: last write wins; only the owner can edit, so conflicts are self-inflicted.
- Onboarding abandoned: steps already saved remain; resume at the first incomplete step.
- Module disabled with data present: data is untouched; routes return not-found until re-enabled.
- Event unpublish while an alumnus has it open: next request returns not-found.
- Timezone: all timestamps stored in UTC; only display uses the organization timezone.

### 9.4 Security boundaries

- Markdown sanitized on render; raw HTML never rendered.
- Profile text escaped; no user content interpolated into SQL or HTML.
- External URLs limited to HTTPS for cover images and http/https for body links.
- Rate limiting on sign-in, sign-up, and password reset.
- No PII in application logs.

---

## 10. Non-functional requirements

**Build status: Partial.** Verified on built screens: responsive layout at 390 px and 1440 px, light and dark themes, labelled inputs and keyboard-operable controls. Not verified or not built: 10,000-profile performance targets, rate limits, daily backups, and browser matrix.

**Responsive.** Usable from 360 px to desktop. Tables become stacked cards on small screens; forms stay single-column.

**Accessibility.** WCAG 2.1 AA: labelled inputs, visible focus, keyboard-operable dialogs and menus, 4.5:1 text contrast, no motion-only feedback.

**Theme.** Light and dark using the existing theme provider.

**Performance.** Dashboard p95 under 1.5 s locally. Record search under 500 ms at 10,000 profiles. Report aggregates under 2 s at 10,000 profiles. Pagination on every list.

**Security.** Server-side authorization on every procedure, httpOnly session cookies, CSRF protection from Better Auth, password hashing, rate limits on auth routes, no PII in logs.

**Privacy.** Admin-only record access. Phone excluded from bulk exports by default. Account deletion cascades. Duty data (religious or political) is treated as sensitive: never public, visible only to admins and included in admin exports.

**Reliability.** SQLite with a daily backup of the database file. Migrations are additive and reversible where possible.

**Browsers.** Latest two versions of Chrome, Edge, Firefox, and Safari.

**Language.** English only in the MVP.

---

## 11. MVP scope and phases

### Phase 1 — ship

1. Auth: sign-up, sign-in, sign-out, password reset, email and password change, account deletion, roles, admin deactivation. — **Partial** (password reset, email change, and password change missing)
2. Onboarding: three steps with per-step save and resume. — **Done**
3. Profile: view, edit, duties, education, completeness. — **Partial** (view, edit, and completeness missing)
4. Dashboard with events and quick actions. — **Partial** (events and quick actions missing)
5. Events: admin CRUD, draft and publish, alumni list and detail. — **Not started**
6. Alumni Records: search, filters, sort, pagination, detail, deactivate, CSV export. — **Not started**
7. Reports: KPIs, seven charts, filters, records and aggregates CSV, print, presentation toggle. — **Not started**
8. Settings: profile, account, seven admin tabs including Organization, role management. — **Partial** (role management only)
9. Grant the first admin from `ADMIN_EMAILS` at sign-up or sign-in. — **Done**

### Phase 2

- Audit log for admin actions.
- Email notifications for new events.
- Event RSVP and attendance.
- Bulk CSV import of legacy alumni records.
- Profile photo upload.
- Saved report presets.
- Public aggregate statistics page.

### Out of scope

Peer directory, alumni messaging, donations or payments, job board, event ticketing, multi-institution support, native mobile apps, email campaigns, custom branding beyond the organization name, logo, and description.

---

## 12. Success metrics

**Build status: Not measurable yet.** Reports and admin record search do not exist; the zero cross-account leak target is verified for the role matrix.

| Metric | Target |
|---|---|
| Sign-up to completed onboarding | 70% or more |
| Median onboarding time | Under 4 minutes |
| Records at 100% completeness | 90% of active alumni |
| Admin time to filtered CSV | Under 60 seconds |
| Report load at 10,000 records | Under 2 seconds |
| Cross-account data leaks | Zero in permission tests |
| Returning alumni update their record | 30% within 12 months |

---

## 13. Assumptions and open questions

1. **One institution, one campus.** Multi-campus and multi-institution are out of scope. `organization.*` settings control identity and contact details; colors, typography, and layout remain fixed.
2. **Admin-only visibility is confirmed.** Alumni get no peer directory and no public profile. This weakens the alumnus's incentive to register; the value offered is a maintained record plus institutional updates. Revisit after first cohort feedback.
3. **"Report site" means the in-app admin report surface,** not a separate deployable or subdomain.
4. **Email delivery is required for password reset.** A transactional provider must be configured before Phase 1 ships; without it, reset stays hidden and a locked-out alumnus cannot recover the account.
5. **Professional titles are free text.** Report grouping is exact-match, so near-duplicates split counts. A controlled vocabulary is a Phase 2 decision.
6. **Duty data is sensitive.** Collecting religious or political roles requires a lawful basis and clear consent; the sign-up checkbox and `consent_at` cover the MVP, but legal review is pending.
7. **No email verification in the MVP.** Fake or mistyped addresses are possible. Enable verification when the email provider is live.
8. **First admin comes from `ADMIN_EMAILS`.** The role is granted on sign-up or sign-in; there is no self-service promotion path.
9. **English only.** No localization in the MVP.
10. **Backups are operational.** Daily SQLite file backup is assumed, not built into the app.
