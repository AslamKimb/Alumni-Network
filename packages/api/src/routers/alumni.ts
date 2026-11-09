import { alumniProfile, duty, education, session, user } from "@Alumni-Network/db/schema/auth";
import { cohort } from "@Alumni-Network/db/schema/cohort";
import { appSetting } from "@Alumni-Network/db/schema/setting";
import type { Database } from "@Alumni-Network/db";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, like, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

import { COUNTRIES } from "../countries";
import { permissionProcedure, router } from "../index";

// No records helper exists in packages/db/src/settings.ts — read the two keys
// directly. Missing rows mean defaults: export on, phone in export off.
const EXPORT_ENABLED_KEY = "records.export_enabled";
const INCLUDE_PHONE_KEY = "records.include_phone_in_export";

const LAST_ADMIN_MESSAGE = "The last remaining admin cannot be demoted, deactivated, or deleted.";

const COUNTRY_NAMES: Map<string, string> = new Map(COUNTRIES.map((c) => [c.code, c.name]));

const workStatuses = ["employed", "self_employed", "student", "unemployed", "retired", "other"] as const;
const dutyTypes = ["religious", "political", "other"] as const;
const educationLevels = [
  "secondary",
  "certificate",
  "diploma",
  "bachelor",
  "master",
  "doctorate",
  "other",
] as const;

const filtersInput = z.object({
  search: z.string().trim().max(200).optional().nullable(),
  country: z.string().length(2).optional().nullable(),
  campusFrom: z.number().int().min(1950).max(2100).optional().nullable(),
  campusTo: z.number().int().min(1950).max(2100).optional().nullable(),
  workStatus: z.enum(workStatuses).optional().nullable(),
  educationLevel: z.enum(educationLevels).optional().nullable(),
  dutyType: z.enum(dutyTypes).optional().nullable(),
  cohortId: z.string().trim().optional().nullable(),
  status: z.enum(["active", "deactivated", "all", "incomplete"]).optional().nullable(),
});

const sortInput = z.enum(["name", "campusEnd", "updated"]).optional().nullable();

const listInput = filtersInput.extend({
  sort: sortInput,
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

type Filters = z.infer<typeof filtersInput>;

async function readRecordsSettings(db: Database) {
  const rows = await db
    .select({ key: appSetting.key, value: appSetting.value })
    .from(appSetting)
    .where(inArray(appSetting.key, [EXPORT_ENABLED_KEY, INCLUDE_PHONE_KEY]));
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    exportEnabled: values.get(EXPORT_ENABLED_KEY) !== "false",
    includePhone: values.get(INCLUDE_PHONE_KEY) === "true",
  };
}

// All filters combine with AND. Deactivated hidden by default; "incomplete"
// keeps them hidden too (use "all" to reveal deactivated records).
async function buildWhere(db: Database, filters: Filters) {
  const conditions = [];

  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${search.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(
      or(
        like(alumniProfile.fullName, pattern),
        like(user.email, pattern),
        like(alumniProfile.city, pattern),
        like(alumniProfile.employer, pattern),
        like(alumniProfile.professionalTitle, pattern),
      ),
    );
  }

  if (filters.country) conditions.push(eq(alumniProfile.countryCode, filters.country));
  // Campus range = overlap of the person's campus years with [from, to].
  if (filters.campusFrom != null) conditions.push(gte(alumniProfile.campusEndYear, filters.campusFrom));
  if (filters.campusTo != null) conditions.push(lte(alumniProfile.campusStartYear, filters.campusTo));
  if (filters.workStatus) conditions.push(eq(alumniProfile.workStatus, filters.workStatus));

  if (filters.cohortId) {
    if (filters.cohortId === "none" || filters.cohortId === "unassigned") {
      conditions.push(
        sql`NOT EXISTS (SELECT 1 FROM ${cohort} WHERE ${alumniProfile.campusEndYear} BETWEEN ${cohort.startYear} AND ${cohort.endYear})`,
      );
    } else {
      const [target] = await db
        .select()
        .from(cohort)
        .where(eq(cohort.id, filters.cohortId))
        .limit(1);
      if (target) {
        conditions.push(
          and(
            gte(alumniProfile.campusEndYear, target.startYear),
            lte(alumniProfile.campusEndYear, target.endYear),
          )!,
        );
      } else {
        // Unknown cohort id -> empty result
        conditions.push(sql`0 = 1`);
      }
    }
  }

  if (filters.educationLevel) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${education} WHERE ${education.profileId} = ${alumniProfile.id} AND ${education.level} = ${filters.educationLevel})`,
    );
  }

  if (filters.dutyType) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${duty} WHERE ${duty.profileId} = ${alumniProfile.id} AND ${duty.type} = ${filters.dutyType})`,
    );
  }

  const status = filters.status ?? "active";
  if (status === "active") {
    conditions.push(isNull(user.deactivatedAt));
  } else if (status === "deactivated") {
    conditions.push(isNotNull(user.deactivatedAt));
  } else if (status === "incomplete") {
    conditions.push(isNull(user.deactivatedAt), isNull(alumniProfile.onboardingCompletedAt));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function orderBy(sort: "name" | "campusEnd" | "updated" | null | undefined) {
  switch (sort) {
    case "name":
      return [asc(alumniProfile.fullName)];
    case "campusEnd":
      return [desc(alumniProfile.campusEndYear), asc(alumniProfile.fullName)];
    case "updated":
    default:
      return [desc(alumniProfile.updatedAt), asc(alumniProfile.fullName)];
  }
}

// Aliases keep the SQL short; map display values after the query.
const rowShape = {
  id: alumniProfile.id,
  userId: alumniProfile.userId,
  fullName: alumniProfile.fullName,
  phone: alumniProfile.phone,
  campusStartYear: alumniProfile.campusStartYear,
  campusEndYear: alumniProfile.campusEndYear,
  city: alumniProfile.city,
  region: alumniProfile.region,
  countryCode: alumniProfile.countryCode,
  workStatus: alumniProfile.workStatus,
  professionalTitle: alumniProfile.professionalTitle,
  employer: alumniProfile.employer,
  bio: alumniProfile.bio,
  email: user.email,
  createdAt: alumniProfile.createdAt,
  updatedAt: alumniProfile.updatedAt,
  onboardingCompletedAt: alumniProfile.onboardingCompletedAt,
  deactivatedAt: user.deactivatedAt,
};

function shapeRow<T extends Record<string, unknown>>(
  row: T,
  allCohorts: { id: string; name: string; startYear: number; endYear: number }[] = [],
) {
  const countryCode = row.countryCode as string | null;
  const found = allCohorts.find(
    (c) =>
      row.campusEndYear != null &&
      (row.campusEndYear as number) >= c.startYear &&
      (row.campusEndYear as number) <= c.endYear,
  );
  return {
    ...row,
    countryName: countryCode ? COUNTRY_NAMES.get(countryCode) ?? null : null,
    incomplete: !row.onboardingCompletedAt,
    cohort: found ? { id: found.id, name: found.name } : null,
  };
}

// RFC 4180 quoting + formula-injection guard.
function csvCell(value: string | number | null | undefined) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

const toISODate = (value: unknown) =>
  value ? new Date(value as string).toISOString().slice(0, 10) : "";

function groupByProfile<T extends { profileId: string }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.profileId) ?? [];
    list.push(item);
    map.set(item.profileId, list);
  }
  return map;
}

