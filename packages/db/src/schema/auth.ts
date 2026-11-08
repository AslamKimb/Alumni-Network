import { defineRelationsPart, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
  image: text("image"),
  role: text("role").default("alumnus").notNull(),
  deactivatedAt: integer("deactivated_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const alumniProfile = sqliteTable(
  "alumnus_profile",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    campusStartYear: integer("campus_start_year"),
    campusEndYear: integer("campus_end_year"),
    city: text("city"),
    region: text("region"),
    countryCode: text("country_code"),
    workStatus: text("work_status"),
    professionalTitle: text("professional_title"),
    employer: text("employer"),
    bio: text("bio"),
    consentAt: integer("consent_at", { mode: "timestamp_ms" }).notNull(),
    onboardingCompletedAt: integer("onboarding_completed_at", {
      mode: "timestamp_ms",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("alumnus_profile_country_code_idx").on(table.countryCode),
    index("alumnus_profile_work_status_idx").on(table.workStatus),
    index("alumnus_profile_campus_end_year_idx").on(table.campusEndYear),
    index("alumnus_profile_updated_at_idx").on(table.updatedAt),
  ],
);

export const duty = sqliteTable(
  "duty",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    profileId: text("profile_id")
      .notNull()
      .references(() => alumniProfile.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    organization: text("organization").notNull(),
    startYear: integer("start_year").notNull(),
    endYear: integer("end_year"),
    description: text("description"),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    index("duty_profile_id_idx").on(table.profileId),
    index("duty_type_idx").on(table.type),
  ],
);

export const education = sqliteTable(
  "education",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    profileId: text("profile_id")
      .notNull()
      .references(() => alumniProfile.id, { onDelete: "cascade" }),
    level: text("level").notNull(),
    program: text("program").notNull(),
    institution: text("institution").notNull(),
    yearCompleted: integer("year_completed").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    index("education_profile_id_idx").on(table.profileId),
    index("education_level_idx").on(table.level),
  ],
);

export const authRelations = defineRelationsPart(
  { user, session, account, verification, alumniProfile, duty, education },
  (r) => ({
    user: {
      sessions: r.many.session({
        from: r.user.id,
        to: r.session.userId,
      }),
      accounts: r.many.account({
        from: r.user.id,
        to: r.account.userId,
      }),
      alumniProfile: r.one.alumniProfile({
        from: r.user.id,
        to: r.alumniProfile.userId,
      }),
    },
    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
    },
    account: {
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
      }),
    },
    alumniProfile: {
      user: r.one.user({
        from: r.alumniProfile.userId,
        to: r.user.id,
      }),
      duties: r.many.duty({
        from: r.alumniProfile.id,
        to: r.duty.profileId,
      }),
      education: r.many.education({
        from: r.alumniProfile.id,
        to: r.education.profileId,
      }),
    },
    duty: {
      profile: r.one.alumniProfile({
        from: r.duty.profileId,
        to: r.alumniProfile.id,
      }),
    },
    education: {
      profile: r.one.alumniProfile({
        from: r.education.profileId,
        to: r.alumniProfile.id,
      }),
    },
  }),
);