async function activeAdminCount(db: Database) {
  const [row] = await db
    .select({ value: count() })
    .from(user)
    .where(and(eq(user.role, "admin"), isNull(user.deactivatedAt)));
  return row?.value ?? 0;
}

export const alumniRouter = router({
  list: permissionProcedure("records:view").input(listInput).query(async ({ ctx, input }) => {
    const { sort, page, pageSize, ...filters } = input;
    const where = await buildWhere(ctx.db, filters);

    const [rows, total] = await Promise.all([
      ctx.db
        .select(rowShape)
        .from(alumniProfile)
        .innerJoin(user, eq(user.id, alumniProfile.userId))
        .where(where)
        .orderBy(...orderBy(sort))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      ctx.db
        .select({ value: count() })
        .from(alumniProfile)
        .innerJoin(user, eq(user.id, alumniProfile.userId))
        .where(where),
    ]);

    const filteredCount = total[0]?.value ?? 0;
    const allCohorts = await ctx.db.select().from(cohort);

    return {
      rows: rows.map((r) => shapeRow(r, allCohorts)),
      total: filteredCount,
      filteredCount,
      page,
      pageSize,
    };
  }),

  getById: permissionProcedure("records:view").input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const [profile] = await ctx.db
      .select()
      .from(alumniProfile)
      .where(eq(alumniProfile.id, input.id))
      .limit(1);
    if (!profile) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Alumnus record not found" });
    }

    const [[account], duties, educationRows, [lastSession]] = await Promise.all([
      ctx.db
        .select({
          id: user.id,
          email: user.email,
          role: user.role,
          deactivatedAt: user.deactivatedAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })
        .from(user)
        .where(eq(user.id, profile.userId))
        .limit(1),
      ctx.db
        .select()
        .from(duty)
        .where(eq(duty.profileId, profile.id))
        .orderBy(asc(duty.sortOrder)),
      ctx.db
        .select()
        .from(education)
        .where(eq(education.profileId, profile.id))
        .orderBy(asc(education.sortOrder)),
      ctx.db
        .select({ lastActiveAt: session.updatedAt })
        .from(session)
        .where(eq(session.userId, profile.userId))
        .orderBy(desc(session.updatedAt))
        .limit(1),
    ]);

    if (!account) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Alumnus record not found" });
    }

    return {
      profile: {
        ...profile,
        countryName: profile.countryCode ? COUNTRY_NAMES.get(profile.countryCode) ?? null : null,
        incomplete: !profile.onboardingCompletedAt,
      },
      account: {
        ...account,
        lastActiveAt: lastSession?.lastActiveAt ?? null,
      },
      duties,
      education: educationRows,
    };
  }),

  deactivate: permissionProcedure("records:view").input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    return setActive(ctx, input.id, false);
  }),

  reactivate: permissionProcedure("records:view").input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    return setActive(ctx, input.id, true);
  }),

  exportCSV: permissionProcedure("records:export")
    .input(filtersInput.extend({ sort: sortInput }))
    .query(async ({ ctx, input }) => {
      const settings = await readRecordsSettings(ctx.db);
      if (!settings.exportEnabled) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Records export is disabled" });
      }

      const { sort, ...filters } = input;
      const where = await buildWhere(ctx.db, filters);

      const rows = await ctx.db
        .select(rowShape)
        .from(alumniProfile)
        .innerJoin(user, eq(user.id, alumniProfile.userId))
        .where(where)
        .orderBy(...orderBy(sort));

      const profileIds = rows.map((row) => row.id);
      const [allDuties, allEducation] = profileIds.length
        ? await Promise.all([
            ctx.db
              .select()
              .from(duty)
              .where(inArray(duty.profileId, profileIds))
              .orderBy(asc(duty.sortOrder)),
            ctx.db
              .select()
              .from(education)
              .where(inArray(education.profileId, profileIds))
              .orderBy(asc(education.sortOrder)),
          ])
        : [[], []];

      const allCohorts = await ctx.db.select().from(cohort);
      const dutiesByProfile = groupByProfile(allDuties);
      const educationByProfile = groupByProfile(allEducation);

      const headers = [
        "Full name",
        "Email",
        ...(settings.includePhone ? ["Phone"] : []),
        "Campus start",
        "Campus end",
        "Cohort",
        "City",
        "Region",
        "Country",
        "Work status",
        "Professional title",
        "Employer",
        "Bio",
        "Duties",
        "Education",
        "Signed up",
        "Updated",
      ];

      const lines = rows.map((row) => {
        const dutiesCell = (dutiesByProfile.get(row.id) ?? [])
          .map((d) => `${d.type}: ${d.title}, ${d.organization} (${d.startYear}–${d.endYear ?? "present"})`)
          .join("; ");
        const educationCell = (educationByProfile.get(row.id) ?? [])
          .map((e) => `${e.level}: ${e.program}, ${e.institution} (${e.yearCompleted})`)
          .join("; ");

        return [
          row.fullName,
          row.email,
          ...(settings.includePhone ? [row.phone ?? ""] : []),
          row.campusStartYear ?? "",
          row.campusEndYear ?? "",
          (row.campusEndYear != null
            ? (allCohorts.find(
                (c) =>
                  (row.campusEndYear as number) >= c.startYear &&
                  (row.campusEndYear as number) <= c.endYear,
              )?.name ?? "")
            : ""),
          row.city ?? "",
          row.region ?? "",
          row.countryCode ? (COUNTRY_NAMES.get(row.countryCode) ?? row.countryCode) : "",
          row.workStatus ?? "",
          row.professionalTitle ?? "",
          row.employer ?? "",
          row.bio ?? "",
          dutiesCell,
          educationCell,
          toISODate(row.createdAt),
          toISODate(row.updatedAt),
        ];
      });

      const csv = `\uFEFF${headers.map(csvCell).join(",")}\r\n${lines.map((cells) => cells.map(csvCell).join(",")).join("\r\n")}\r\n`;

      return {
        filename: `alumni-records-${new Date().toISOString().slice(0, 10)}.csv`,
        csv,
        rowCount: lines.length,
      };
    }),
});

async function setActive(ctx: { db: Database; currentUser: { id: string } }, profileId: string, active: boolean) {
  const [profile] = await ctx.db
    .select({ userId: alumniProfile.userId })
    .from(alumniProfile)
    .where(eq(alumniProfile.id, profileId))
    .limit(1);
  if (!profile) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Alumnus record not found" });
  }

  const [target] = await ctx.db
    .select({ id: user.id, role: user.role, deactivatedAt: user.deactivatedAt })
    .from(user)
    .where(eq(user.id, profile.userId))
    .limit(1);
  if (!target) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Alumnus record not found" });
  }

  if (active) {
    await ctx.db.update(user).set({ deactivatedAt: null }).where(eq(user.id, profile.userId));
    return { success: true, active: true };
  }

  if (target.deactivatedAt !== null) return { success: true, active: false };
  if (target.role === "admin" && (await activeAdminCount(ctx.db)) <= 1) {
    throw new TRPCError({ code: "FORBIDDEN", message: LAST_ADMIN_MESSAGE });
  }

  await ctx.db.update(user).set({ deactivatedAt: new Date() }).where(eq(user.id, profile.userId));
  await ctx.db.delete(session).where(eq(session.userId, profile.userId));
  return { success: true, active: false };
}
